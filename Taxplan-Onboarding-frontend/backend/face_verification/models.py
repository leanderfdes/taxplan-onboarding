from django.db import models
from django.conf import settings

class FaceVerification(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='face_verifications')
    id_image_path = models.CharField(max_length=255)
    live_image_path = models.CharField(max_length=255, blank=True, default='')
    confidence = models.FloatField(null=True, blank=True)
    is_match = models.BooleanField(default=False)
    verified_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'face_verifications'
        ordering = ['-verified_at']

    def __str__(self):
        return f"{self.user.email} - {'Match' if self.is_match else 'No Match'}"
