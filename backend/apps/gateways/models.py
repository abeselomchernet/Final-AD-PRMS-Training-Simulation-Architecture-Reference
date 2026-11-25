import uuid
from django.db import models
from apps.billing.models import Charge, PaymentReceipt
from apps.portfolio.models import OwnerEntity, TenantProfile, Unit


class GatewayTransaction(models.Model):
    class Provider(models.TextChoices):
        ARIFPAY = 'ArifPay Checkout', 'ArifPay Checkout'
        TELEBIRR = 'Telebirr Merchant', 'Telebirr Merchant'
        CBE_SLIP = 'CBE Transfer Slip', 'CBE Transfer Slip'

    class Status(models.TextChoices):
        PENDING = 'Pending Verification', 'Pending Verification'
        VERIFIED = 'Verified', 'Verified'
        REJECTED = 'Rejected', 'Rejected'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(OwnerEntity, on_delete=models.PROTECT, related_name='gateway_transactions')
    tenant = models.ForeignKey(TenantProfile, on_delete=models.PROTECT, related_name='gateway_transactions')
    unit = models.ForeignKey(Unit, on_delete=models.PROTECT)
    charge = models.ForeignKey(Charge, on_delete=models.PROTECT, related_name='gateway_transactions')
    provider = models.CharField(max_length=32, choices=Provider.choices)
    amount_etb = models.DecimalField(max_digits=14, decimal_places=2)
    idempotency_nonce = models.CharField(max_length=128, unique=True)
    external_session_id = models.CharField(max_length=128, blank=True, db_index=True)
    external_reference = models.CharField(max_length=128, blank=True)
    phone_or_account = models.CharField(max_length=64, blank=True)
    slip_document_key = models.CharField(max_length=512, blank=True)
    status = models.CharField(max_length=24, choices=Status.choices, default=Status.PENDING)
    signature_verified = models.BooleanField(default=False)
    raw_webhook_payload = models.JSONField(null=True, blank=True)
    receipt = models.ForeignKey(PaymentReceipt, null=True, blank=True, on_delete=models.SET_NULL)
    verified_by_actor_id = models.CharField(max_length=64, blank=True)
    verified_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
