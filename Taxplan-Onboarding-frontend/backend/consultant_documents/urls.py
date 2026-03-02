from django.urls import path
from .views import UploadDocumentView, DocumentListView

urlpatterns = [
    path('upload/', UploadDocumentView.as_view(), name='document-upload'),
    path('list/', DocumentListView.as_view(), name='document-list'),
]
