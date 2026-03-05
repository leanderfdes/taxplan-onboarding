import logging
import json

from django.db import transaction
from django.utils import timezone

from ..models import InvestmentGoal, InvestmentPlan, InvestmentPlanGoal, InvestmentProfile
from .gemini_service import generate_investment_plan
from .market_data import get_market_context

logger = logging.getLogger(__name__)


def generate_plan_for_user(user) -> dict:
    try:
        profile = InvestmentProfile.objects.get(user=user)
    except InvestmentProfile.DoesNotExist as exc:
        raise ValueError('User has no investment profile. Complete profile setup first.') from exc

    goals = list(InvestmentGoal.objects.filter(user=user, status='active').values())

    current_year = timezone.now().year
    for goal in goals:
        goal['years_remaining'] = goal['target_year'] - current_year

    market_data = get_market_context()

    profile_dict = {
        'age': profile.age,
        'monthly_income': str(profile.monthly_income),
        'monthly_expenses': str(profile.monthly_expenses),
        'existing_emis': str(profile.existing_emis),
        'existing_savings': str(profile.existing_savings),
        'existing_investments': profile.existing_investments,
        'has_life_insurance': profile.has_life_insurance,
        'life_insurance_cover': str(profile.life_insurance_cover),
        'has_health_insurance': profile.has_health_insurance,
        'health_insurance_cover': str(profile.health_insurance_cover),
        'employment_type': profile.employment_type,
        'risk_profile': profile.risk_profile,
        'tax_bracket': profile.tax_bracket,
        'number_of_dependents': profile.number_of_dependents,
    }

    logger.info('Generating investment plan for user %s', user.id)
    ai_plan = generate_investment_plan(profile_dict, goals, market_data)

    if not ai_plan:
        raise RuntimeError('AI plan generation failed. Please try again.')

    with transaction.atomic():
        InvestmentPlan.objects.filter(user=user, is_active=True).update(is_active=False)

        plan = InvestmentPlan.objects.create(
            user=user,
            market_context_snapshot=market_data,
            ai_reasoning=json.dumps(ai_plan),
            market_assessment=ai_plan.get('market_assessment', ''),
            key_opportunities=ai_plan.get('key_opportunities', []),
            key_risks=ai_plan.get('key_risks', []),
            immediate_actions=ai_plan.get('immediate_actions', []),
            asset_allocation=ai_plan.get('asset_allocation', {}),
            monthly_investment_breakdown=ai_plan.get('monthly_investments', []),
            tax_optimization=ai_plan.get('tax_optimization', {}),
            total_monthly_investment=ai_plan.get('total_monthly_investment', 0),
            total_tax_saving=ai_plan.get('total_annual_tax_saving', 0),
            is_active=True,
        )

        alt_map = {}
        for goal_plan in ai_plan.get('goal_plans', []):
            goal_id = goal_plan.get('goal_id')
            try:
                goal = InvestmentGoal.objects.get(id=goal_id, user=user)
                InvestmentPlanGoal.objects.create(
                    plan=plan,
                    goal=goal,
                    required_monthly_sip=goal_plan.get('required_monthly_sip', 0),
                    recommended_instrument=goal_plan.get('recommended_instrument', ''),
                    expected_return_rate=goal_plan.get('expected_return_rate', 0),
                    projected_corpus=goal_plan.get('projected_corpus', 0),
                    shortfall_amount=goal_plan.get('shortfall_amount', 0),
                    on_track=goal_plan.get('on_track', True),
                    ai_suggestion=goal_plan.get('ai_suggestion', ''),
                    calculator_type=goal_plan.get('calculator_type', 'SIP'),
                    calculator_inputs=goal_plan.get('calculator_inputs', {}),
                )
                alt_map[goal.id] = goal_plan.get('alternative_calculator')
            except InvestmentGoal.DoesNotExist:
                logger.warning('Goal %s not found for user %s', goal_id, user.id)
                continue

    logger.info('Plan %s saved for user %s', plan.id, user.id)
    return _serialize_plan(plan, ai_plan, alt_map)


def _serialize_plan(plan: InvestmentPlan, ai_plan: dict, alt_map: dict | None = None) -> dict:
    if not ai_plan:
        try:
            ai_plan = json.loads(plan.ai_reasoning or '{}')
        except json.JSONDecodeError:
            ai_plan = {}
    alt_map = alt_map or {}
    goal_plans = []
    for gp in plan.goal_plans.select_related('goal').all():
        goal_plans.append(
            {
                'goal_id': gp.goal.id,
                'goal_name': gp.goal.goal_name,
                'goal_type': gp.goal.goal_type,
                'target_amount': str(gp.goal.target_amount),
                'target_year': gp.goal.target_year,
                'years_remaining': gp.goal.years_remaining,
                'required_monthly_sip': str(gp.required_monthly_sip),
                'recommended_instrument': gp.recommended_instrument,
                'expected_return_rate': str(gp.expected_return_rate),
                'projected_corpus': str(gp.projected_corpus),
                'shortfall_amount': str(gp.shortfall_amount),
                'on_track': gp.on_track,
                'ai_suggestion': gp.ai_suggestion,
                'calculator_type': gp.calculator_type,
                'calculator_inputs': gp.calculator_inputs,
                'alternative_calculator': alt_map.get(gp.goal.id),
            }
        )

    return {
        'plan_id': plan.id,
        'generated_at': plan.generated_at.isoformat(),
        'market_assessment': plan.market_assessment,
        'key_opportunities': plan.key_opportunities,
        'key_risks': plan.key_risks,
        'immediate_actions': plan.immediate_actions,
        'asset_allocation': plan.asset_allocation,
        'monthly_investments': plan.monthly_investment_breakdown,
        'goal_plans': goal_plans,
        'tax_optimization': plan.tax_optimization,
        'total_monthly_investment': str(plan.total_monthly_investment),
        'total_tax_saving': str(plan.total_tax_saving),
        'prerequisite_checks': ai_plan.get('prerequisite_checks', {}),
        'portfolio_rebalancing': ai_plan.get('portfolio_rebalancing', {}),
        'monthly_review_triggers': ai_plan.get('monthly_review_triggers', []),
        'market_context': plan.market_context_snapshot,
    }
