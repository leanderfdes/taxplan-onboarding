from django.urls import path
from . import views

urlpatterns = [
    path('google/', views.google_auth, name='google_auth'),
    path('onboarding/', views.complete_onboarding, name='complete_onboarding'),
    path('profile/', views.get_user_profile, name='get_user_profile'),
    path('accept-declaration/', views.accept_declaration, name='accept_declaration'),
    path('logout/', views.logout, name='logout'),
    path('health/', views.health_check, name='health_check'),

    path('documents/upload/', views.upload_document, name='upload_document'),
    path('documents/list/', views.get_user_documents, name='get_user_documents'),
    path('identity/upload-doc/', views.upload_identity_document, name='upload_identity_document'),
]
