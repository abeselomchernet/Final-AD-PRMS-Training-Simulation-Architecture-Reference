from rest_framework import serializers, viewsets
from apps.common.permissions import IsStaffOrTenantSelfReadOnly, OwnerScopedMixin
from .models import Charge, PaymentReceipt


class ChargeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Charge
        fields = (
            'id',
            'owner',
            'lease',
            'tenant',
            'unit',
            'period',
            'invoice_number',
            'due_date',
            'billed_etb',
            'paid_etb',
            'status',
        )
        read_only_fields = ('id', 'owner', 'paid_etb', 'status')


class PaymentReceiptSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentReceipt
        fields = (
            'id',
            'owner',
            'receipt_number',
            'tenant',
            'unit',
            'payment_date',
            'amount_etb',
            'method',
            'reference',
            'recorded_by_actor_id',
            'document_state',
            'fiscal_mode',
            'created_at',
        )
        read_only_fields = ('id', 'owner', 'recorded_by_actor_id', 'fiscal_mode', 'created_at')


class ChargeViewSet(OwnerScopedMixin, viewsets.ReadOnlyModelViewSet):
    queryset = Charge.objects.select_related('owner', 'tenant', 'unit', 'lease').all()
    serializer_class = ChargeSerializer
    permission_classes = [IsStaffOrTenantSelfReadOnly]
    tenant_field = 'tenant_id'


class PaymentReceiptViewSet(OwnerScopedMixin, viewsets.ReadOnlyModelViewSet):
    queryset = PaymentReceipt.objects.select_related('owner', 'tenant', 'unit').all()
    serializer_class = PaymentReceiptSerializer
    permission_classes = [IsStaffOrTenantSelfReadOnly]
    tenant_field = 'tenant_id'
