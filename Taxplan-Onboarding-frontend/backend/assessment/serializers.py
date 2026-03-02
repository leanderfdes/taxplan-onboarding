from rest_framework import serializers
from .models import TestType, VideoQuestion, UserSession, Violation, VideoResponse

class TestTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = TestType
        fields = ['id', 'name', 'slug']



class VideoQuestionSerializer(serializers.ModelSerializer):
    class Meta:
        model = VideoQuestion
        fields = ['id', 'text', 'test_type']

class UserSessionSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserSession
        fields = ['id', 'user', 'test_type', 'selected_domains', 'question_set', 'video_question_set', 'start_time', 'end_time', 'status', 'violation_count']
        read_only_fields = ['user', 'selected_domains', 'question_set', 'video_question_set', 'start_time', 'end_time', 'status', 'violation_count']

class ViolationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Violation
        fields = ['id', 'session', 'violation_type', 'timestamp']
        read_only_fields = ['session', 'timestamp']

class VideoResponseSerializer(serializers.ModelSerializer):
    class Meta:
        model = VideoResponse
        fields = ['id', 'session', 'question_identifier', 'video_file', 'uploaded_at']

class ProctoringSnapshotSerializer(serializers.ModelSerializer):
    class Meta:
        from .models import ProctoringSnapshot
        model = ProctoringSnapshot
        fields = ['id', 'session', 'image_url', 'timestamp', 'is_violation', 'violation_reason', 'face_count', 'match_score']
        read_only_fields = ['session', 'timestamp']
