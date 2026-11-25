from celery import shared_task
from django.db import transaction
from django.utils import timezone
from apps.accounts.models import UserAccount
from apps.billing.models import Charge, PaymentReceipt
from .push_service import send_web_push_to_user
from .sms_gateway import send_bilingual_sms


@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def notify_payment_settled_async(self, receipt_id: str) -> None:
    try:
        with transaction.atomic():
            receipt = PaymentReceipt.objects.select_related('owner', 'tenant', 'unit').filter(id=receipt_id).first()
            if not receipt:
                return

            body_en = f'AD-PRMS: Payment ETB {receipt.amount_etb} confirmed ({receipt.receipt_number}) for {receipt.unit.code}.'
            send_bilingual_sms(
                msisdn=receipt.tenant.phone_msisdn,
                body=body_en,
                owner_code=receipt.owner.code,
                trigger_type='Payment Confirmed',
                locale='en',
            )

            tenant_user = UserAccount.objects.filter(tenant_id_ref=receipt.tenant_id, is_active=True).first()
            if tenant_user:
                send_web_push_to_user(
                    user_id=str(tenant_user.id),
                    title='Payment Confirmed · AD-PRMS',
                    body=body_en,
                    url='/tenant/receipts',
                    tag=f'receipt-{receipt.receipt_number}',
                )

            staff_users = UserAccount.objects.filter(
                user_type=UserAccount.UserType.STAFF,
                owner_code=receipt.owner.code,
                role__in=['Owner / Director', 'General Manager', 'Collections Clerk'],
                is_active=True,
            )
            for staff in staff_users:
                send_web_push_to_user(
                    user_id=str(staff.id),
                    title=f'Rent Collected: {receipt.unit.code}',
                    body=f'ETB {receipt.amount_etb} settled by {receipt.tenant.name}.',
                    url='/owner-mobile/collections',
                    tag=f'owner-receipt-{receipt.receipt_number}',
                )
    except Exception as exc:
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def dispatch_overdue_rent_reminders(self) -> int:
    try:
        today = timezone.localdate()
        count = 0
        with transaction.atomic():
            overdue_charges = Charge.objects.select_related('owner', 'tenant', 'unit').filter(
                due_date__lt=today,
                status__in=[Charge.Status.OPEN, Charge.Status.PARTIALLY_PAID, Charge.Status.OVERDUE],
            )
            for charge in overdue_charges:
                open_etb = charge.billed_etb - charge.paid_etb
                if open_etb <= 0:
                    continue
                msg = f'AD-PRMS Reminder: Invoice {charge.invoice_number} for {charge.unit.code} has ETB {open_etb} due.'
                send_bilingual_sms(
                    msisdn=charge.tenant.phone_msisdn,
                    body=msg,
                    owner_code=charge.owner.code,
                    trigger_type='Overdue Reminder',
                    locale='en',
                )
                count += 1
        return count
    except Exception as exc:
        raise self.retry(exc=exc)
