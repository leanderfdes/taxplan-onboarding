from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.db import IntegrityError
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import AIMarketAlert, InvestmentGoal, InvestmentPlan, InvestmentProfile
from .serializers import AIMarketAlertSerializer, InvestmentGoalSerializer, InvestmentProfileSerializer
from .services.market_data import get_market_context
from .services.plan_generator import _serialize_plan, generate_plan_for_user


@api_view(['GET', 'POST', 'PUT'])
@permission_classes([IsAuthenticated])
def investment_profile(request):
    if request.method == 'GET':
        try:
            profile = InvestmentProfile.objects.get(user=request.user)
            return Response(InvestmentProfileSerializer(profile).data)
        except InvestmentProfile.DoesNotExist:
            return Response({'detail': 'Profile not found'}, status=404)

    if request.method == 'POST':
        serializer = InvestmentProfileSerializer(data=request.data)
        if serializer.is_valid():
            try:
                serializer.save(user=request.user)
                return Response(serializer.data, status=201)
            except IntegrityError:
                profile = get_object_or_404(InvestmentProfile, user=request.user)
                update_serializer = InvestmentProfileSerializer(profile, data=request.data, partial=True)
                if update_serializer.is_valid():
                    update_serializer.save()
                    return Response(update_serializer.data, status=200)
                return Response(update_serializer.errors, status=400)
        return Response(serializer.errors, status=400)

    profile = get_object_or_404(InvestmentProfile, user=request.user)
    serializer = InvestmentProfileSerializer(profile, data=request.data, partial=True)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data)
    return Response(serializer.errors, status=400)


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def investment_goals(request):
    if request.method == 'GET':
        goals = InvestmentGoal.objects.filter(user=request.user, status='active')
        return Response(InvestmentGoalSerializer(goals, many=True).data)

    serializer = InvestmentGoalSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save(user=request.user)
        return Response(serializer.data, status=201)
    return Response(serializer.errors, status=400)


@api_view(['PUT', 'DELETE'])
@permission_classes([IsAuthenticated])
def investment_goal_detail(request, goal_id):
    goal = get_object_or_404(InvestmentGoal, id=goal_id, user=request.user)

    if request.method == 'PUT':
        serializer = InvestmentGoalSerializer(goal, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=400)

    goal.status = 'paused'
    goal.save(update_fields=['status', 'updated_at'])
    return Response({'detail': 'Goal removed'})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def generate_plan(request):
    try:
        plan = generate_plan_for_user(request.user)
        return Response(plan, status=200)
    except ValueError as exc:
        return Response({'detail': str(exc)}, status=400)
    except RuntimeError as exc:
        return Response({'detail': str(exc)}, status=503)
    except Exception:
        return Response({'detail': 'Plan generation failed. Please try again.'}, status=500)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_current_plan(request):
    try:
        plan = InvestmentPlan.objects.get(user=request.user, is_active=True)
        return Response(_serialize_plan(plan, {}))
    except InvestmentPlan.DoesNotExist:
        return Response({'detail': 'No active plan found'}, status=404)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def calculator_inputs(request, goal_id):
    from .models import InvestmentPlanGoal

    try:
        plan = InvestmentPlan.objects.get(user=request.user, is_active=True)
        goal_plan = InvestmentPlanGoal.objects.get(plan=plan, goal_id=goal_id)
        return Response({'calculator_type': goal_plan.calculator_type, 'inputs': goal_plan.calculator_inputs})
    except Exception:
        return Response({'detail': 'Not found'}, status=404)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def market_context(request):
    return Response(get_market_context())


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def market_alerts(request):
    alerts = AIMarketAlert.objects.filter(user=request.user)[:20]
    return Response(AIMarketAlertSerializer(alerts, many=True).data)


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def mark_alert_read(request, alert_id):
    alert = get_object_or_404(AIMarketAlert, id=alert_id, user=request.user)
    alert.is_read = True
    alert.read_at = timezone.now()
    alert.save(update_fields=['is_read', 'read_at'])
    return Response({'detail': 'Marked as read'})
