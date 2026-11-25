from django.urls import include, path
from rest_framework.routers import DefaultRouter
from .views import ArifPayWebhookView, GatewayInitiateView, GatewayTransactionViewSet, TelebirrWebhookView

router = DefaultRouter()
router.register('transactions', GatewayTransactionViewSet, basename='gateway-transactions')

urlpatterns = [
    path('initiate/', GatewayInitiateView.as_view(), name='gateway-initiate'),
    path('arifpay/webhook/', ArifPayWebhookView.as_view(), name='arifpay-webhook'),
    path('telebirr/webhook/', TelebirrWebhookView.as_view(), name='telebirr-webhook'),
    path('', include(router.urls)),
]
