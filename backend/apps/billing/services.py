from decimal import Decimal
import uuid
from django.conf import settings
from django.db import transaction
from django.utils import timezone
from apps.governance.models import ErcaVerificationGate
from .models import Charge, PaymentReceipt, ReceiptAllocation


@transaction.atomic
def settle_charge_atomically(
    *,
    charge_id: str,
    amount_etb: Decimal,
    method: str,
    reference: str,
    recorded_by_actor_id: str,
) -> PaymentReceipt:
    """Locks the target Charge row to prevent concurrent over-settlement across webhook retries."""
    charge = Charge.objects.select_for_update().select_related('owner', 'tenant', 'unit').get(id=charge_id)
    open_balance = max(Decimal('0.00'), charge.billed_etb - charge.paid_etb)
    if amount_etb <= 0:
        raise ValueError('Settlement amount must be positive.')
    if amount_etb > open_balance:
        raise ValueError(f'Settlement ETB {amount_etb} exceeds open balance ETB {open_balance}.')

    erca_verified = (
        getattr(settings, 'ENABLE_LIVE_TAX_INVOICING', False)
        and ErcaVerificationGate.objects.filter(owner=charge.owner, live_tax_enabled=True).exists()
    )

    receipt = PaymentReceipt.objects.create(
        owner=charge.owner,
        receipt_number=f'RCT-{timezone.now():%Y%m%d}-{uuid.uuid4().hex[:6].upper()}',
        tenant=charge.tenant,
        unit=charge.unit,
        payment_date=timezone.now(),
        amount_etb=amount_etb,
        method=method,
        reference=reference,
        recorded_by_actor_id=recorded_by_actor_id,
        fiscal_mode=(
            PaymentReceipt.FiscalMode.FISCAL_ACTIVE
            if erca_verified
            else PaymentReceipt.FiscalMode.PROVISIONAL_NON_FISCAL
        ),
    )

    ReceiptAllocation.objects.create(receipt=receipt, charge=charge, allocated_etb=amount_etb)
    charge.paid_etb = charge.paid_etb + amount_etb
    if charge.paid_etb >= charge.billed_etb:
        charge.status = Charge.Status.PAID
    else:
        charge.status = Charge.Status.PARTIALLY_PAID
    charge.save(update_fields=['paid_etb', 'status'])
    return receipt
