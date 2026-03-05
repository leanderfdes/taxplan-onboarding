import jwt
import random
import string
from datetime import datetime, timedelta, timezone
from django.conf import settings
from django.core.mail import send_mail
from django.contrib.auth import get_user_model
from django.db.models import Count
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed

from authentication.models import ConsultantDocument as AuthConsultantDocument, IdentityDocument, ConsultantCredential
from consultant_documents.models import ConsultantDocument
from face_verification.models import FaceVerification
from assessment.models import UserSession, VideoResponse, Violation, ProctoringSnapshot
from assessment.risk import compute_proctoring_risk_summary

User = get_user_model()

# Hardcoded admin credentials
ADMIN_USERNAME = 'admin'
ADMIN_PASSWORD = 'admin'


def _active_rule_names(rule_outcomes):
    """Extract triggered/enforced rule names for compact timeline display."""
    if not isinstance(rule_outcomes, dict):
        return []
    names = []
    for rule_name, rule_data in rule_outcomes.items():
        if not isinstance(rule_data, dict):
            continue
        if (
            bool(rule_data.get('enforce_violation'))
            or bool(rule_data.get('triggered'))
            or bool(rule_data.get('sustained_triggered'))
        ):
            names.append(str(rule_name))
    return names


class AdminJWTAuthentication(BaseAuthentication):
    """JWT authentication that checks for is_admin claim."""

    def authenticate(self, request):
        token = request.headers.get('Authorization', '')
        if not token.startswith('Bearer '):
            return None
        token = token.split(' ')[1]
        try:
            payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=['HS256'])
            if not payload.get('is_admin'):
                raise AuthenticationFailed('Not an admin token')
            # Return a simple object as the "user" for admin
            return (type('AdminUser', (), {'is_authenticated': True, 'is_admin': True})(), token)
        except jwt.ExpiredSignatureError:
            raise AuthenticationFailed('Token expired')
        except jwt.InvalidTokenError:
            raise AuthenticationFailed('Invalid token')


@api_view(['POST'])
@authentication_classes([])
@permission_classes([AllowAny])
def admin_login(request):
    """Admin login with hardcoded credentials."""
    username = request.data.get('username', '')
    password = request.data.get('password', '')

    if username == ADMIN_USERNAME and password == ADMIN_PASSWORD:
        payload = {
            'is_admin': True,
            'username': username,
            'exp': datetime.now(timezone.utc) + timedelta(hours=12),
            'iat': datetime.now(timezone.utc),
        }
        token = jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm='HS256')
        return Response({'token': token, 'message': 'Login successful'})
    
    return Response({'error': 'Invalid credentials'}, status=status.HTTP_401_UNAUTHORIZED)


@api_view(['GET'])
@authentication_classes([AdminJWTAuthentication])
@permission_classes([AllowAny])
def consultant_list(request):
    """List all consultants with summary info."""
    users = User.objects.all().order_by('-created_at')
    data = []
    for u in users:
        # Check assessment status
        latest_session = UserSession.objects.filter(user=u).order_by('-start_time').first()
        assessment_status = 'Not Attempted'
        assessment_score = None
        if latest_session:
            if latest_session.violation_count > 0:
                assessment_status = 'Violated'
            else:
                assessment_status = latest_session.status.capitalize()
            assessment_score = latest_session.score
            violation_count = latest_session.violation_count
        else:
            violation_count = 0

        # Check document count
        doc_count = (
            AuthConsultantDocument.objects.filter(user=u).count() +
            ConsultantDocument.objects.filter(user=u).count()
        )

        # Compute video score from latest session
        video_score = None
        video_total = None
        if latest_session:
            from assessment.models import VideoResponse
            video_responses = VideoResponse.objects.filter(session=latest_session)
            scores = [vr.ai_score for vr in video_responses if vr.ai_score is not None]
            if scores:
                video_score = sum(scores)
                video_total = len(latest_session.video_question_set or []) * 5

        data.append({
            'id': str(u.id),
            'email': u.email,
            'full_name': u.get_full_name(),
            'phone_number': u.phone_number,
            'is_onboarded': u.is_onboarded,
            'is_verified': u.is_verified,
            'has_accepted_declaration': u.has_accepted_declaration,
            'assessment_status': assessment_status,
            'assessment_score': assessment_score,
            'video_score': video_score,
            'video_total': video_total,
            'document_count': doc_count,
            'has_credentials': hasattr(u, 'credentials'),
            'created_at': u.created_at.isoformat() if u.created_at else None,
        })

    return Response({'consultants': data, 'total': len(data)})


