import uuid
from django.core.exceptions import ValidationError
from django.db import models


class OwnerEntity(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=32, unique=True, db_index=True)
    name = models.CharField(max_length=255)
    entity_type = models.CharField(max_length=64)
    status = models.CharField(max_length=32, default='Active')
    tin_encrypted = models.TextField(blank=True)
    vat_reg_encrypted = models.TextField(blank=True)
    address = models.TextField(blank=True)
    contact_phone = models.CharField(max_length=32, blank=True)
    contact_email = models.EmailField(blank=True)
    version = models.PositiveIntegerField(default=1)
    effective_date = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)


class PartyIdentity(models.Model):
    """
    Distinguishes the registered Property Title-Holder (Abdulwehab Dekebo across all 5 buildings)
    from separate pending commercial/trading identities (e.g., Abdulwehab Dekebo Trading).
    Inter-entity journals remain disabled until legal/tax documentary review is signed off.
    """

    class PartyKind(models.TextChoices):
        REGISTERED_TITLE_HOLDER = 'Registered Title-Holder', 'Registered Title-Holder'
        PENDING_TRADING_IDENTITY = 'Pending Trading Identity', 'Pending Trading Identity'

    class ConfirmationStatus(models.TextChoices):
        CONFIRMED_TITLE_HOLDER = 'Confirmed Title-Holder', 'Confirmed Title-Holder'
        PENDING_DOCUMENTARY = 'Pending Documentary Confirmation', 'Pending Documentary Confirmation'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(OwnerEntity, on_delete=models.PROTECT, related_name='party_identities')
    code = models.CharField(max_length=48)
    legal_name = models.CharField(max_length=255)
    party_kind = models.CharField(max_length=48, choices=PartyKind.choices)
    confirmation_status = models.CharField(
        max_length=48,
        choices=ConfirmationStatus.choices,
        default=ConfirmationStatus.PENDING_DOCUMENTARY,
    )
    inter_entity_posting_enabled = models.BooleanField(default=False)
    tin_encrypted = models.TextField(blank=True)
    evidence_ref = models.CharField(max_length=128, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('owner', 'code')


class Property(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(OwnerEntity, on_delete=models.PROTECT, related_name='properties')
    code = models.CharField(max_length=32)
    name = models.CharField(max_length=255)
    sub_city = models.CharField(max_length=120)
    woreda = models.CharField(max_length=64)
    street = models.CharField(max_length=255, blank=True)
    landmark = models.CharField(max_length=255, blank=True)
    property_type = models.CharField(max_length=64)
    status = models.CharField(max_length=32, default='Active')
    effective_date = models.DateField()

    class Meta:
        unique_together = ('owner', 'code')


class Building(models.Model):
    class UnitCountStatus(models.TextChoices):
        VERIFIED = 'Verified', 'Verified Deed / Floorplan'
        PROVISIONAL = 'Provisional', 'Provisional (~20 Estimated)'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(OwnerEntity, on_delete=models.PROTECT, related_name='buildings')
    property_ref = models.ForeignKey(Property, on_delete=models.PROTECT, related_name='buildings')
    code = models.CharField(max_length=32)
    name = models.CharField(max_length=255)
    floors = models.PositiveSmallIntegerField(default=1)
    total_units_expected = models.PositiveIntegerField(default=20)
    unit_count_status = models.CharField(
        max_length=24,
        choices=UnitCountStatus.choices,
        default=UnitCountStatus.PROVISIONAL,
    )
    deed_reference = models.CharField(max_length=128, blank=True)
    address_note = models.CharField(max_length=255, blank=True)
    status = models.CharField(max_length=32, default='Active')

    class Meta:
        unique_together = ('owner', 'code')

    def clean(self) -> None:
        if self.property_ref_id and self.owner_id and self.property_ref.owner_id != self.owner_id:
            raise ValidationError('Cross-owner invariant violation: Building.owner must match Property.owner.')

    def save(self, *args, **kwargs):
        self.clean()
        return super().save(*args, **kwargs)


class Unit(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(OwnerEntity, on_delete=models.PROTECT, related_name='units')
    property_ref = models.ForeignKey(Property, on_delete=models.PROTECT, related_name='units')
    building = models.ForeignKey(Building, on_delete=models.PROTECT, related_name='units')
    code = models.CharField(max_length=32)
    name = models.CharField(max_length=255)
    floor = models.IntegerField(default=0)
    area_sqm = models.DecimalField(max_digits=10, decimal_places=2)
    unit_type = models.CharField(max_length=64)
    status = models.CharField(max_length=32, default='Vacant')
    base_rent_etb = models.DecimalField(max_digits=14, decimal_places=2)
    previous_identifiers = models.JSONField(default=list)

    class Meta:
        unique_together = ('building', 'code')

    def clean(self) -> None:
        if self.property_ref_id and self.owner_id and self.property_ref.owner_id != self.owner_id:
            raise ValidationError('Cross-owner invariant violation: Unit.owner must match Property.owner.')
        if self.building_id and self.owner_id and self.building.owner_id != self.owner_id:
            raise ValidationError('Cross-owner invariant violation: Unit.owner must match Building.owner.')
        if self.building_id and self.property_ref_id and self.building.property_ref_id != self.property_ref_id:
            raise ValidationError('Hierarchy invariant violation: Unit.building must belong to Unit.property_ref.')

    def save(self, *args, **kwargs):
        self.clean()
        return super().save(*args, **kwargs)


class TenantProfile(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(OwnerEntity, on_delete=models.PROTECT, related_name='tenants')
    code = models.CharField(max_length=32)
    name = models.CharField(max_length=255)
    business_type = models.CharField(max_length=120)
    phone_msisdn = models.CharField(max_length=20, db_index=True)
    email = models.EmailField(blank=True)
    emergency_contact = models.CharField(max_length=255, blank=True)
    id_number_encrypted = models.TextField(blank=True)
    status = models.CharField(max_length=32, default='Active')

    class Meta:
        unique_together = ('owner', 'code')


class Lease(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(OwnerEntity, on_delete=models.PROTECT, related_name='leases')
    lease_number = models.CharField(max_length=64)
    version = models.PositiveIntegerField(default=1)
    supersedes_lease = models.ForeignKey('self', null=True, blank=True, on_delete=models.SET_NULL)
    unit = models.ForeignKey(Unit, on_delete=models.PROTECT, related_name='leases')
    tenant = models.ForeignKey(TenantProfile, on_delete=models.PROTECT, related_name='leases')
    status = models.CharField(max_length=32, default='Draft')
    start_date = models.DateField()
    end_date = models.DateField()
    monthly_rent_etb = models.DecimalField(max_digits=14, decimal_places=2)
    security_deposit_etb = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    billing_cycle = models.CharField(max_length=16, default='Monthly')
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('owner', 'lease_number', 'version')

    def clean(self) -> None:
        if self.unit_id and self.owner_id and self.unit.owner_id != self.owner_id:
            raise ValidationError('Cross-owner invariant violation: Lease.owner must match Unit.owner.')
        if self.tenant_id and self.owner_id and self.tenant.owner_id != self.owner_id:
            raise ValidationError('Cross-owner invariant violation: Lease.owner must match Tenant.owner.')
        if self.end_date and self.start_date and self.end_date <= self.start_date:
            raise ValidationError('Lease end_date must be strictly after start_date.')

    def save(self, *args, **kwargs):
        self.clean()
        return super().save(*args, **kwargs)
