from decimal import Decimal
import uuid
from django.db import models
from apps.portfolio.models import Lease, OwnerEntity, TenantProfile, Unit


class Charge(models.Model):
    class Status(models.TextChoices):
        OPEN = 'Open', 'Open'
        PARTIALLY_PAID = 'Partially Paid', 'Partially Paid'
        OVERDUE = 'Overdue', 'Overdue'
        PAID = 'Paid', 'Paid'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(OwnerEntity, on_delete=models.PROTECT, related_name='charges')
    lease = models.ForeignKey(Lease, on_delete=models.PROTECT, related_name='charges')
    tenant = models.ForeignKey(TenantProfile, on_delete=models.PROTECT, related_name='charges')
    unit = models.ForeignKey(Unit, on_delete=models.PROTECT, related_name='charges')
    period = models.CharField(max_length=32)
    invoice_number = models.CharField(max_length=64, unique=True)
    due_date = models.DateField()
    billed_etb = models.DecimalField(max_digits=14, decimal_places=2)
    paid_etb = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    status = models.CharField(max_length=24, choices=Status.choices, default=Status.OPEN)

    class Meta:
        indexes = [models.Index(fields=['owner', 'tenant', 'status'], name='bill_chg_own_ten_stat_idx')]


class PaymentReceipt(models.Model):
    class FiscalMode(models.TextChoices):
        PROVISIONAL_NON_FISCAL = 'PROVISIONAL_NON_FISCAL', 'Provisional — Pending ERCA Tax Verification'
        FISCAL_ACTIVE = 'FISCAL_ACTIVE', 'Fiscal Receipt (ERCA Verified)'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(OwnerEntity, on_delete=models.PROTECT, related_name='receipts')
    receipt_number = models.CharField(max_length=64, unique=True)
    tenant = models.ForeignKey(TenantProfile, on_delete=models.PROTECT, related_name='receipts')
    unit = models.ForeignKey(Unit, on_delete=models.PROTECT, related_name='receipts')
    payment_date = models.DateTimeField()
    amount_etb = models.DecimalField(max_digits=14, decimal_places=2)
    method = models.CharField(max_length=48)
    reference = models.CharField(max_length=128)
    recorded_by_actor_id = models.CharField(max_length=64)
    document_state = models.CharField(max_length=32, default='Issued')
    fiscal_mode = models.CharField(
        max_length=32,
        choices=FiscalMode.choices,
        default=FiscalMode.PROVISIONAL_NON_FISCAL,
    )
    created_at = models.DateTimeField(auto_now_add=True)


class ReceiptAllocation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    receipt = models.ForeignKey(PaymentReceipt, on_delete=models.CASCADE, related_name='allocations')
    charge = models.ForeignKey(Charge, on_delete=models.PROTECT, related_name='allocations')
    allocated_etb = models.DecimalField(max_digits=14, decimal_places=2)
