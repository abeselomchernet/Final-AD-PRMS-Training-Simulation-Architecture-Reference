import uuid
from django.conf import settings
from django.db import models


class WebPushSubscription(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='push_subscriptions')
    owner_code = models.CharField(max_length=32, db_index=True)
    endpoint = models.URLField(max_length=1024, unique=True)
    p256dh = models.CharField(max_length=255)
    auth = models.CharField(max_length=255)
    device_label = models.CharField(max_length=120, blank=True)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_sent_at = models.DateTimeField(null=True, blank=True)


class TenantNotice(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner_code = models.CharField(max_length=32, db_index=True)
    tenant_id_ref = models.UUIDField(null=True, blank=True, db_index=True)  # null = ALL owner tenants
    title_en = models.CharField(max_length=255)
    title_am = models.CharField(max_length=255)
    body_en = models.TextField()
    body_am = models.TextField()
    category = models.CharField(max_length=48, default='Building Notice')
    published_by_actor_id = models.CharField(max_length=64)
    published_at = models.DateTimeField(auto_now_add=True)


class SmsDispatchLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner_code = models.CharField(max_length=32, db_index=True)
    recipient_msisdn = models.CharField(max_length=20)
    trigger_type = models.CharField(max_length=48, default='General Notice')
    locale = models.CharField(max_length=5, default='en')
    message_body = models.TextField()
    provider = models.CharField(max_length=32)
    provider_message_id = models.CharField(max_length=128, blank=True)
    delivery_state = models.CharField(max_length=32, default='Queued')
    dispatched_at = models.DateTimeField(auto_now_add=True)
