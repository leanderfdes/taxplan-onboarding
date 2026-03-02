from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import TestTypeViewSet, UserSessionViewSet

router = DefaultRouter()
router.register(r'test-types', TestTypeViewSet)
router.register(r'sessions', UserSessionViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
