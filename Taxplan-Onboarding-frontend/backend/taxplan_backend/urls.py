from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('authentication.urls')),

    path('api/documents/', include('consultant_documents.urls')),
    path('api/face-verification/', include('face_verification.urls')),
    path('api/assessment/', include('assessment.urls')),
    path('api/admin-panel/', include('admin_panel.urls')),
    path('api/ai/', include('ai_analysis.urls')),
]
