from django.contrib.auth import get_user_model
from django.db import models

User = get_user_model()


class InvestmentProfile(models.Model):
    EMPLOYMENT_CHOICES = [
        ('salaried', 'Salaried'),
        ('business', 'Business Owner'),
        ('freelancer', 'Freelancer'),
        ('retired', 'Retired'),
    ]
    RISK_CHOICES = [
        ('conservative', 'Conservative'),
        ('moderate', 'Moderate'),
        ('aggressive', 'Aggressive'),
    ]
    TAX_BRACKET_CHOICES = [
        (0, '0%'),
        (5, '5%'),
        (10, '10%'),
        (20, '20%'),
        (30, '30%'),
    ]

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='investment_profile')
    age = models.PositiveIntegerField()
    monthly_income = models.DecimalField(max_digits=12, decimal_places=2)
    monthly_expenses = models.DecimalField(max_digits=12, decimal_places=2)
    existing_emis = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    existing_savings = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    existing_investments = models.JSONField(default=dict)
    has_life_insurance = models.BooleanField(default=False)
    life_insurance_cover = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    has_health_insurance = models.BooleanField(default=False)
    health_insurance_cover = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    employment_type = models.CharField(max_length=20, choices=EMPLOYMENT_CHOICES)
    risk_profile = models.CharField(max_length=20, choices=RISK_CHOICES)
    tax_bracket = models.IntegerField(choices=TAX_BRACKET_CHOICES, default=20)
    number_of_dependents = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    @property
    def investable_surplus(self):
        return float(self.monthly_income) - float(self.monthly_expenses) - float(self.existing_emis)

    def __str__(self):
        return f'{self.user.username} - Investment Profile'


class InvestmentGoal(models.Model):
    GOAL_TYPE_CHOICES = [
        ('retirement', 'Retirement'),
        ('education', "Child's Education"),
        ('marriage', "Child's Marriage"),
        ('home', 'Home Purchase'),
        ('vacation', 'Vacation'),
        ('emergency_fund', 'Emergency Fund'),
        ('business', 'Business Expansion'),
        ('wealth', 'Wealth Creation'),
        ('custom', 'Custom Goal'),
    ]
    PRIORITY_CHOICES = [
        ('high', 'High'),
        ('medium', 'Medium'),
        ('low', 'Low'),
    ]
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('achieved', 'Achieved'),
        ('paused', 'Paused'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='investment_goals')
    goal_type = models.CharField(max_length=20, choices=GOAL_TYPE_CHOICES)
    goal_name = models.CharField(max_length=100)
    target_amount = models.DecimalField(max_digits=14, decimal_places=2)
    target_year = models.PositiveIntegerField()
    current_savings_towards_goal = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    priority = models.CharField(max_length=10, choices=PRIORITY_CHOICES, default='medium')
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='active')
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    @property
    def years_remaining(self):
        from datetime import datetime
        return self.target_year - datetime.now().year

    def __str__(self):
        return f'{self.user.username} - {self.goal_name}'


class InvestmentPlan(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='investment_plans')
    generated_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)

    market_context_snapshot = models.JSONField()

    ai_reasoning = models.TextField()
    market_assessment = models.TextField()
    key_opportunities = models.JSONField(default=list)
    key_risks = models.JSONField(default=list)
    immediate_actions = models.JSONField(default=list)

    asset_allocation = models.JSONField()
    monthly_investment_breakdown = models.JSONField()

    tax_optimization = models.JSONField()

    total_monthly_investment = models.DecimalField(max_digits=12, decimal_places=2)
    total_tax_saving = models.DecimalField(max_digits=10, decimal_places=2)

    def __str__(self):
        return f'{self.user.username} - Plan {self.generated_at.date()}'


class InvestmentPlanGoal(models.Model):
    plan = models.ForeignKey(InvestmentPlan, on_delete=models.CASCADE, related_name='goal_plans')
    goal = models.ForeignKey(InvestmentGoal, on_delete=models.CASCADE)

    required_monthly_sip = models.DecimalField(max_digits=10, decimal_places=2)
    recommended_instrument = models.CharField(max_length=100)
    expected_return_rate = models.DecimalField(max_digits=5, decimal_places=2)
    projected_corpus = models.DecimalField(max_digits=14, decimal_places=2)
    shortfall_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    on_track = models.BooleanField(default=True)
    ai_suggestion = models.TextField()

    calculator_type = models.CharField(max_length=50)
    calculator_inputs = models.JSONField()

    def __str__(self):
        return f'{self.goal.goal_name} - Plan Goal'


class MarketDataCache(models.Model):
    DATA_TYPE_CHOICES = [
        ('nifty', 'Nifty 50'),
        ('sensex', 'Sensex'),
        ('repo_rate', 'RBI Repo Rate'),
        ('inflation', 'CPI Inflation'),
        ('fd_rates', 'Best FD Rates'),
        ('gold_price', 'Gold Price'),
        ('usd_inr', 'USD/INR'),
        ('recent_events', 'Recent Market Events'),
    ]

    data_type = models.CharField(max_length=30, choices=DATA_TYPE_CHOICES, unique=True)
    value = models.JSONField()
    source = models.URLField(blank=True)
    fetched_at = models.DateTimeField(auto_now=True)
    expires_at = models.DateTimeField()

    def is_expired(self):
        from django.utils import timezone
        return timezone.now() > self.expires_at

    def __str__(self):
        return f'{self.data_type} - {self.fetched_at}'


class AIMarketAlert(models.Model):
    ALERT_TYPE_CHOICES = [
        ('opportunity', 'Market Opportunity'),
        ('warning', 'Market Warning'),
        ('rebalance', 'Rebalance Suggestion'),
        ('tax', 'Tax Action Required'),
        ('goal', 'Goal Update'),
    ]

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='market_alerts')
    alert_type = models.CharField(max_length=20, choices=ALERT_TYPE_CHOICES)
    title = models.CharField(max_length=200)
    message = models.TextField()
    action_required = models.TextField(blank=True)
    calculator_link = models.CharField(max_length=100, blank=True)
    generated_at = models.DateTimeField(auto_now_add=True)
    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-generated_at']

    def __str__(self):
        return f'{self.user.username} - {self.alert_type} - {self.generated_at.date()}'