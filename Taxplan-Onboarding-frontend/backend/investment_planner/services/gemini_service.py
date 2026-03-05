import json
import logging
from typing import Optional

import google.generativeai as genai
from django.conf import settings

logger = logging.getLogger(__name__)


def generate_investment_plan(user_profile: dict, goals: list, market_data: dict) -> Optional[dict]:
    genai.configure(api_key=settings.GEMINI_API_KEY)

    model = genai.GenerativeModel(
        model_name='gemini-1.5-pro',
        system_instruction='''
You are a SEBI-registered expert Indian financial advisor with 20+ years of experience.
Return only valid JSON.
''',
    )

    investable_surplus = (
        float(user_profile['monthly_income'])
        - float(user_profile['monthly_expenses'])
        - float(user_profile['existing_emis'])
    )

    goals_text = _format_goals_for_prompt(goals)

    prompt = f"""
Generate a complete personalized investment plan for this user.

USER FINANCIAL PROFILE:
Age: {user_profile['age']}
Employment: {user_profile['employment_type']}
Monthly Income: INR {float(user_profile['monthly_income']):,.0f}
Monthly Expenses: INR {float(user_profile['monthly_expenses']):,.0f}
Existing EMIs: INR {float(user_profile['existing_emis']):,.0f}
Monthly Investable Surplus: INR {investable_surplus:,.0f}
Existing Savings: INR {float(user_profile['existing_savings']):,.0f}
Existing Investments: {user_profile.get('existing_investments', {})}
Risk Profile: {user_profile['risk_profile']}
Tax Bracket: {user_profile['tax_bracket']}%
Life Insurance: {'Yes - INR ' + str(user_profile.get('life_insurance_cover', 0)) if user_profile.get('has_life_insurance') else 'No'}
Health Insurance: {'Yes - INR ' + str(user_profile.get('health_insurance_cover', 0)) if user_profile.get('has_health_insurance') else 'No'}
Dependents: {user_profile.get('number_of_dependents', 0)}

GOALS:
{goals_text}

MARKET DATA:
{json.dumps(market_data, ensure_ascii=False)}

Return this JSON keys: market_assessment, key_opportunities, key_risks, prerequisite_checks,
asset_allocation, monthly_investments, goal_plans, tax_optimization, portfolio_rebalancing,
immediate_actions, monthly_review_triggers, total_monthly_investment, total_annual_tax_saving,
plan_confidence_level, plan_notes.
"""

    try:
        response = model.generate_content(
            prompt,
            tools=[genai.Tool(google_search_retrieval=genai.GoogleSearchRetrieval())],
        )

        raw_text = (response.text or '').strip()
        if raw_text.startswith('```'):
            chunks = raw_text.split('```')
            raw_text = chunks[1] if len(chunks) > 1 else raw_text
            if raw_text.startswith('json'):
                raw_text = raw_text[4:]
        raw_text = raw_text.strip()

        plan = json.loads(raw_text)
        logger.info('Investment plan generated successfully')
        return plan

    except json.JSONDecodeError as exc:
        logger.error('Gemini returned invalid JSON: %s', exc)
        logger.error('Raw response sample: %s', (response.text or '')[:500])
        return None
    except Exception as exc:
        logger.error('Gemini plan generation failed: %s', exc)
        return None


def generate_market_alert(user_profile: dict, current_plan: dict, market_data: dict) -> Optional[dict]:
    genai.configure(api_key=settings.GEMINI_API_KEY)
    model = genai.GenerativeModel('gemini-1.5-pro')

    prompt = f"""
A user has the following investment plan and current market conditions have changed.
Determine if an alert should be sent.

USER RISK PROFILE: {user_profile['risk_profile']}
USER TAX BRACKET: {user_profile['tax_bracket']}%

CURRENT ACTIVE PLAN SUMMARY:
- Asset Allocation: {current_plan.get('asset_allocation', {})}
- Monthly Investment: INR {current_plan.get('total_monthly_investment', 0)}
- Plan Generated: {current_plan.get('generated_at', 'Unknown')}

CURRENT MARKET CONDITIONS:
{json.dumps(market_data, ensure_ascii=False)}

If market conditions changed significantly, return:
{
  "send_alert": true,
  "alert_type": "opportunity|warning|rebalance|tax",
  "title": "Short alert title",
  "message": "why it matters",
  "action_required": "specific action",
  "calculator_link": "/client/calculators/sip",
  "urgency": "high|medium|low"
}
Else return {"send_alert": false}.
"""

    try:
        response = model.generate_content(
            prompt,
            tools=[genai.Tool(google_search_retrieval=genai.GoogleSearchRetrieval())],
        )
        raw_text = (response.text or '').strip()
        return json.loads(raw_text)
    except Exception as exc:
        logger.error('Alert generation failed: %s', exc)
        return None


def _format_goals_for_prompt(goals: list) -> str:
    if not goals:
        return 'No specific goals set - general wealth creation'

    formatted = []
    for i, goal in enumerate(goals, 1):
        formatted.append(
            f"{i}. {goal['goal_name']} | Target: INR {float(goal['target_amount']):,.0f} | "
            f"By: {goal['target_year']} ({goal.get('years_remaining', '?')} years) | "
            f"Current Savings: INR {float(goal.get('current_savings_towards_goal', 0)):,.0f} | "
            f"Priority: {goal['priority']}"
        )
    return '\n'.join(formatted)