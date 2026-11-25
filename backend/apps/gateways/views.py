from decimal import Decimal, InvalidOperation
import time
import uuid
from django.conf import settings
from django.core.cache import cache
from django.db import transaction
from django.utils import timezone
from rest_framework import permissions, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.billing.models import Charge
from apps.billing.services import settle_charge_atomically
from apps.common.permissions import (
    AtomicRlsViewMixin,
    DenyAuditorWrites,
    IsStaffUser,
    OwnerScopedMixin,
    bind_postgres_rls_owner,
    get_active_owner_code_for_request,
)
from apps.notifications.tasks import notify_payment_settled_async
from apps.realtime.publisher import broadcast_owner_event
from .clients import (
    create_arifpay_live_session,
    fetch_arifpay_session_status,
    initiate_telebirr_preorder,
    verify_arifpay_hmac,
    verify_telebirr_rsa,
)
from .models import GatewayTransaction


class GatewayTransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = GatewayTransaction
        fields = [
            'id',
            'tenant',
            'unit',
            'charge',
            'provider',
            'amount_etb',
            'idempotency_nonce',
            'external_session_id',
            'external_reference',
            'phone_or_account',
            'slip_document_key',
            'status',
            'signature_verified',
            'receipt',
            'verified_by_actor_id',
            'verified_at',
            'created_at',
        ]
        read_only_fields = fields


def _validate_replay_and_timestamp(provider_prefix: str, replay_key: str, raw_timestamp: object) -> tuple[bool, str]:
    if raw_timestamp is not None and str(raw_timestamp).strip() != '':
        try:
            ts_val = int(float(str(raw_timestamp)))
            if ts_val > 10**12:
                ts_val = ts_val // 1000
            if abs(int(time.time()) - ts_val) > 300:
                return False, 'Webhook timestamp outside 300-second replay window.'
        except (TypeError, ValueError):
            return False, 'Invalid webhook timestamp header/field.'

    cache_key = f'gw_replay:{provider_prefix}:{replay_key}'
    if cache.get(cache_key):
        return False, 'Duplicate replayed webhook ignored.'
    cache.set(cache_key, True, timeout=900)
    return True, ''


