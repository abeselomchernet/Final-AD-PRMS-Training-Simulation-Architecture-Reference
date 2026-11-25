import uuid
from django.db import models
from apps.portfolio.models import OwnerEntity


class DocumentAsset(models.Model):
    class EntityType(models.TextChoices):
        CBE_SLIP = 'CBE_SLIP', 'CBE Bank Slip'
        LEASE_PDF = 'LEASE_PDF', 'Signed Lease PDF'
        REPAIR_PHOTO = 'REPAIR_PHOTO', 'Maintenance Photo'
        TENANT_KYC = 'TENANT_KYC', 'Tenant KYC Document'
        ERCA_CERT = 'ERCA_CERT', 'ERCA / Adviser Evidence'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(OwnerEntity, on_delete=models.PROTECT, related_name='documents')
    entity_type = models.CharField(max_length=32, choices=EntityType.choices)
    entity_ref_id = models.CharField(max_length=128, db_index=True)
    object_key = models.CharField(max_length=512, unique=True)
    original_filename = models.CharField(max_length=255)
    mime_type = models.CharField(max_length=128)
    file_size_bytes = models.PositiveIntegerField()
    sha256_checksum = models.CharField(max_length=64, blank=True)
    retention_class = models.CharField(max_length=64, default='FIN-10Y-ET')
    legal_hold = models.BooleanField(default=False)
    exif_stripped = models.BooleanField(default=False)
    uploaded_by_actor_id = models.CharField(max_length=64)
    created_at = models.DateTimeField(auto_now_add=True)
