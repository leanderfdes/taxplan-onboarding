from rest_framework import serializers

from .models import AIMarketAlert, InvestmentGoal, InvestmentProfile


class InvestmentProfileSerializer(serializers.ModelSerializer):
    investable_surplus = serializers.FloatField(read_only=True)

    class Meta:
        model = InvestmentProfile
        exclude = ['user']


class InvestmentGoalSerializer(serializers.ModelSerializer):
    years_remaining = serializers.IntegerField(read_only=True)

    class Meta:
        model = InvestmentGoal
        exclude = ['user']


class AIMarketAlertSerializer(serializers.ModelSerializer):
    class Meta:
        model = AIMarketAlert
        fields = '__all__'
        read_only_fields = ['user']