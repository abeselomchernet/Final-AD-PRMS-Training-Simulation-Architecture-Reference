from django.urls import include, path
from rest_framework.routers import DefaultRouter
from .views import (
    AccountingPeriodViewSet,
    DepositMovementViewSet,
    JournalEntryViewSet,
    LedgerAccountViewSet,
    PeriodCloseApiView,
    PostJournalApiView,
    ReverseJournalApiView,
    TaxWorkpaperApiView,
    ThreeWayDepositCheckApiView,
    TrialBalanceApiView,
)

router = DefaultRouter()
router.register('accounts', LedgerAccountViewSet, basename='ledger-accounts')
router.register('periods', AccountingPeriodViewSet, basename='accounting-periods')
router.register('journals', JournalEntryViewSet, basename='journal-entries')
router.register('deposits/movements', DepositMovementViewSet, basename='deposit-movements')

urlpatterns = [
    path('', include(router.urls)),
    path('trial-balance/', TrialBalanceApiView.as_view(), name='ledger-trial-balance'),
    path('post/', PostJournalApiView.as_view(), name='ledger-post'),
    path('reversals/<uuid:journal_id>/', ReverseJournalApiView.as_view(), name='ledger-reverse'),
    path('periods/close/', PeriodCloseApiView.as_view(), name='ledger-period-close'),
    path('deposits/three-way/', ThreeWayDepositCheckApiView.as_view(), name='ledger-three-way-deposit'),
    path('tax/workpapers/', TaxWorkpaperApiView.as_view(), name='ledger-tax-workpapers'),
]
