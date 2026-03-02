from django.db import models
from authentication.models import User

class ConsultantDocument(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='consultant_documents')
    qualification_type = models.CharField(max_length=100)
    document_type = models.CharField(max_length=100)
    file_path = models.CharField(max_length=500)
    verification_status = models.CharField(max_length=50, blank=True, null=True)
    gemini_raw_response = models.TextField(blank=True, null=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.email} - {self.document_type}"
