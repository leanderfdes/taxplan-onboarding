from celery import shared_task
from .services import VideoEvaluator
from assessment.models import VideoResponse
import logging

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
            
            logger.info(f"Session {session.id} final scores - MCQ: {mcq_score}, Video: {video_score}")
            if mcq_score >= 30 and video_score >= 15:
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
                logger.info(f"Threshold not met (MCQ: {mcq_score}, Video: {video_score}). Credentials will await manual generation.")
                
    except Exception as e:
        logger.error(f"Failed to evaluate VideoResponse ID {video_response_id}: {e}")
        video_response.ai_status = 'failed'
        video_response.save(update_fields=['ai_status'])
        raise e
