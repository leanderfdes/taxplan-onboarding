from django.contrib import admin

from .models import (
    AIMarketAlert,
    InvestmentGoal,
    InvestmentPlan,
    InvestmentPlanGoal,
    InvestmentProfile,
    MarketDataCache,
)


admin.site.register(InvestmentProfile)
admin.site.register(InvestmentGoal)
admin.site.register(InvestmentPlan)
admin.site.register(InvestmentPlanGoal)
admin.site.register(MarketDataCache)
admin.site.register(AIMarketAlert)