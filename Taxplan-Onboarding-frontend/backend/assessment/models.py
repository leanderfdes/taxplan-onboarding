from django.db import models
from django.conf import settings

class TestType(models.Model):
    name = models.CharField(max_length=100)
    slug = models.SlugField(unique=True)

    def __str__(self):
        return self.name

class VideoQuestion(models.Model):
    text = models.TextField()
    test_type = models.ForeignKey(TestType, on_delete=models.CASCADE, related_name='video_questions', null=True, blank=True)

    def __str__(self):
        return self.text

class UserSession(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='assessment_sessions')
    
    test_type = models.ForeignKey(TestType, on_delete=models.SET_NULL, null=True, blank=True)
    
    selected_domains = models.JSONField(default=list) 
    question_set = models.JSONField(default=list)
    video_question_set = models.JSONField(default=list) 
    score = models.FloatField(default=0.0)

    start_time = models.DateTimeField(auto_now_add=True)
    end_time = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=20, default='ongoing', choices=[('ongoing', 'Ongoing'), ('completed', 'Completed'), ('flagged', 'Flagged')])
    violation_count = models.IntegerField(default=0)
    violation_counters = models.JSONField(default=dict, blank=True)

    def __str__(self):
        return f"Session {self.id} - {self.user.email}"

class Violation(models.Model):
    session = models.ForeignKey(UserSession, on_delete=models.CASCADE, related_name='violations')
    violation_type = models.CharField(max_length=50) 
    timestamp = models.DateTimeField(auto_now_add=True)

class VideoResponse(models.Model):
    session = models.ForeignKey(UserSession, on_delete=models.CASCADE, related_name='video_responses')
    
    question_identifier = models.CharField(max_length=255, default="unknown") 
    video_file = models.TextField() 
    uploaded_at = models.DateTimeField(auto_now_add=True)

    # AI Evaluation Fields
    ai_transcript = models.TextField(null=True, blank=True)
    ai_score = models.IntegerField(null=True, blank=True)
    ai_feedback = models.JSONField(null=True, blank=True) # Changed to JSONField for structured feedback if needed, implies detailed feedback
    ai_status = models.CharField(max_length=20, default='pending', choices=[
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('failed', 'Failed')
    ])

class ProctoringSnapshot(models.Model):
    session = models.ForeignKey(UserSession, on_delete=models.CASCADE, related_name='proctoring_snapshots')
    snapshot_id = models.CharField(max_length=64, null=True, blank=True, db_index=True)
    image_url = models.TextField() 
    timestamp = models.DateTimeField(auto_now_add=True)
    is_violation = models.BooleanField(default=False)
    violation_reason = models.TextField(null=True, blank=True)
    face_count = models.IntegerField(default=0)
    match_score = models.FloatField(default=0.0)
    pose_yaw = models.FloatField(null=True, blank=True)
    pose_pitch = models.FloatField(null=True, blank=True)
    pose_roll = models.FloatField(null=True, blank=True)
    mouth_state = models.CharField(max_length=20, null=True, blank=True)
    audio_detected = models.BooleanField(default=False)
    gaze_violation = models.BooleanField(default=False)
    label_detection_results = models.JSONField(default=list, blank=True)
    rule_outcomes = models.JSONField(default=dict, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=['session', 'snapshot_id'], name='uniq_snapshot_per_session_id')
        ]

    def __str__(self):
        return f"Snapshot {self.id} - Session {self.session.id}"
