import json
import logging
from django.conf import settings
from django.utils import timezone
from pywebpush import WebPushException, webpush
from .models import WebPushSubscription

logger = logging.getLogger(__name__)


def send_web_push_to_user(*, user_id: str, title: str, body: str, url: str = '/', tag: str = 'adprms-alert') -> int:
    private_key = getattr(settings, 'VAPID_PRIVATE_KEY', '')
    subject = getattr(settings, 'VAPID_SUBJECT', 'mailto:ops@adprms.example.et')
    if not private_key:
        logger.info('VAPID_PRIVATE_KEY missing — skipping OS Web Push dispatch.')
        return 0

    sent_count = 0
    payload = json.dumps({'title': title, 'body': body, 'url': url, 'tag': tag})
    subs = WebPushSubscription.objects.filter(user_id=user_id, active=True)
    for sub in subs:
        try:
            webpush(
                subscription_info={
                    'endpoint': sub.endpoint,
                    'keys': {'p256dh': sub.p256dh, 'auth': sub.auth},
                },
                data=payload,
                vapid_private_key=private_key,
                vapid_claims={'sub': subject},
            )
            sub.last_sent_at = timezone.now()
            sub.save(update_fields=['last_sent_at'])
            sent_count += 1
        except WebPushException as exc:
            status_code = getattr(getattr(exc, 'response', None), 'status_code', None)
            if status_code in (404, 410):
                sub.active = False
                sub.save(update_fields=['active'])
            logger.warning('WebPush dispatch failed status=%s', status_code)
    return sent_count
