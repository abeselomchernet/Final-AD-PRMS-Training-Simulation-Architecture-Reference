from django.urls import include, path
from rest_framework.routers import DefaultRouter
from .views import ApprovalRequestViewSet, AuditEventViewSet, BackupSnapshotViewSet, ErcaGateStatusView, TaxRuleViewSet

router = DefaultRouter()
router.register('approvals', ApprovalRequestViewSet, basename='approvals')
router.register('tax-rules', TaxRuleViewSet, basename='tax-rules')
router.register('audit-events', AuditEventViewSet, basename='audit-events')
router.register('backups', BackupSnapshotViewSet, basename='backups')

urlpatterns = [
    path('erca-gate/', ErcaGateStatusView.as_view(), name='erca-gate-status'),
    path('', include(router.urls)),
]
