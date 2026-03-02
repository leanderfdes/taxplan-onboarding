import boto3
import uuid
import base64
from django.conf import settings
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from .models import FaceVerification
from utils.supabase_client import get_supabase_client

from utils.rekognition_client import get_rekognition_client

# Initialize Rekognition client
rekognition = get_rekognition_client()

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def upload_photo(request, user_id):
    """
    Upload ID photo to Supabase.
    """
    user = request.user
    if str(user.id) != str(user_id):
        return Response({"error": "Unauthorized"}, status=status.HTTP_403_FORBIDDEN)

    uploaded_photo = request.FILES.get('uploaded_photo')
    if not uploaded_photo:
        return Response({"error": "No photo uploaded"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        # Save to S3 via default storage
        from django.core.files.storage import default_storage
        file_path = f"face_verification/{user.id}/id_photo_{uuid.uuid4()}.jpg"
        
        # Save file
        saved_path = default_storage.save(file_path, uploaded_photo)

        # Update or create FaceVerification record
        verification, created = FaceVerification.objects.get_or_create(user=user)
        verification.id_image_path = file_path
        verification.save()

        return Response({"message": "ID photo uploaded successfully", "path": file_path})

    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def verify_face(request, user_id):
    """
    Verify face by comparing uploaded ID photo with live capture.
    """
    user = request.user
    if str(user.id) != str(user_id):
        return Response({"error": "Unauthorized"}, status=status.HTTP_403_FORBIDDEN)

    live_photo_base64 = request.data.get('live_photo_base64')
    if not live_photo_base64:
        return Response({"error": "Live photo required"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        # Get stored ID photo path
        try:
            from authentication.models import IdentityDocument
            identity_doc = IdentityDocument.objects.filter(user=user).latest('uploaded_at')
            id_photo_path = identity_doc.file_path
            
            # Since FaceVerification record tracking ID photo is decoupled, get/create for live photo tracking
            verification, _ = FaceVerification.objects.get_or_create(user=user)
            verification.id_image_path = id_photo_path
            
        except Exception:
            return Response({"error": "Government ID not found. Please upload ID photo first."}, status=status.HTTP_404_NOT_FOUND)

        # 1. Download ID photo from Storage (S3)
        from django.core.files.storage import default_storage
        try:
            with default_storage.open(id_photo_path, 'rb') as f:
                id_photo_data = f.read()
        except Exception:
             return Response({"error": "Failed to retrieve ID photo"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        # 2. Process Live Photo (Base64 -> Bytes)
        if "base64," in live_photo_base64:
            live_photo_base64 = live_photo_base64.split("base64,")[1]
        live_photo_bytes = base64.b64decode(live_photo_base64)

        # 3. Upload Live Photo to Storage (S3)
        from django.core.files.base import ContentFile
        live_photo_path = f"face_verification/{user.id}/live_photo_{uuid.uuid4()}.jpg"
        
        # ContentFile needed to save bytes directly
        default_storage.save(live_photo_path, ContentFile(live_photo_bytes))
        
        # Update record with live photo path
        verification.live_image_path = live_photo_path
        verification.save()

        # Check for faces in ID Photo
        try:
            det_id = rekognition.detect_faces(Image={"Bytes": id_photo_data})
            face_count = len(det_id.get('FaceDetails', []))
            if face_count == 0:
                 return Response({"error": "No face detected in the uploaded ID photo. Please upload a clearer photo."}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            raise e

        # Check for faces in Live Photo
        try:
            det_live = rekognition.detect_faces(Image={"Bytes": live_photo_bytes})
            face_count_live = len(det_live.get('FaceDetails', []))
            if face_count_live == 0:
                 return Response({"error": "No face detected in the live capture. Please try again."}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            raise e

        # 4. Compare with Amazon Rekognition
    
        response = rekognition.compare_faces(
            SourceImage={"Bytes": id_photo_data},
            TargetImage={"Bytes": live_photo_bytes},
            SimilarityThreshold=85
        )

        matches = response.get("FaceMatches", [])
        is_match = False
        confidence = 0.0

        if matches:
            
            similarity = matches[0]["Similarity"]
            is_match = True
            confidence = similarity
        
        
        verification.is_match = is_match
        verification.confidence = confidence
        verification.save()

        
        if is_match:
             user.is_verified = True
             user.save()

        return Response({
            "match": is_match,
            "similarity": confidence
        })

    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
