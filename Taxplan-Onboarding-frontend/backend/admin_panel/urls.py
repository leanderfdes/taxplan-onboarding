from django.urls import path
from . import views

urlpatterns = [
    path('login/', views.admin_login, name='admin_login'),
    path('consultants/', views.consultant_list, name='admin_consultant_list'),
    path('consultants/<uuid:user_id>/', views.consultant_detail, name='admin_consultant_detail'),
    path('consultants/<uuid:user_id>/generate-credentials/', views.generate_credentials, name='generate_credentials'),
]
