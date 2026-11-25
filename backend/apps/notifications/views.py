from django.conf import settings
from django.db.models import Q
from rest_framework import permissions, serializers, status, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView
from apps.common.permissions import (
    IsStaffOrTenantSelfReadOnly,
    IsStaffUser,
    get_active_owner_code_for_request,
)
from .models import SmsDispatchLog, TenantNotice, WebPushSubscription


class VapidPublicKeyView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, _request):
        return Response({'publicKey': getattr(settings, 'VAPID_PUBLIC_KEY', '')})


class PushSubscriptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = WebPushSubscription
        fields = ('id', 'endpoint', 'p256dh', 'auth', 'device_label', 'active', 'created_at')
        read_only_fields = ('id', 'active', 'created_at')


class PushSubscriptionViewSet(viewsets.ModelViewSet):
    serializer_class = PushSubscriptionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return WebPushSubscription.objects.filter(user=self.request.user)

    def create(self, request, *args, **kwargs):
        endpoint = str(request.data.get('endpoint', '')).strip()
        keys = request.data.get('keys') or {}
        p256dh = str(request.data.get('p256dh') or keys.get('p256dh') or '').strip()
        auth = str(request.data.get('auth') or keys.get('auth') or '').strip()
        if not (endpoint and p256dh and auth):
            return Response({'detail': 'endpoint, p256dh, and auth are required.'}, status=status.HTTP_400_BAD_REQUEST)

        owner_code = get_active_owner_code_for_request(request.user, request)
        sub, _ = WebPushSubscription.objects.update_or_create(
            endpoint=endpoint,
            defaults={
                'user': request.user,
                'owner_code': owner_code,
                'p256dh': p256dh,
                'auth': auth,
                'device_label': str(request.data.get('device_label', ''))[:120],
                'active': True,
            },
        )
        return Response(PushSubscriptionSerializer(sub).data, status=status.HTTP_201_CREATED)


class TenantNoticeSerializer(serializers.ModelSerializer):
    class Meta:
        model = TenantNotice
        fields = (
            'id',
            'owner_code',
            'tenant_id_ref',
            'title_en',
            'title_am',
            'body_en',
            'body_am',
            'category',
            'published_by_actor_id',
            'published_at',
        )
        read_only_fields = ('id', 'owner_code', 'published_by_actor_id', 'published_at')


class SmsDispatchLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = SmsDispatchLog
        fields = (
            'id',
            'owner_code',
            'recipient_msisdn',
            'trigger_type',
            'locale',
            'message_body',
            'provider',
            'provider_message_id',
            'delivery_state',
            'dispatched_at',
        )
        read_only_fields = fields


class TenantNoticeViewSet(viewsets.ModelViewSet):
    serializer_class = TenantNoticeSerializer
    permission_classes = [permissions.IsAuthenticated, IsStaffOrTenantSelfReadOnly]

    def get_queryset(self):
        user = self.request.user
        owner_code = get_active_owner_code_for_request(user, self.request)
        qs = TenantNotice.objects.filter(owner_code=owner_code).order_by('-published_at')
        if getattr(user, 'user_type', '') == 'TENANT':
            return qs.filter(Q(tenant_id_ref__isnull=True) | Q(tenant_id_ref=user.tenant_id_ref))
        return qs

    def perform_create(self, serializer):
        owner_code = get_active_owner_code_for_request(self.request.user, self.request)
        serializer.save(owner_code=owner_code, published_by_actor_id=self.request.user.actor_id)


class SmsLogViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = SmsDispatchLogSerializer
    permission_classes = [permissions.IsAuthenticated, IsStaffUser]

    def get_queryset(self):
        owner_code = get_active_owner_code_for_request(self.request.user, self.request)
        return SmsDispatchLog.objects.filter(owner_code=owner_code).order_by('-dispatched_at')
