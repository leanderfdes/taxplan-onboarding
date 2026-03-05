from celery import shared_task
from .services import VideoEvaluator
from assessment.models import VideoResponse
from assessment.risk import compute_proctoring_risk_summary
import logging
from django.utils import timezone

logger = logging.getLogger(__name__)

@shared_task
def evaluate_video_task(video_response_id, question_text):
    """
    Background task to evaluate a video response.
    It transcribes the video using AWS Transcribe and evaluates the transcript via Gemini API.
    """
    logger.info(f"Starting async evaluation for VideoResponse ID: {video_response_id}")
    
    try:
        video_response = VideoResponse.objects.get(id=video_response_id)
    except VideoResponse.DoesNotExist:
        logger.error(f"VideoResponse ID {video_response_id} not found.")
        return

    # Update status to processing (should already be set by view, but good practice here too)
    video_response.ai_status = 'processing'
    video_response.save(update_fields=['ai_status'])

    evaluator = VideoEvaluator()
    try:
        # Run transcription + Gemini evaluation
        result = evaluator.process_video(video_response, question_text)
        
        # Save results
        video_response.ai_transcript = result['transcript']
        video_response.ai_score = result['score']
        video_response.ai_feedback = result['feedback']
        video_response.ai_status = 'completed'
        video_response.save()
        logger.info(f"Successfully evaluated VideoResponse ID {video_response_id}")
        
        # Check if this was the last video response to be evaluated for the session
        session = video_response.session
        all_videos = VideoResponse.objects.filter(session=session)
        if all(vr.ai_status == 'completed' for vr in all_videos):
            logger.info(f"All videos evaluated for session {session.id}. Checking auto-credential condition.")
            video_score = sum([vr.ai_score for vr in all_videos if vr.ai_score is not None])
            mcq_score = session.score or 0
            proctoring_ai = compute_proctoring_risk_summary(session)
            escalation_policy = proctoring_ai.get('escalation_policy', 'clear')
            
            logger.info(
                f"Session {session.id} final scores - MCQ: {mcq_score}, Video: {video_score}, "
                f"ProctoringRisk: {proctoring_ai.get('risk_score')} ({escalation_policy})"
            )

            if escalation_policy == 'auto_flag' and session.status != 'flagged':
                session.status = 'flagged'
                session.end_time = timezone.now()
                session.save(update_fields=['status', 'end_time'])
                logger.warning(f"Session {session.id} auto-flagged by proctoring risk policy.")

            if mcq_score >= 30 and video_score >= 15 and escalation_policy == 'clear':
                user = session.user
                logger.info(f"Threshold met (MCQ: {mcq_score}, Video: {video_score}). Checking auto-credential condition.")
                
                try:
                    from authentication.utils import check_and_auto_generate_credentials
                    success, msg = check_and_auto_generate_credentials(user)
                    if success:
                        logger.info(f"Auto-credentials process succeeded for user {user.id}.")
                    else:
                        logger.info(f"Auto-credentials process returned false for user {user.id}: {msg}")
                except Exception as eval_err:
                    logger.error(f"Error checking auto-credentials for user {user.id}: {eval_err}")
            else:
                logger.info(
                    f"Auto-credential deferred (MCQ: {mcq_score}, Video: {video_score}, "
                    f"Escalation: {escalation_policy}). Awaiting manual review."
                )
                
    except Exception as e:
        logger.error(f"Failed to evaluate VideoResponse ID {video_response_id}: {e}")
        video_response.ai_status = 'failed'
        video_response.save(update_fields=['ai_status'])
        raise e
