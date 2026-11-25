import os
from celery import Celery
from celery.schedules import crontab

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.prod')

app = Celery('adprms')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()

app.conf.beat_schedule = {
    'scan-overdue-rent-reminders-daily': {
        'task': 'apps.notifications.tasks.dispatch_overdue_rent_reminders',
        'schedule': crontab(hour=6, minute=0),  # 09:00 EAT (UTC+3)
    },
    'nightly-encrypted-pg-backup-drill': {
        'task': 'apps.governance.tasks.run_scheduled_backup_snapshot',
        'schedule': crontab(hour=23, minute=30),  # 02:30 EAT (UTC+3)
    },
    'expire-stale-approvals-hourly': {
        'task': 'apps.governance.tasks.expire_stale_approval_requests',
        'schedule': crontab(minute=15),
    },
}