class GatewayInitiateView(AtomicRlsViewMixin, APIView):
    permission_classes = [permissions.IsAuthenticated, DenyAuditorWrites]
    throttle_scope = 'payment_init'

    @transaction.atomic
    def post(self, request):
        charge_id = request.data.get('charge_id')
        provider = str(request.data.get('provider', '')).strip()
        if not charge_id or provider not in GatewayTransaction.Provider.values:
            return Response(
                {'detail': 'Valid charge_id and supported gateway provider are required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if provider in (GatewayTransaction.Provider.ARIFPAY, GatewayTransaction.Provider.TELEBIRR):
            if not getattr(settings, 'ENABLE_LIVE_GATEWAYS', False):
                return Response(
                    {
                        'detail': (
                            'Live online payment gateways are disabled by policy '
                            '(ENABLE_LIVE_GATEWAYS=False). Submit verified offline bank slips or enable gateways after sign-off.'
                        )
                    },
                    status=status.HTTP_503_SERVICE_UNAVAILABLE,
                )

        try:
            amount_etb = Decimal(str(request.data.get('amount_etb', '0')))
        except (InvalidOperation, ValueError, TypeError):
            return Response({'detail': 'Invalid payment amount.'}, status=status.HTTP_400_BAD_REQUEST)

        if amount_etb <= 0:
            return Response({'detail': 'Payment amount must be positive.'}, status=status.HTTP_400_BAD_REQUEST)

        owner_code = get_active_owner_code_for_request(request.user, request)
        bind_postgres_rls_owner(owner_code)

        nonce = request.data.get('nonce') or f'NONCE-{uuid.uuid4().hex[:16]}'
        existing = GatewayTransaction.objects.filter(idempotency_nonce=nonce, owner__code=owner_code).first()
        if existing:
            return Response({'reused': True, 'transaction_id': str(existing.id), 'status': existing.status})

        charge = (
            Charge.objects.select_related('owner', 'tenant', 'unit')
            .filter(id=charge_id, owner__code=owner_code)
            .first()
        )
        if not charge:
            return Response({'detail': 'Charge not found within active owner scope.'}, status=status.HTTP_404_NOT_FOUND)

        if getattr(request.user, 'user_type', '') == 'TENANT' and str(charge.tenant_id) != str(request.user.tenant_id_ref):
            return Response({'detail': 'Forbidden cross-tenant payment.'}, status=status.HTTP_403_FORBIDDEN)

        open_balance = max(Decimal('0.00'), charge.billed_etb - charge.paid_etb)
        if amount_etb > open_balance:
            return Response(
                {'detail': f'Payment amount ETB {amount_etb} exceeds open balance ETB {open_balance}.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        tx = GatewayTransaction.objects.create(
            owner=charge.owner,
            tenant=charge.tenant,
            unit=charge.unit,
            charge=charge,
            provider=provider,
            amount_etb=amount_etb,
            idempotency_nonce=nonce,
            phone_or_account=str(request.data.get('phone_or_account', charge.tenant.phone_msisdn)),
            external_reference=str(request.data.get('reference_number', '')),
            slip_document_key=str(request.data.get('slip_document_key', '')),
        )

        if provider == GatewayTransaction.Provider.ARIFPAY:
            session_resp = create_arifpay_live_session(
                nonce=nonce,
                amount_etb=float(amount_etb),
                msisdn=tx.phone_or_account,
                notify_url=request.build_absolute_uri('/api/v1/gateways/arifpay/webhook/'),
                return_url=str(request.data.get('return_url', '/')),
            )
            tx.external_session_id = str(session_resp.get('data', {}).get('sessionId', ''))
            tx.save(update_fields=['external_session_id'])
            return Response({'transaction_id': str(tx.id), 'reused': False, 'gateway': session_resp})

        if provider == GatewayTransaction.Provider.TELEBIRR:
            pre_resp = initiate_telebirr_preorder(
                merch_order_id=nonce,
                amount_etb=float(amount_etb),
                title=f'Rent {charge.invoice_number}',
                notify_url=request.build_absolute_uri('/api/v1/gateways/telebirr/webhook/'),
                redirect_url=str(request.data.get('return_url', '/')),
            )
            tx.external_session_id = str(pre_resp.get('biz_content', {}).get('prepay_id', ''))
            tx.save(update_fields=['external_session_id'])
            return Response({'transaction_id': str(tx.id), 'reused': False, 'gateway': pre_resp})

        return Response({'transaction_id': str(tx.id), 'status': tx.status}, status=status.HTTP_201_CREATED)


def _finalize_gateway_tx(tx: GatewayTransaction, actor_id: str) -> None:
    if tx.status == GatewayTransaction.Status.VERIFIED and tx.receipt_id:
        return
    receipt = settle_charge_atomically(
        charge_id=str(tx.charge_id),
        amount_etb=tx.amount_etb,
        method=tx.provider,
        reference=tx.external_reference or tx.external_session_id or tx.idempotency_nonce,
        recorded_by_actor_id=actor_id,
    )
    tx.status = GatewayTransaction.Status.VERIFIED
    tx.receipt = receipt
    tx.verified_by_actor_id = actor_id
    tx.verified_at = timezone.now()
    tx.save(update_fields=['status', 'receipt', 'verified_by_actor_id', 'verified_at'])

    notify_payment_settled_async.delay(str(receipt.id))
    broadcast_owner_event(
        owner_code=tx.owner.code,
        event_type='payment:settled',
        data={'transaction_id': str(tx.id), 'receipt_number': receipt.receipt_number, 'amount_etb': str(tx.amount_etb)},
    )


class ArifPayWebhookView(APIView):
    permission_classes = [permissions.AllowAny]

    @transaction.atomic
    def post(self, request):
        if not getattr(settings, 'ENABLE_LIVE_GATEWAYS', False):
            return Response(
                {'detail': 'Live ArifPay webhooks are disabled (ENABLE_LIVE_GATEWAYS=False).'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        sig = request.headers.get('X-Arifpay-Signature', '')
        if not verify_arifpay_hmac(request.body, sig):
            return Response({'detail': 'Invalid webhook signature.'}, status=status.HTTP_403_FORBIDDEN)

        nonce = str(request.data.get('nonce', '')).strip()
        session_id = str(request.data.get('sessionId', '')).strip()
        replay_ok, replay_msg = _validate_replay_and_timestamp(
            'arifpay',
            f'{nonce}:{session_id}:{sig[:16]}',
            request.headers.get('X-Arifpay-Timestamp') or request.data.get('timestamp'),
        )
        if not replay_ok:
            return Response({'detail': replay_msg}, status=status.HTTP_409_CONFLICT)

        tx = (
            GatewayTransaction.objects.select_related('owner')
            .select_for_update()
            .filter(idempotency_nonce=nonce, provider=GatewayTransaction.Provider.ARIFPAY)
            .first()
        )
        if not tx:
            return Response({'detail': 'Transaction not found.'}, status=status.HTTP_404_NOT_FOUND)

        bind_postgres_rls_owner(tx.owner.code)

        verified = fetch_arifpay_session_status(session_id or tx.external_session_id)
        remote_data = verified.get('data', {}) or {}
        if str(remote_data.get('status', '')).upper() == 'COMPLETED':
            try:
                remote_amount = Decimal(str(remote_data.get('totalAmount', tx.amount_etb)))
            except (InvalidOperation, ValueError, TypeError):
                return Response({'detail': 'Malformed gateway verified amount.'}, status=status.HTTP_400_BAD_REQUEST)
            if remote_amount != tx.amount_etb:
                return Response({'detail': 'Verified ArifPay amount mismatch rejected.'}, status=status.HTTP_400_BAD_REQUEST)

            tx.signature_verified = True
            tx.raw_webhook_payload = request.data
            tx.save(update_fields=['signature_verified', 'raw_webhook_payload'])
            _finalize_gateway_tx(tx, actor_id='WEBHOOK-ARIFPAY')

        return Response({'received': True})


class TelebirrWebhookView(APIView):
    permission_classes = [permissions.AllowAny]

    @transaction.atomic
    def post(self, request):
        if not getattr(settings, 'ENABLE_LIVE_GATEWAYS', False):
            return Response(
                {'detail': 'Live Telebirr webhooks are disabled (ENABLE_LIVE_GATEWAYS=False).'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        sig = str(request.data.get('sign', '')).strip()
        if not verify_telebirr_rsa(request.data, sig):
            return Response({'detail': 'Invalid RSA signature.'}, status=status.HTTP_403_FORBIDDEN)

        nonce = str(request.data.get('merch_order_id', '')).strip()
        payment_order_id = str(request.data.get('payment_order_id', '')).strip()
        replay_ok, replay_msg = _validate_replay_and_timestamp(
            'telebirr',
            f'{nonce}:{payment_order_id}',
            request.data.get('timestamp'),
        )
        if not replay_ok:
            return Response({'detail': replay_msg}, status=status.HTTP_409_CONFLICT)

        expected_merch = getattr(settings, 'TELEBIRR_MERCHANT_CODE', '') or ''
        if expected_merch and str(request.data.get('merch_code', '')) != expected_merch:
            return Response({'detail': 'Telebirr merchant code mismatch rejected.'}, status=status.HTTP_403_FORBIDDEN)

        currency = str(request.data.get('trans_currency', 'ETB')).upper()
        if currency != 'ETB':
            return Response({'detail': 'Unsupported settlement currency rejected.'}, status=status.HTTP_400_BAD_REQUEST)

        tx = (
            GatewayTransaction.objects.select_related('owner')
            .select_for_update()
            .filter(idempotency_nonce=nonce, provider=GatewayTransaction.Provider.TELEBIRR)
            .first()
        )
        if not tx:
            return Response({'detail': 'Transaction not found.'}, status=status.HTTP_404_NOT_FOUND)

        bind_postgres_rls_owner(tx.owner.code)

        if 'total_amount' in request.data:
            try:
                paid_amount = Decimal(str(request.data.get('total_amount')))
            except (InvalidOperation, ValueError, TypeError):
                return Response({'detail': 'Invalid Telebirr total_amount.'}, status=status.HTTP_400_BAD_REQUEST)
            if paid_amount != tx.amount_etb:
                return Response({'detail': 'Telebirr webhook amount mismatch rejected.'}, status=status.HTTP_400_BAD_REQUEST)

        if str(request.data.get('trade_status', '')).upper() in ('COMPLETED', 'SUCCESS'):
            tx.signature_verified = True
            tx.raw_webhook_payload = request.data
            tx.external_reference = payment_order_id or tx.external_reference
            tx.save(update_fields=['signature_verified', 'raw_webhook_payload', 'external_reference'])
            _finalize_gateway_tx(tx, actor_id='WEBHOOK-TELEBIRR')

        return Response({'received': True})


class GatewayTransactionViewSet(OwnerScopedMixin, viewsets.ReadOnlyModelViewSet):
    queryset = GatewayTransaction.objects.select_related('owner', 'tenant', 'charge', 'receipt').all()
    serializer_class = GatewayTransactionSerializer
    permission_classes = [permissions.IsAuthenticated, IsStaffUser, DenyAuditorWrites]

    @action(detail=True, methods=['post'], permission_classes=[permissions.IsAuthenticated, IsStaffUser, DenyAuditorWrites])
    @transaction.atomic
    def verify_slip(self, request, pk=None):
        tx = self.get_object()
        if tx.provider != GatewayTransaction.Provider.CBE_SLIP:
            return Response(
                {'detail': 'Manual verify_slip is restricted to offline CBE Transfer Slip transactions.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        _finalize_gateway_tx(tx, actor_id=request.user.actor_id)
        return Response({'status': tx.status, 'receipt_id': str(tx.receipt_id)})
