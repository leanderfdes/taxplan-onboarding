from django.urls import path

from . import views

urlpatterns = [
    path('profile/', views.investment_profile, name='investment-profile'),
    path('goals/', views.investment_goals, name='investment-goals'),
    path('goals/<int:goal_id>/', views.investment_goal_detail, name='investment-goal-detail'),
    path('generate-plan/', views.generate_plan, name='generate-plan'),
    path('plan/', views.get_current_plan, name='current-plan'),
    path('calculator-inputs/<int:goal_id>/', views.calculator_inputs, name='calculator-inputs'),
    path('market-context/', views.market_context, name='market-context'),
    path('alerts/', views.market_alerts, name='market-alerts'),
    path('alerts/<int:alert_id>/read/', views.mark_alert_read, name='mark-alert-read'),
]