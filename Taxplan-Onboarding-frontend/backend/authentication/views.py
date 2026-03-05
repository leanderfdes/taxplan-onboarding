import uuid
import re
import json
from datetime import datetime
from difflib import SequenceMatcher
from types import SimpleNamespace
from django.conf import settings
from rest_framework import status, viewsets
from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from django.contrib.auth import get_user_model
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests 

from .models import User, IdentityDocument
from .serializers import UserSerializer, GoogleAuthSerializer, OnboardingSerializer, ConsultantDocumentSerializer
from .authentication import generate_jwt_token
from utils.supabase_client import get_supabase_client
from consultant_documents.models import ConsultantDocument as RealConsultantDocument

User = get_user_model()

NAME_MATCH_THRESHOLD = 90


def _normalize_name(value):
    text = str(value or '').strip().lower()
    text = re.sub(r'[^a-z\s]', ' ', text)
    return re.sub(r'\s+', ' ', text).strip()


def _fuzzy_name_similarity_pct(left, right):
    left_norm = _normalize_name(left)
    right_norm = _normalize_name(right)
    if not left_norm or not right_norm:
        return 0
    return int(round(SequenceMatcher(None, left_norm, right_norm).ratio() * 100))


def _first_last_name(value):
    tokens = _normalize_name(value).split()
    if not tokens:
        return ''
    if len(tokens) == 1:
        return tokens[0]
    return f"{tokens[0]} {tokens[-1]}"


def _fuzzy_first_last_similarity_pct(left, right):
    left_norm = _first_last_name(left)
    right_norm = _first_last_name(right)
    if not left_norm or not right_norm:
        return 0
    return int(round(SequenceMatcher(None, left_norm, right_norm).ratio() * 100))


def _parse_date_text(value):
    raw = str(value or '').strip()
    if not raw:
        return None

    formats = (
        '%d/%m/%Y', '%d-%m-%Y', '%d.%m.%Y',
        '%Y-%m-%d', '%Y/%m/%d',
        '%d/%m/%y', '%d-%m-%y',
    )
    for fmt in formats:
        try:
            return datetime.strptime(raw, fmt).date()
        except ValueError:
            continue

    dmy_match = re.search(r'(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})', raw)
    if dmy_match:
        day = int(dmy_match.group(1))
        month = int(dmy_match.group(2))
        year = int(dmy_match.group(3))
        if year < 100:
            year += 2000 if year < 50 else 1900
        try:
            return datetime(year, month, day).date()
        except ValueError:
            return None

    ymd_match = re.search(r'(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})', raw)
    if ymd_match:
        year = int(ymd_match.group(1))
        month = int(ymd_match.group(2))
        day = int(ymd_match.group(3))
        try:
            return datetime(year, month, day).date()
        except ValueError:
            return None

    return None