@api_view(['GET'])
@authentication_classes([AdminJWTAuthentication])
@permission_classes([AllowAny])
def consultant_detail(request, user_id):
    """Get full detail for a single consultant."""
    try:
        u = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

    # Helper: get URL from storage (S3)
    from django.core.files.storage import default_storage

    def get_storage_url(path):
        """Generate URL for a file in storage."""
        if not path:
            return None
        try:
            return default_storage.url(path)
        except Exception as e:
            print(f"Error generating URL for {path}: {e}")
            return None

    # Profile
    profile = {
        'id': str(u.id),
        'email': u.email,
        'first_name': u.first_name,
        'middle_name': u.middle_name,
        'last_name': u.last_name,
        'full_name': u.get_full_name(),
        'age': u.age,
        'dob': str(u.dob) if u.dob else None,
        'phone_number': u.phone_number,
        'address_line1': u.address_line1,
        'address_line2': u.address_line2,
        'city': u.city,
        'state': u.state,
        'pincode': u.pincode,
        'practice_type': u.practice_type,
        'years_of_experience': u.years_of_experience,
        'is_onboarded': u.is_onboarded,
        'is_verified': u.is_verified,
        'is_active': u.is_active,
        'has_accepted_declaration': u.has_accepted_declaration,
        'created_at': u.created_at.isoformat() if u.created_at else None,
        'updated_at': u.updated_at.isoformat() if u.updated_at else None,
        'has_credentials': hasattr(u, 'credentials'),
    }

    # Identity Documents — bucket: identity_documents
    identity_docs_raw = IdentityDocument.objects.filter(user=u)
    identity_docs = []
    for doc in identity_docs_raw:
        identity_docs.append({
            'id': doc.id,
            'file_path': doc.file_path,
            'file_url': get_storage_url(doc.file_path),
            'uploaded_at': doc.uploaded_at,
            'document_type': doc.document_type,
            'verification_status': doc.verification_status,
            'gemini_raw_response': doc.gemini_raw_response,
        })

    # Face Verification — bucket: consultant_faceverification
    face_records_raw = FaceVerification.objects.filter(user=u)
    face_records = []
    for f in face_records_raw:
        face_records.append({
            'id': f.id,
            'id_image_path': f.id_image_path,
            'id_image_url': get_storage_url(f.id_image_path),
            'live_image_path': f.live_image_path,
            'live_image_url': get_storage_url(f.live_image_path),
            'confidence': f.confidence,
            'is_match': f.is_match,
            'verified_at': f.verified_at,
        })

    # Assessment Sessions
    sessions = UserSession.objects.filter(user=u).order_by('-start_time')
    assessment_data = []
    for s in sessions:
        # Get violations for this session
        violations = list(
            Violation.objects.filter(session=s).values('id', 'violation_type', 'timestamp')
        )
        
        # Get Proctoring Snapshots
        from assessment.models import ProctoringSnapshot
        snapshots_raw = ProctoringSnapshot.objects.filter(session=s).order_by('timestamp')
        snapshots = []
        proctoring_timeline = []
        for snap in snapshots_raw:
             snapshots.append({
                 'id': snap.id,
                 'image_url': get_storage_url(snap.image_url),
                 'timestamp': snap.timestamp,
                 'is_violation': snap.is_violation,
                 'violation_reason': snap.violation_reason,
                 'face_count': snap.face_count,
                 'match_score': snap.match_score,
                 'pose_yaw': snap.pose_yaw,
                 'pose_pitch': snap.pose_pitch,
                 'pose_roll': snap.pose_roll,
                 'mouth_state': snap.mouth_state,
                 'audio_detected': snap.audio_detected,
                 'gaze_violation': snap.gaze_violation,
                 'label_detection_results': snap.label_detection_results,
                 'rule_outcomes': snap.rule_outcomes,
             })
             proctoring_timeline.append({
                 'snapshot_id': snap.id,
                 'timestamp': snap.timestamp,
                 'status': 'violation' if snap.is_violation else 'ok',
                 'reason': snap.violation_reason,
                 'face_count': snap.face_count,
                 'match_score': snap.match_score,
                 'pose_yaw': snap.pose_yaw,
                 'pose_pitch': snap.pose_pitch,
                 'pose_roll': snap.pose_roll,
                 'mouth_state': snap.mouth_state,
                 'audio_detected': snap.audio_detected,
                 'gaze_violation': snap.gaze_violation,
                 'active_rules': _active_rule_names(snap.rule_outcomes),
             })

        # Get video responses — bucket: video_questions
        videos_raw = VideoResponse.objects.filter(session=s)
        videos = []
        for v in videos_raw:
            videos.append({
                'id': v.id,
                'question_identifier': v.question_identifier,
                'video_file': v.video_file,
                'video_url': get_storage_url(v.video_file),
                'uploaded_at': v.uploaded_at,
                'ai_transcript': v.ai_transcript,
                'ai_score': v.ai_score,
                'ai_feedback': v.ai_feedback,
                'ai_status': v.ai_status,
            })

        assessment_data.append({
            'id': s.id,
            'test_type': s.test_type.name if s.test_type else None,
            'selected_domains': s.selected_domains,
            'score': s.score,
            'status': s.status,
            'violation_count': s.violation_count,
            'violation_counters': s.violation_counters,
            'start_time': s.start_time.isoformat() if s.start_time else None,
            'end_time': s.end_time.isoformat() if s.end_time else None,
            'question_set': s.question_set,
            'video_question_set': s.video_question_set,
            'violations': violations,
            'proctoring_snapshots': snapshots,
            'proctoring_timeline': proctoring_timeline,
            'proctoring_ai': compute_proctoring_risk_summary(s),
            'video_responses': videos,
        })

   
    auth_docs_raw = AuthConsultantDocument.objects.filter(user=u)
    auth_docs = []
    for d in auth_docs_raw:
        file_url = None
        if d.file:
            file_url = get_storage_url(str(d.file))
        auth_docs.append({
            'id': d.id,
            'document_type': d.document_type,
            'title': d.title,
            'file': str(d.file) if d.file else None,
            'file_url': file_url,
            'uploaded_at': d.uploaded_at,
            'verification_status': getattr(d, 'verification_status', None),
            'gemini_raw_response': getattr(d, 'gemini_raw_response', None),
        })

    
    consultant_docs_raw = ConsultantDocument.objects.filter(user=u)
    consultant_docs = []
    for d in consultant_docs_raw:
        consultant_docs.append({
            'id': d.id,
            'qualification_type': d.qualification_type,
            'document_type': d.document_type,
            'file_path': d.file_path,
            'file_url': get_storage_url(d.file_path),
            'uploaded_at': d.uploaded_at,
            'verification_status': getattr(d, 'verification_status', None),
            'gemini_raw_response': getattr(d, 'gemini_raw_response', None),
        })

    return Response({
        'profile': profile,
        'identity_documents': identity_docs,
        'face_verification': face_records,
        'assessment_sessions': assessment_data,
        'documents': {
            'qualification_documents': auth_docs,
            'consultant_documents': consultant_docs,
        },
    })


