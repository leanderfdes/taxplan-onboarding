from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='InvestmentGoal',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('goal_type', models.CharField(choices=[('retirement', 'Retirement'), ('education', "Child's Education"), ('marriage', "Child's Marriage"), ('home', 'Home Purchase'), ('vacation', 'Vacation'), ('emergency_fund', 'Emergency Fund'), ('business', 'Business Expansion'), ('wealth', 'Wealth Creation'), ('custom', 'Custom Goal')], max_length=20)),
                ('goal_name', models.CharField(max_length=100)),
                ('target_amount', models.DecimalField(decimal_places=2, max_digits=14)),
                ('target_year', models.PositiveIntegerField()),
                ('current_savings_towards_goal', models.DecimalField(decimal_places=2, default=0, max_digits=14)),
                ('priority', models.CharField(choices=[('high', 'High'), ('medium', 'Medium'), ('low', 'Low')], default='medium', max_length=10)),
                ('status', models.CharField(choices=[('active', 'Active'), ('achieved', 'Achieved'), ('paused', 'Paused')], default='active', max_length=10)),
                ('notes', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='investment_goals', to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.CreateModel(
            name='InvestmentPlan',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('generated_at', models.DateTimeField(auto_now_add=True)),
                ('is_active', models.BooleanField(default=True)),
                ('market_context_snapshot', models.JSONField()),
                ('ai_reasoning', models.TextField()),
                ('market_assessment', models.TextField()),
                ('key_opportunities', models.JSONField(default=list)),
                ('key_risks', models.JSONField(default=list)),
                ('immediate_actions', models.JSONField(default=list)),
                ('asset_allocation', models.JSONField()),
                ('monthly_investment_breakdown', models.JSONField()),
                ('tax_optimization', models.JSONField()),
                ('total_monthly_investment', models.DecimalField(decimal_places=2, max_digits=12)),
                ('total_tax_saving', models.DecimalField(decimal_places=2, max_digits=10)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='investment_plans', to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.CreateModel(
            name='InvestmentProfile',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('age', models.PositiveIntegerField()),
                ('monthly_income', models.DecimalField(decimal_places=2, max_digits=12)),
                ('monthly_expenses', models.DecimalField(decimal_places=2, max_digits=12)),
                ('existing_emis', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('existing_savings', models.DecimalField(decimal_places=2, default=0, max_digits=14)),
                ('existing_investments', models.JSONField(default=dict)),
                ('has_life_insurance', models.BooleanField(default=False)),
                ('life_insurance_cover', models.DecimalField(decimal_places=2, default=0, max_digits=14)),
                ('has_health_insurance', models.BooleanField(default=False)),
                ('health_insurance_cover', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('employment_type', models.CharField(choices=[('salaried', 'Salaried'), ('business', 'Business Owner'), ('freelancer', 'Freelancer'), ('retired', 'Retired')], max_length=20)),
                ('risk_profile', models.CharField(choices=[('conservative', 'Conservative'), ('moderate', 'Moderate'), ('aggressive', 'Aggressive')], max_length=20)),
                ('tax_bracket', models.IntegerField(choices=[(0, '0%'), (5, '5%'), (10, '10%'), (20, '20%'), (30, '30%')], default=20)),
                ('number_of_dependents', models.PositiveIntegerField(default=0)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('user', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='investment_profile', to=settings.AUTH_USER_MODEL)),
            ],
        ),
        migrations.CreateModel(
            name='MarketDataCache',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('data_type', models.CharField(choices=[('nifty', 'Nifty 50'), ('sensex', 'Sensex'), ('repo_rate', 'RBI Repo Rate'), ('inflation', 'CPI Inflation'), ('fd_rates', 'Best FD Rates'), ('gold_price', 'Gold Price'), ('usd_inr', 'USD/INR'), ('recent_events', 'Recent Market Events')], max_length=30, unique=True)),
                ('value', models.JSONField()),
                ('source', models.URLField(blank=True)),
                ('fetched_at', models.DateTimeField(auto_now=True)),
                ('expires_at', models.DateTimeField()),
            ],
        ),
        migrations.CreateModel(
            name='InvestmentPlanGoal',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('required_monthly_sip', models.DecimalField(decimal_places=2, max_digits=10)),
                ('recommended_instrument', models.CharField(max_length=100)),
                ('expected_return_rate', models.DecimalField(decimal_places=2, max_digits=5)),
                ('projected_corpus', models.DecimalField(decimal_places=2, max_digits=14)),
                ('shortfall_amount', models.DecimalField(decimal_places=2, default=0, max_digits=14)),
                ('on_track', models.BooleanField(default=True)),
                ('ai_suggestion', models.TextField()),
                ('calculator_type', models.CharField(max_length=50)),
                ('calculator_inputs', models.JSONField()),
                ('goal', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to='investment_planner.investmentgoal')),
                ('plan', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='goal_plans', to='investment_planner.investmentplan')),
            ],
        ),
        migrations.CreateModel(
            name='AIMarketAlert',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('alert_type', models.CharField(choices=[('opportunity', 'Market Opportunity'), ('warning', 'Market Warning'), ('rebalance', 'Rebalance Suggestion'), ('tax', 'Tax Action Required'), ('goal', 'Goal Update')], max_length=20)),
                ('title', models.CharField(max_length=200)),
                ('message', models.TextField()),
                ('action_required', models.TextField(blank=True)),
                ('calculator_link', models.CharField(blank=True, max_length=100)),
                ('generated_at', models.DateTimeField(auto_now_add=True)),
                ('is_read', models.BooleanField(default=False)),
                ('read_at', models.DateTimeField(blank=True, null=True)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='market_alerts', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-generated_at'],
            },
        ),
    ]
