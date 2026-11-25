from django.urls import path
from .views import ConfirmUploadView, PresignUploadView, SignedDownloadView

urlpatterns = [
    path('presign-upload/', PresignUploadView.as_view(), name='doc-presign-upload'),
    path('confirm/', ConfirmUploadView.as_view(), name='doc-confirm'),
    path('<uuid:pk>/download-url/', SignedDownloadView.as_view(), name='doc-download-url'),
]
