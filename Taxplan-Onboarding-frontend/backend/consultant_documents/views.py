from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from supabase import create_client, Client
from .models import ConsultantDocument
from .serializers import ConsultantDocumentSerializer
from authentication.models import IdentityDocument
from difflib import SequenceMatcher
import json
import re
import os
import time

NAME_MATCH_THRESHOLD = 90


def _normalize_name(value):
    text = str(value or '').strip().lower()
    text = re.sub(r'[^a-z\s]', ' ', text)
    return re.sub(r'\s+', ' ', text).strip()


def _first_last_name(value):
    tokens = _normalize_name(value).split()
    if not tokens:
        return ''
    if len(tokens) == 1:
        return tokens[0]
    return f"{tokens[0]} {tokens[-1]}"


def _fuzzy_similarity_pct(left, right):
    left_norm = _first_last_name(left)
    right_norm = _first_last_name(right)
    if not left_norm or not right_norm:
        return 0
    return int(round(SequenceMatcher(None, left_norm, right_norm).ratio() * 100))


def _get_verified_identity_name(user):
    docs = IdentityDocument.objects.filter(
        user=user,
        verification_status='Verified'
    ).order_by('-uploaded_at')
    for doc in docs:
        try:
            payload = json.loads(doc.gemini_raw_response or '{}')
            extracted_name = payload.get('extracted_name', '')
            first_last = _first_last_name(extracted_name)
            if first_last:
                return first_last
        except Exception:
            continue
    return ''


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

            normalized_doc_type = str(document_type or '').strip().lower()
            if normalized_doc_type == 'bachelors_degree':
                verification_status = str(result.get('verification_status', '')).strip().lower()
                determined_type = str(result.get('determined_type', '')).strip().lower()
                degree_level = str(result.get('degree_level', '')).strip().lower()
                is_target_field = bool(result.get('is_target_field', False))
                degree_field = str(result.get('degree_field', '')).strip()
                rejection_reason = str(result.get('rejection_reason', '')).strip()

                is_bachelors_type = (
                    "bachelor" in determined_type
                    or degree_level == 'bachelors'
                )

                # Must be legitimate and clearly a bachelor's degree.
                if verification_status != 'verified' or not is_bachelors_type:
                    from django.core.files.storage import default_storage
                    try:
                        default_storage.delete(saved_path)
                    except Exception:
                        pass
                    document.delete()
                    return Response({
                        'error': "Uploaded file is not a valid Bachelor's degree certificate. Please reupload the correct bachelor's degree document.",
                        'code': 'BACHELOR_REQUIRED',
                        'verification': {
                            'determined_type': result.get('determined_type'),
                            'verification_status': result.get('verification_status'),
                            'degree_field': degree_field,
                            'rejection_reason': rejection_reason,
                        }
                    }, status=400)

                # Must be the correct field/domain.
                if not is_target_field:
                    from django.core.files.storage import default_storage
                    try:
                        default_storage.delete(saved_path)
                    except Exception:
                        pass
                    document.delete()
                    return Response({
                        'error': "Bachelor's degree field does not match the required domain. Please upload the correct bachelor's degree.",
                        'code': 'BACHELOR_WRONG_FIELD',
                        'verification': {
                            'determined_type': result.get('determined_type'),
                            'verification_status': result.get('verification_status'),
                            'degree_field': degree_field,
                            'rejection_reason': rejection_reason or 'Detected field not in allowed domain list.',
                        }
                    }, status=400)

            if normalized_doc_type in {'bachelors_degree', 'masters_degree', 'certificate'}:
                extracted_doc_name = result.get('extracted_name', '')
                doc_name_first_last = _first_last_name(extracted_doc_name)
                identity_name_first_last = _get_verified_identity_name(user)
                name_similarity_pct = _fuzzy_similarity_pct(doc_name_first_last, identity_name_first_last)
                name_match = bool(name_similarity_pct >= NAME_MATCH_THRESHOLD)

                if not doc_name_first_last or not identity_name_first_last or not name_match:
                    from django.core.files.storage import default_storage
                    try:
                        default_storage.delete(saved_path)
                    except Exception:
                        pass
                    document.delete()
                    return Response({
                        'error': "Name on this document does not match your Government ID. Please upload a document with matching first and last name.",
                        'code': 'QUALIFICATION_NAME_MISMATCH',
                        'verification': {
                            'determined_type': result.get('determined_type'),
                            'verification_status': result.get('verification_status'),
                            'name_similarity_pct': name_similarity_pct,
                            'name_threshold_pct': NAME_MATCH_THRESHOLD,
                            'name_match': name_match,
                        }
                    }, status=400)

            serializer = ConsultantDocumentSerializer(document)
            
            # Add Gemini verification results to response payload manually because 
            # the serializer might not include the new fields immediately unless updated.
            response_data = serializer.data
            response_data['verification_status'] = document.verification_status
            response_data['verification'] = {
                'determined_type': result.get('determined_type'),
                'verification_status': result.get('verification_status'),
                'extracted_name': result.get('extracted_name', ''),
                'degree_level': result.get('degree_level'),
                'degree_field': result.get('degree_field'),
                'is_target_field': result.get('is_target_field'),
                'rejection_reason': result.get('rejection_reason'),
            }
            
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
