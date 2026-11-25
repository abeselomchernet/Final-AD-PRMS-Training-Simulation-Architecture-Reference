import uuid
from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils import timezone


class UserAccount(AbstractUser):
    class UserType(models.TextChoices):
        STAFF = 'STAFF', 'Staff / Owner'
        TENANT = 'TENANT', 'Tenant Self-Service'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user_type = models.CharField(max_length=16, choices=UserType.choices, default=UserType.STAFF)
    actor_id = models.CharField(max_length=64, unique=True, db_index=True)
    role = models.CharField(max_length=64, default='Clerk')
    phone_msisdn = models.CharField(max_length=20, blank=True, db_index=True)
    owner_code = models.CharField(max_length=32, default='OWN-ALPHA', db_index=True)
    allowed_owners = models.JSONField(default=list)
    tenant_id_ref = models.UUIDField(null=True, blank=True, db_index=True)

    mfa_enabled = models.BooleanField(default=False)
    mfa_secret_encrypted = models.TextField(blank=True)
    preferred_locale = models.CharField(max_length=5, default='en')

    def save(self, *args, **kwargs):
        if not self.actor_id:
            self.actor_id = f'ACT-{uuid.uuid4().hex[:10].upper()}'
        if not self.allowed_owners and self.owner_code:
            self.allowed_owners = [self.owner_code]
        super().save(*args, **kwargs)


class OtpChallenge(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    msisdn = models.CharField(max_length=20, db_index=True)
    otp_hash = models.CharField(max_length=128)
    purpose = models.CharField(max_length=32, default='TENANT_LOGIN')
    attempts = models.PositiveSmallIntegerField(default=0)
    max_attempts = models.PositiveSmallIntegerField(default=5)
    expires_at = models.DateTimeField()
    consumed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=['msisdn', '-created_at'], name='acct_otp_msisdn_created_idx')]

    @property
    def is_expired(self) -> bool:
        return timezone.now() >= self.expires_at


class DelegationRecord(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner_code = models.CharField(max_length=32, db_index=True)
    delegator = models.ForeignKey(UserAccount, on_delete=models.PROTECT, related_name='delegations_granted')
    delegate = models.ForeignKey(UserAccount, on_delete=models.PROTECT, related_name='delegations_received')
    scope_modules = models.JSONField(default=list)
    start_date = models.DateField()
    end_date = models.DateField()
    status = models.CharField(max_length=32, default='Pending Owner Approval')
    owner_approval_ref = models.CharField(max_length=64, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
