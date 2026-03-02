from django.urls import path
from . import views

urlpatterns = [
    path('users/<uuid:user_id>/upload-photo/', views.upload_photo, name='upload-photo'),
    path('users/<uuid:user_id>/verify-face/', views.verify_face, name='verify-face'),
]
