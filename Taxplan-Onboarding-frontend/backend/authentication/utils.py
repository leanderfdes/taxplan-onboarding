import random
import string
from django.core.mail import send_mail
from django.conf import settings
from authentication.models import ConsultantCredential

def generate_and_send_credentials(user):
    """
    Generates unique credentials for the consultant, saves them, and emails the user.
    Returns True if generated and sent successfully, False otherwise or if they already have credentials.
    """
    if hasattr(user, 'credentials'):
        return False, "Credentials already generated for this user"

    try:
        first_name_clean = ''.join(filter(str.isalnum, user.first_name.lower())) if user.first_name else 'consultant'
        if not first_name_clean:
             first_name_clean = 'user'
             
        attempts = 0
        username = ''
        while attempts < 10:
            random_digits = ''.join(random.choices(string.digits, k=4))
            candidate = f"taxplanadvisor_{first_name_clean}_{random_digits}"
            if not ConsultantCredential.objects.filter(username=candidate).exists():
                username = candidate
                break
            attempts += 1
        
        if not username:
             return False, "Failed to generate unique username"

        chars = string.ascii_letters + string.digits + "!@#$%^&*"
        password = ''.join(random.choices(chars, k=10))

        ConsultantCredential.objects.create(
            user=user,
            username=username,
            password=password
        )

        user.set_password(password)
        user.save()

        subject = "Your TaxPlan Advisor Consultant Credentials"
        message = f"Hello {user.get_full_name()},\n\nCongratulations! Your verification is complete.\nHere are your login credentials for the consultant portal:\n\nUsername: {username}\nPassword: {password}\n\nPlease keep these credentials safe and do not share them.\n\nBest regards,\nTaxPlan Advisor Team"
        
        send_mail(
            subject,
            message,
            settings.DEFAULT_FROM_EMAIL or 'admin@taxplanadvisor.com',
            [user.email],
            fail_silently=True,
        )

        return True, {"username": username, "password": password, "message": "Credentials generated and sent successfully"}

    except Exception as e:
        return False, str(e)


def check_and_auto_generate_credentials(user):
    """
    Checks if a user meets all the criteria to automatically receive credentials:
      1. Has not already received credentials.
      2. Has at least one Identity Document and all are 'Verified'.
      3. Has at least one Qualification Document and all are 'Verified'.
      4. Latest completed assessment session has MCQ Score >= 30 and Video Score >= 15.
    If all conditions are met, generates and emails credentials.
    """
    import logging
    logger = logging.getLogger(__name__)

    if hasattr(user, 'credentials'):
        logger.info(f"User {user.id} already has credentials. Skipping auto-gen.")
        return False, "Credentials already generated"

    # 1. Check Document Verification
    from authentication.models import IdentityDocument
    from consultant_documents.models import ConsultantDocument
    
    id_docs = IdentityDocument.objects.filter(user=user)
    qual_docs = ConsultantDocument.objects.filter(user=user)
    
    if not id_docs.exists() or not qual_docs.exists():
        logger.info(f"User {user.id} missing required documents. Skipping auto-gen.")
        return False, "Missing required documents"

    if any(doc.verification_status != 'Verified' for doc in id_docs):
        logger.info(f"User {user.id} has unverified Identity documents. Skipping auto-gen.")
        return False, "Unverified Identity documents"

    if any(getattr(doc, 'verification_status', '') != 'Verified' for doc in qual_docs):
        logger.info(f"User {user.id} has unverified Qualification documents. Skipping auto-gen.")
        return False, "Unverified Qualification documents"

    # 2. Check Latest Assessment Scores
    from assessment.models import UserSession, VideoResponse
    latest_session = UserSession.objects.filter(user=user, status='completed').order_by('-end_time').first()
    
    if not latest_session:
        logger.info(f"User {user.id} has no completed assessment session. Skipping auto-gen.")
        return False, "No completed assessment session"

    mcq_score = latest_session.score or 0
    all_videos = VideoResponse.objects.filter(session=latest_session)
    
    # If any video is not completed (or failed), we shouldn't grant credentials yet
    if any(vr.ai_status != 'completed' for vr in all_videos):
        logger.info(f"User {user.id} has incomplete video evaluations. Skipping auto-gen.")
        return False, "Incomplete video evaluations"

    video_score = sum([vr.ai_score for vr in all_videos if vr.ai_score is not None])
    
    if mcq_score < 30 or video_score < 15:
        logger.info(f"User {user.id} score threshold not met (MCQ: {mcq_score}, Video: {video_score}). Credentials will await manual generation.")
        return False, "Score threshold not met"

    # 3. All conditions met, auto-generate credentials
    logger.info(f"Threshold met and docs verified. Auto-generating credentials for user {user.id}.")
    success, result_msg = generate_and_send_credentials(user)
    if success:
        logger.info(f"Auto-generated credentials successfully for user {user.id}")
        return True, "Auto-generated credentials successfully"
    else:
        logger.error(f"Auto-generation failed for user {user.id}: {result_msg}")
        return False, f"Auto-generation failed: {result_msg}"
