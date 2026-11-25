from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path
from apps.gateways.views import ArifPayWebhookView, TelebirrWebhookView


def health_check(_request):
    return JsonResponse({'ok': True, 'service': 'ad-prms-django-api', 'version': 'v1'})


urlpatterns = [
    path('admin/', admin.site.urls),
    path('prod/', include('apps.portfolio.ui_urls')),
    path('api/v1/health/', health_check, name='api-health'),
    path('api/v1/auth/', include('apps.accounts.urls')),
    path('api/v1/portfolio/', include('apps.portfolio.urls')),
    path('api/v1/billing/', include('apps.billing.urls')),
    path('api/v1/gateways/webhooks/arifpay/', ArifPayWebhookView.as_view(), name='arifpay-webhook-v1'),
    path('api/v1/gateways/webhooks/telebirr/', TelebirrWebhookView.as_view(), name='telebirr-webhook-v1'),
    path('api/v1/gateways/', include('apps.gateways.urls')),
    path('api/v1/documents/', include('apps.documents.urls')),
    path('api/v1/maintenance/', include('apps.maintenance.urls')),
    path('api/v1/notifications/', include('apps.notifications.urls')),
    path('api/v1/governance/', include('apps.governance.urls')),
    path('api/v1/ledger/', include('apps.ledger.urls')),
]
