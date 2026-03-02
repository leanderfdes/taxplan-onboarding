from rest_framework import serializers
from .models import ConsultantDocument

class ConsultantDocumentSerializer(serializers.ModelSerializer):
    signed_url = serializers.SerializerMethodField()

    class Meta:
        model = ConsultantDocument
        fields = ['id', 'user', 'qualification_type', 'document_type', 'signed_url', 'uploaded_at', 'verification_status', 'gemini_raw_response']
        read_only_fields = ['user', 'uploaded_at']

    def get_signed_url(self, obj):
        try:
            from django.core.files.storage import default_storage
            if obj.file_path:
                return default_storage.url(obj.file_path)
            if obj.file:
                return default_storage.url(str(obj.file))
            return None
        except Exception:
            return None
