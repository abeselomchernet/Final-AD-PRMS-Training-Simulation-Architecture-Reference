import hashlib
import json
import uuid
from django.core.exceptions import ValidationError
from django.db import models, transaction
from apps.portfolio.models import OwnerEntity


class ApprovalRequest(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(OwnerEntity, on_delete=models.PROTECT, related_name='approval_requests')
    request_number = models.CharField(max_length=48, unique=True)
    category = models.CharField(max_length=64)
    title = models.CharField(max_length=255)
    target_record_type = models.CharField(max_length=64)
    target_record_id = models.CharField(max_length=128)
    maker_actor_id = models.CharField(max_length=64)
    maker_role = models.CharField(max_length=64)
    workflow_mode = models.CharField(max_length=24, default='Two-Step')
    current_step = models.PositiveSmallIntegerField(default=1)
    total_steps = models.PositiveSmallIntegerField(default=2)
    status = models.CharField(max_length=24, default='Pending')
    finalized = models.BooleanField(default=False)
    before_values = models.JSONField(default=dict)
    after_values = models.JSONField(default=dict)
    payload_json = models.JSONField(default=dict, blank=True)
    payload_hash = models.CharField(max_length=64, blank=True, db_index=True)
    approved_checker_actor_id = models.CharField(max_length=64, blank=True)
    decision_log = models.JSONField(default=list)
    due_date = models.DateField(null=True, blank=True)
    expiry_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    @staticmethod
    def compute_payload_hash(payload: dict | None) -> str:
        canonical = json.dumps(payload or {}, sort_keys=True, default=str)
        return hashlib.sha256(canonical.encode('utf-8')).hexdigest()

    def assert_checker_sod(self, checker_actor_id: str) -> None:
        if not checker_actor_id or checker_actor_id == self.maker_actor_id:
            raise ValidationError('Maker-Checker SoD violation: maker cannot approve, reject, or return their own request.')

    def verify_approved_for_execution(self, expected_payload: dict | None = None) -> str:
        if self.status != 'Approved' or not self.finalized:
            raise ValidationError(f'ApprovalRequest {self.request_number} is not finalized/Approved.')
        checker_actor = self.approved_checker_actor_id
        if not checker_actor or checker_actor == self.maker_actor_id:
            raise ValidationError('Maker-Checker SoD violation: approved_checker_actor_id is missing or matches maker.')
        if not self.decision_log:
            raise ValidationError('ApprovalRequest is missing a recorded decision_log entry.')
        last_decision = self.decision_log[-1]
        if (
            last_decision.get('action') != 'Approved'
            or not last_decision.get('actor_id')
            or last_decision.get('actor_id') == self.maker_actor_id
            or last_decision.get('actor_id') != checker_actor
        ):
            raise ValidationError('ApprovalRequest decision_log does not verify an independent checker approval.')
        if expected_payload is not None and self.payload_hash:
            expected_hash = self.compute_payload_hash(expected_payload)
            if expected_hash != self.payload_hash:
                raise ValidationError('Approval payload integrity violation: execution payload does not match approved payload_hash.')
        return checker_actor


class ErcaVerificationGate(models.Model):
    """Hard production tax activation gate requiring ERCA TIN, VAT cert, adviser sign-off, and owner approval."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.OneToOneField(OwnerEntity, on_delete=models.PROTECT, related_name='erca_gate')
    erca_tin_verified = models.BooleanField(default=False)
    erca_tin_doc_id = models.CharField(max_length=128, blank=True)
    vat_certificate_verified = models.BooleanField(default=False)
    vat_certificate_doc_id = models.CharField(max_length=128, blank=True)
    adviser_license_ref = models.CharField(max_length=128, blank=True)
    adviser_signed_off = models.BooleanField(default=False)
    owner_activation_approved = models.BooleanField(default=False)
    live_tax_enabled = models.BooleanField(default=False)
    updated_at = models.DateTimeField(auto_now=True)

    def can_activate_tax_rules(self) -> bool:
        return bool(
            self.erca_tin_verified
            and self.vat_certificate_verified
            and self.adviser_signed_off
            and self.owner_activation_approved
        )


class TaxRule(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(OwnerEntity, on_delete=models.PROTECT, related_name='tax_rules')
    code = models.CharField(max_length=64)
    tax_category = models.CharField(max_length=128)
    taxable_status = models.CharField(max_length=48, default='Undetermined')
    rate_percent = models.DecimalField(max_digits=6, decimal_places=3, null=True, blank=True)
    lifecycle_stage = models.CharField(max_length=32, default='Draft')
    source_reference = models.CharField(max_length=255)
    adviser_evidence = models.TextField()
    updated_at = models.DateTimeField(auto_now=True)

    def clean(self) -> None:
        from django.conf import settings

        if self.lifecycle_stage == 'Active':
            if not getattr(settings, 'ENABLE_LIVE_TAX_INVOICING', False):
                raise ValidationError(
                    'Active tax stage is locked while ENABLE_LIVE_TAX_INVOICING is disabled.'
                )
            gate = ErcaVerificationGate.objects.filter(owner=self.owner).first()
            if not gate or not gate.can_activate_tax_rules() or not gate.live_tax_enabled:
                raise ValidationError(
                    'Active tax stage is blocked until ERCA TIN, VAT certificate, licensed adviser sign-off, and owner activation are verified.'
                )

    def save(self, *args, **kwargs):
        self.clean()
        return super().save(*args, **kwargs)


class AuditEvent(models.Model):
    """Append-only SHA-256 hash-chained audit record."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(OwnerEntity, on_delete=models.PROTECT, related_name='audit_events')
    actor_id = models.CharField(max_length=64)
    persona = models.CharField(max_length=64)
    module = models.CharField(max_length=64)
    action = models.CharField(max_length=128)
    record_type = models.CharField(max_length=64)
    record_id = models.CharField(max_length=128)
    reason = models.TextField()
    prev_hash = models.CharField(max_length=64, blank=True)
    event_hash = models.CharField(max_length=64, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        if not self._state.adding:
            raise ValidationError('AuditEvent is append-only and cannot be modified.')
        if not self.id:
            self.id = uuid.uuid4()
        with transaction.atomic():
            # Serialize per-owner SHA-256 chain appends across concurrent workers
            OwnerEntity.objects.select_for_update().get(id=self.owner_id)
            last = (
                AuditEvent.objects.filter(owner_id=self.owner_id)
                .order_by('-created_at', '-id')
                .first()
            )
            self.prev_hash = last.event_hash if last else ('0' * 64)
            digest_input = json.dumps(
                {
                    'id': str(self.id),
                    'owner': str(self.owner_id),
                    'actor_id': self.actor_id,
                    'persona': self.persona,
                    'module': self.module,
                    'action': self.action,
                    'record_type': self.record_type,
                    'record_id': self.record_id,
                    'reason': self.reason,
                    'prev_hash': self.prev_hash,
                },
                sort_keys=True,
            )
            self.event_hash = hashlib.sha256(digest_input.encode('utf-8')).hexdigest()
            return super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValidationError('AuditEvent cannot be deleted.')


class BackupSnapshotRecord(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner_code = models.CharField(max_length=32, default='GLOBAL', db_index=True)
    snapshot_key = models.CharField(max_length=255)
    sha256_checksum = models.CharField(max_length=64)
    documents_checksum = models.CharField(max_length=64, blank=True)
    encryption_key_id = models.CharField(max_length=128, blank=True)
    app_version = models.CharField(max_length=64, blank=True)
    manifest_json = models.JSONField(default=dict, blank=True)
    reconciliation_passed = models.BooleanField(default=False)
    status = models.CharField(max_length=32, default='Verified')
    created_at = models.DateTimeField(auto_now_add=True)
