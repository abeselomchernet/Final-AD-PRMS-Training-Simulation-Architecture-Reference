from django.urls import include, path
from rest_framework.routers import DefaultRouter
from .views import PushSubscriptionViewSet, TenantNoticeViewSet, VapidPublicKeyView

router = DefaultRouter()
router.register('push-subscriptions', PushSubscriptionViewSet, basename='push-subscriptions')
router.register('notices', TenantNoticeViewSet, basename='notices')

urlpatterns = [
    path('vapid-public-key/', VapidPublicKeyView.as_view(), name='vapid-public-key'),
    path('', include(router.urls)),
]