from authentication.utils import generate_and_send_credentials

@api_view(['POST'])
@authentication_classes([AdminJWTAuthentication])
@permission_classes([AllowAny])
def generate_credentials(request, user_id):
    """Generate credentials for a consultant and email them."""
    try:
        u = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return Response({'error': 'User not found'}, status=status.HTTP_404_NOT_FOUND)

    success, result = generate_and_send_credentials(u)
    
    if success:
        return Response(result, status=status.HTTP_201_CREATED)
    else:
        status_code = status.HTTP_400_BAD_REQUEST if "already generated" in str(result) else status.HTTP_500_INTERNAL_SERVER_ERROR
        return Response({'error': result}, status=status_code)


@api_view(['GET'])
@authentication_classes([AdminJWTAuthentication])
@permission_classes([AllowAny])
def proctoring_metrics(request):
    """Aggregate proctoring and reliability metrics for admin dashboard cards."""
    range_key = str(request.query_params.get('range', 'all')).strip().lower()
    now_utc = datetime.now(timezone.utc)
    cutoff = None
    if range_key == '7d':
        cutoff = now_utc - timedelta(days=7)
    elif range_key == '30d':
        cutoff = now_utc - timedelta(days=30)
    else:
        range_key = 'all'

    sessions_qs = UserSession.objects.all()
    violations_qs = Violation.objects.all()
    snapshots_qs = ProctoringSnapshot.objects.all()
    if cutoff is not None:
        sessions_qs = sessions_qs.filter(start_time__gte=cutoff)
        violations_qs = violations_qs.filter(timestamp__gte=cutoff)
        snapshots_qs = snapshots_qs.filter(timestamp__gte=cutoff)

    sessions_total = sessions_qs.count()
    sessions_completed = sessions_qs.filter(status='completed').count()
    sessions_flagged = sessions_qs.filter(status='flagged').count()

    snapshot_total = snapshots_qs.count()
    snapshot_violations = snapshots_qs.filter(is_violation=True).count()

    violation_type_rows = (
        violations_qs
        .values('violation_type')
        .annotate(count=Count('id'))
        .order_by('-count')
    )
    violation_type_counts = [
        {'type': row['violation_type'], 'count': row['count']}
        for row in violation_type_rows
    ]

    violation_reason_rows = (
        snapshots_qs
        .filter(is_violation=True)
        .exclude(violation_reason__isnull=True)
        .exclude(violation_reason__exact='')
        .values('violation_reason')
        .annotate(count=Count('id'))
        .order_by('-count')[:10]
    )
    top_violation_reasons = [
        {'reason': row['violation_reason'], 'count': row['count']}
        for row in violation_reason_rows
    ]

    fallback_count = 0
    permission_issue_count = 0
    webcam_issue_count = 0
    mic_issue_count = 0
    detector_issue_count = 0
    detector_mode_counts = {'client': 0, 'server_fallback': 0, 'other': 0}

    for snap in snapshots_qs.iterator():
        outcomes = snap.rule_outcomes or {}
        processing_meta = outcomes.get('processing_meta', {}) if isinstance(outcomes, dict) else {}
        client_caps = outcomes.get('client_capabilities', {}) if isinstance(outcomes, dict) else {}

        detector_mode = str(processing_meta.get('detector_mode', '')).strip().lower()
        if detector_mode == 'client':
            detector_mode_counts['client'] += 1
        elif detector_mode == 'server_fallback':
            detector_mode_counts['server_fallback'] += 1
        else:
            detector_mode_counts['other'] += 1

        if bool(processing_meta.get('server_fallback_applied')) or detector_mode == 'server_fallback':
            fallback_count += 1

        webcam_status = str(client_caps.get('webcam_status', '')).strip().lower()
        mic_status = str(client_caps.get('mic_status', '')).strip().lower()
        detector_status = str(client_caps.get('detector_status', '')).strip().lower()

        webcam_issue = webcam_status in {'denied', 'unsupported', 'unavailable', 'error'}
        mic_issue = mic_status in {'denied', 'unsupported', 'unavailable', 'error'}
        detector_issue = detector_status in {'server_fallback', 'error', 'unsupported'}

        if webcam_issue:
            webcam_issue_count += 1
        if mic_issue:
            mic_issue_count += 1
        if detector_issue:
            detector_issue_count += 1
        if webcam_issue or mic_issue or detector_issue:
            permission_issue_count += 1

    def pct(num, den):
        if den <= 0:
            return 0.0
        return round((num / den) * 100, 2)

    # Proxy metric: violations in sessions that eventually completed.
    completed_session_ids = set(sessions_qs.filter(status='completed').values_list('id', flat=True))
    completed_violations = snapshots_qs.filter(
        is_violation=True,
        session_id__in=completed_session_ids
    ).count()

    return Response({
        'range': range_key,
        'range_start': cutoff.isoformat() if cutoff else None,
        'sessions': {
            'total': sessions_total,
            'completed': sessions_completed,
            'flagged': sessions_flagged,
            'flag_rate_pct': pct(sessions_flagged, sessions_total),
        },
        'snapshots': {
            'total': snapshot_total,
            'violations': snapshot_violations,
            'violation_rate_pct': pct(snapshot_violations, snapshot_total),
            'completed_session_violation_proxy': completed_violations,
        },
        'fallback': {
            'count': fallback_count,
            'rate_pct': pct(fallback_count, snapshot_total),
            'detector_mode_counts': detector_mode_counts,
        },
        'permission_issues': {
            'count': permission_issue_count,
            'rate_pct': pct(permission_issue_count, snapshot_total),
            'webcam_issue_count': webcam_issue_count,
            'mic_issue_count': mic_issue_count,
            'detector_issue_count': detector_issue_count,
        },
        'top_violation_reasons': top_violation_reasons,
        'violation_type_counts': violation_type_counts,
    }, status=status.HTTP_200_OK)

