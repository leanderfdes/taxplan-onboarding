from django.urls import path
from . import views

urlpatterns = [
    path('login/', views.admin_login, name='admin_login'),
    path('consultants/', views.consultant_list, name='admin_consultant_list'),
    path('metrics/', views.proctoring_metrics, name='admin_proctoring_metrics'),
    path('consultants/<uuid:user_id>/', views.consultant_detail, name='admin_consultant_detail'),
    path('consultants/<uuid:user_id>/generate-credentials/', views.generate_credentials, name='generate_credentials'),
]