@api_view(['POST'])
@permission_classes([AllowAny])
@authentication_classes([])
def google_auth(request):
    """
    Authenticate user via Google OAuth token.
    Creates new user if not exists, returns JWT token in cookie.
    """
    serializer = GoogleAuthSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    token = serializer.validated_data['token']
    
    try:
        # Verify the Google token
        idinfo = id_token.verify_oauth2_token(
            token, 
            google_requests.Request(), 
            settings.GOOGLE_CLIENT_ID,
            clock_skew_in_seconds=10
        )
        
        email = idinfo.get('email')
        google_id = idinfo.get('sub')
        name = idinfo.get('name', '')
        
        if not email:
            return Response(
                {'error': 'Email not provided by Google'}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
     
        name_parts = name.split()
        first_name = name_parts[0] if name_parts else ''
        last_name = " ".join(name_parts[1:]) if len(name_parts) > 1 else ''

        user, created = User.objects.get_or_create(
            email=email,
            defaults={
                'google_id': google_id,
                'first_name': first_name,
                'last_name': last_name,
            }
        )
        
        # Update google_id if user exists but doesn't have one
        if not created and not user.google_id:
            user.google_id = google_id
            user.save()
        
        # Generate JWT token
        jwt_token = generate_jwt_token(user)
        
        # Create response with user data
        response_data = {
            'user': UserSerializer(user).data,
            'is_new_user': created,
            'needs_onboarding': not user.is_onboarded,
        }
        
        response = Response(response_data, status=status.HTTP_200_OK)
        
        # Set JWT token in HttpOnly cookie (3 hours = 10800 seconds)
        response.set_cookie(
            key='jwt_token',
            value=jwt_token,
            max_age=3 * 60 * 60,  
            httponly=True,
            samesite='Lax',
            secure=not settings.DEBUG,
        )
        
        return response
        
    except ValueError as e:
        return Response(
            {'error': f'Invalid Google token: {str(e)}'}, 
            status=status.HTTP_400_BAD_REQUEST
        )
    except Exception as e:
        return Response(
            {'error': f'Authentication failed: {str(e)}'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def complete_onboarding(request):
    """
    Complete user onboarding with profile details.
    """
    serializer = OnboardingSerializer(data=request.data, instance=request.user)
    
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    user = serializer.save()
    
    return Response({
        'message': 'Details submitted successfully',
        'user': UserSerializer(user).data,
    }, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_user_profile(request):
    """Get current user's profile with step completion flags"""
    user = request.user
    has_identity_doc = IdentityDocument.objects.filter(user=user).exists()

    
    has_passed_assessment = False
    try:
        from assessment.models import UserSession
        latest_session = UserSession.objects.filter(user=user, status='completed').order_by('-end_time').first()
        if latest_session and latest_session.score >= 30:
            has_passed_assessment = True
    except Exception:
        pass

    has_documents = RealConsultantDocument.objects.filter(user=user).exists()

    return Response({
        'user': UserSerializer(user).data,
        'has_identity_doc': has_identity_doc,
        'has_passed_assessment': has_passed_assessment,
        'has_accepted_declaration': user.has_accepted_declaration,
        'has_documents': has_documents,
    }, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def accept_declaration(request):
    """Mark the user as having accepted the onboarding declaration"""
    user = request.user
    user.has_accepted_declaration = True
    user.save(update_fields=['has_accepted_declaration'])
    return Response({'message': 'Declaration accepted successfully'}, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([AllowAny])
def logout(request):
    """Logout user by clearing the JWT cookie"""
    response = Response({'message': 'Logged out successfully'}, status=status.HTTP_200_OK)
    response.delete_cookie('jwt_token')
    return response


@api_view(['GET'])
@permission_classes([AllowAny])
def health_check(request):
    """Health check endpoint"""
    return Response({'status': 'ok'}, status=status.HTTP_200_OK)





@api_view(['POST'])
@permission_classes([IsAuthenticated])
def upload_document(request):
    """
    Upload consultant documents (Qualification or Certificate).
    Enforces limit of 5 certificates.
    """
    user = request.user
    document_type = request.data.get('document_type')

    if document_type in ('Certificate', 'certificate'):
        # Check existing certificate count
        cert_count = user.documents.filter(document_type__in=['Certificate', 'certificate']).count()
        if cert_count >= 5:
            return Response(
                {'error': 'You can upload a maximum of 5 certificates.'},
                status=status.HTTP_400_BAD_REQUEST
            )

    serializer = ConsultantDocumentSerializer(data=request.data)
    if serializer.is_valid():
        document = serializer.save(user=user)

        normalized_doc_type = str(document_type or '').strip().lower()
        if normalized_doc_type == 'experience_letter':
            # Experience letter policy: only first+last name match check.
            from ai_analysis.services import QualificationDocumentVerifier
            verifier = QualificationDocumentVerifier()
            verification_target = SimpleNamespace(
                id=document.id,
                file_path=document.file.name,
                document_type='experience_letter',
                qualification_type='Experience',
            )
            result = verifier.verify_document(verification_target)
            extracted_name = str(result.get('extracted_name') or '').strip()
            profile_first_last = _first_last_name(f"{user.first_name} {user.last_name}")
            name_similarity_pct = _fuzzy_first_last_similarity_pct(profile_first_last, extracted_name)
            name_match = name_similarity_pct >= NAME_MATCH_THRESHOLD
            verification_status = str(result.get('verification_status', '')).strip().lower()
            is_legit = verification_status == 'verified'

            # Non-blocking: persist verification outcome for admin review only.
            document.verification_status = 'Verified' if (is_legit and name_match) else 'Review Required'
            document.gemini_raw_response = json.dumps({
                'determined_type': result.get('determined_type'),
                'verification_status': result.get('verification_status'),
                'degree_level': result.get('degree_level'),
                'extracted_name': extracted_name,
                'name_similarity_pct': name_similarity_pct,
                'name_threshold_pct': NAME_MATCH_THRESHOLD,
                'name_match': name_match,
                'is_legit': is_legit,
                'notes': result.get('notes'),
            })
            document.save(update_fields=['verification_status', 'gemini_raw_response'])

            response_data = ConsultantDocumentSerializer(document).data
            response_data['verification'] = {
                'is_legit': is_legit,
                'name_similarity_pct': name_similarity_pct,
                'name_threshold_pct': NAME_MATCH_THRESHOLD,
                'name_match': name_match,
            }
            return Response(response_data, status=status.HTTP_201_CREATED)

        return Response(serializer.data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_user_documents(request):
    """Get all documents uploaded by the user"""
    documents = request.user.documents.all()
    serializer = ConsultantDocumentSerializer(documents, many=True)
    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def upload_identity_document(request):
    """
    Upload identity document to Supabase and verify with Gemini.
    """
    user = request.user
    uploaded_file = request.FILES.get('identity_document')
    
    if not uploaded_file:
        return Response({"error": "No document uploaded"}, status=status.HTTP_400_BAD_REQUEST)

    try:

        file_ext = uploaded_file.name.split('.')[-1]
        file_path = f"identity_documents/{user.id}/identity_{uuid.uuid4()}.{file_ext}"
        
        # Save to S3 via default storage
        from django.core.files.storage import default_storage
        saved_path = default_storage.save(file_path, uploaded_file)

        # Create database record
        identity_doc = IdentityDocument.objects.create(
            user=user,
            file_path=saved_path
        )
        
        # Verify with Gemini
        from ai_analysis.services import IdentityDocumentVerifier
        verifier = IdentityDocumentVerifier()
        result = verifier.verify_document(identity_doc)
        
        # Save Gemini results
        identity_doc.document_type = result.get('document_type')
        identity_doc.verification_status = result.get('verification_status')
        identity_doc.gemini_raw_response = result.get('raw_response')
        identity_doc.save()

        is_masked = bool(result.get('is_sensitive_data_masked', False))
        verification_status = str(identity_doc.verification_status or '').strip().lower()
        extracted_name = str(result.get('extracted_name') or '').strip()
        extracted_dob = str(result.get('extracted_dob') or '').strip()
        profile_name = user.get_full_name()
        profile_dob = getattr(user, 'dob', None)
        name_similarity_pct = _fuzzy_name_similarity_pct(profile_name, extracted_name) if extracted_name else 0
        name_match = (name_similarity_pct >= NAME_MATCH_THRESHOLD) if extracted_name else None
        parsed_extracted_dob = _parse_date_text(extracted_dob)
        dob_match = (bool(profile_dob and parsed_extracted_dob and profile_dob == parsed_extracted_dob)
                     if parsed_extracted_dob else None)

        # If we can detect personal-details mismatch, surface it first so UI can force details correction.
        has_detectable_mismatch = (name_match is False) or (dob_match is False)
        if has_detectable_mismatch:
            from django.core.files.storage import default_storage
            try:
                default_storage.delete(saved_path)
            except Exception:
                pass
            identity_doc.delete()
            return Response({
                "error": "Personal details do not match the uploaded Government ID.",
                "code": "PERSONAL_DETAILS_MISMATCH",
                "verification": {
                    "document_type": result.get('document_type'),
                    "status": result.get('verification_status'),
                    "name_similarity_pct": name_similarity_pct,
                    "name_threshold_pct": NAME_MATCH_THRESHOLD,
                    "name_match": name_match,
                    "dob_match": dob_match,
                }
            }, status=status.HTTP_400_BAD_REQUEST)

        if verification_status != 'verified':
            from django.core.files.storage import default_storage
            try:
                default_storage.delete(saved_path)
            except Exception:
                pass
            identity_doc.delete()
            return Response({
                "error": "Document verification failed. Please upload a valid government ID.",
                "code": "IDENTITY_INVALID",
                "verification": {
                    "document_type": result.get('document_type'),
                    "status": result.get('verification_status'),
                    "privacy_notes": result.get('privacy_notes', ''),
                }
            }, status=status.HTTP_400_BAD_REQUEST)

        # For verified docs, require both checks to be present and true.
        if name_match is not True or dob_match is not True:
            from django.core.files.storage import default_storage
            try:
                default_storage.delete(saved_path)
            except Exception:
                pass
            identity_doc.delete()
            return Response({
                "error": "Personal details do not match the uploaded Government ID.",
                "code": "PERSONAL_DETAILS_MISMATCH",
                "verification": {
                    "document_type": result.get('document_type'),
                    "status": result.get('verification_status'),
                    "name_similarity_pct": name_similarity_pct,
                    "name_threshold_pct": NAME_MATCH_THRESHOLD,
                    "name_match": name_match,
                    "dob_match": dob_match,
                }
            }, status=status.HTTP_400_BAD_REQUEST)

        return Response({
            "message": "Identity document uploaded and verified successfully", 
            "path": saved_path,
            "verification": {
                "document_type": identity_doc.document_type,
                "status": identity_doc.verification_status,
                "is_masked": is_masked,
                "name_similarity_pct": name_similarity_pct,
                "name_threshold_pct": NAME_MATCH_THRESHOLD,
                "name_match": name_match,
                "dob_match": dob_match,
            }
        }, status=status.HTTP_200_OK)

    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
