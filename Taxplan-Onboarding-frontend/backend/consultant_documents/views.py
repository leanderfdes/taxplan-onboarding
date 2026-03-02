from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.conf import settings
from supabase import create_client, Client
from .models import ConsultantDocument
from .serializers import ConsultantDocumentSerializer
import os
import time

class UploadDocumentView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        user = request.user
        qualification_type = request.data.get('qualification_type')
        document_type = request.data.get('document_type')
        file_obj = request.FILES.get('file')

        if not all([qualification_type, document_type, file_obj]):
            return Response({'error': 'Missing required fields'}, status=400)

        
        timestamp = int(time.time())
      
        filename = "".join(x for x in file_obj.name if x.isalnum() or x in "._- ")
        file_path = f"consultant_documents/{user.id}/{timestamp}_{filename}"

        try:
            # Save to S3 via default storage
            from django.core.files.storage import default_storage
            
            # Save file to S3
            saved_path = default_storage.save(file_path, file_obj)
            
            document = ConsultantDocument.objects.create(
                user=user,
                qualification_type=qualification_type,
                document_type=document_type,
                file_path=saved_path
            )
          
            
            # Verify with Gemini
            from ai_analysis.services import QualificationDocumentVerifier
            verifier = QualificationDocumentVerifier()
            result = verifier.verify_document(document)
            
            document.verification_status = result.get('verification_status')
            document.gemini_raw_response = result.get('raw_response')
            document.save()

            serializer = ConsultantDocumentSerializer(document)
            
            # Add Gemini verification results to response payload manually because 
            # the serializer might not include the new fields immediately unless updated.
            response_data = serializer.data
            response_data['verification_status'] = document.verification_status
            
            # Trigger auto-credential check
            from authentication.utils import check_and_auto_generate_credentials
            check_and_auto_generate_credentials(user)
            
            return Response(response_data, status=201)

        except Exception as e:
            return Response({'error': str(e)}, status=500)

class DocumentListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        documents = ConsultantDocument.objects.filter(user=user).order_by('-uploaded_at')
        serializer = ConsultantDocumentSerializer(documents, many=True)
        return Response(serializer.data)
