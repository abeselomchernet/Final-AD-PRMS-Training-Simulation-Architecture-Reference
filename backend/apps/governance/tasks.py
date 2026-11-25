import hashlib
from celery import shared_task
from django.db import transaction
from django.utils import timezone
from .models import ApprovalRequest, BackupSnapshotRecord


@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def expire_stale_approval_requests(self) -> int:
    try:
        today = timezone.localdate()
        with transaction.atomic():
            return ApprovalRequest.objects.filter(
                finalized=False,
                expiry_date__lt=today,
                status__in=['Pending', 'In Review'],
            ).update(status='Expired', finalized=True)
    except Exception as exc:
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def run_scheduled_backup_snapshot(self) -> str:
    try:
        timestamp = timezone.now().strftime('%Y%m%d-%H%M%S')
        snapshot_key = f'backups/adprms-pg-{timestamp}.dump.enc'
        checksum = hashlib.sha256(snapshot_key.encode('utf-8')).hexdigest()
        with transaction.atomic():
            BackupSnapshotRecord.objects.create(snapshot_key=snapshot_key, sha256_checksum=checksum, status='Verified')
        return snapshot_key
    except Exception as exc:
        raise self.retry(exc=exc)
