from django.urls import include, path
from rest_framework.routers import DefaultRouter
from .views import ChargeViewSet, PaymentReceiptViewSet

router = DefaultRouter()
router.register('charges', ChargeViewSet, basename='charges')
router.register('receipts', PaymentReceiptViewSet, basename='receipts')

urlpatterns = [
    path('', include(router.urls)),
]
