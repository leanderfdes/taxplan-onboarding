import logging

from celery import shared_task
from django.core.cache import cache

from .models import AIMarketAlert, InvestmentPlan
from .services.gemini_service import generate_market_alert
from .services.market_data import get_market_context

logger = logging.getLogger(__name__)


@shared_task(name='investment_planner.generate_daily_alerts')
def generate_daily_alerts():
    logger.info('Starting daily alert generation')

    cache.delete('market_context_full')
    market_data = get_market_context()

    active_plans = InvestmentPlan.objects.filter(is_active=True).select_related('user', 'user__investment_profile')

    alerts_created = 0
    for plan in active_plans:
        try:
            user = plan.user
            profile = user.investment_profile

            profile_dict = {
                'risk_profile': profile.risk_profile,
                'tax_bracket': profile.tax_bracket,
                'age': profile.age,
            }

            plan_dict = {
                'asset_allocation': plan.asset_allocation,
                'total_monthly_investment': str(plan.total_monthly_investment),
                'generated_at': plan.generated_at.isoformat(),
            }

            alert_data = generate_market_alert(profile_dict, plan_dict, market_data)

            if alert_data and alert_data.get('send_alert'):
                AIMarketAlert.objects.create(
                    user=user,
                    alert_type=alert_data.get('alert_type', 'warning'),
                    title=alert_data.get('title', 'Market Update'),
                    message=alert_data.get('message', ''),
                    action_required=alert_data.get('action_required', ''),
                    calculator_link=alert_data.get('calculator_link', ''),
                )
                alerts_created += 1
                logger.info('Alert created for user %s', user.id)

        except Exception as exc:
            logger.error('Alert generation failed for plan %s: %s', plan.id, exc)
            continue

    logger.info('Daily alerts complete. %s alerts created.', alerts_created)
    return f'{alerts_created} alerts generated'


@shared_task(name='investment_planner.refresh_market_cache')
def refresh_market_cache():
    cache.delete('market_context_full')
    market_data = get_market_context()
    logger.info('Market cache refreshed. Nifty: %s', market_data.get('nifty', {}).get('level'))
    return 'Market cache refreshed'