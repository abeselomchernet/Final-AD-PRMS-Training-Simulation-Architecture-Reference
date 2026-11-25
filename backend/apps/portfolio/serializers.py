from rest_framework import serializers
from .models import Building, Lease, OwnerEntity, PartyIdentity, Property, TenantProfile, Unit


class OwnerEntitySerializer(serializers.ModelSerializer):
    class Meta:
        model = OwnerEntity
        fields = (
            'id',
            'code',
            'name',
            'entity_type',
            'status',
            'address',
            'contact_phone',
            'contact_email',
            'version',
            'effective_date',
        )
        read_only_fields = fields


class PartyIdentitySerializer(serializers.ModelSerializer):
    class Meta:
        model = PartyIdentity
        fields = (
            'id',
            'owner',
            'code',
            'legal_name',
            'party_kind',
            'confirmation_status',
            'inter_entity_posting_enabled',
            'evidence_ref',
            'notes',
            'created_at',
        )
        read_only_fields = ('id', 'owner', 'inter_entity_posting_enabled', 'created_at')


class PropertySerializer(serializers.ModelSerializer):
    class Meta:
        model = Property
        fields = (
            'id',
            'owner',
            'code',
            'name',
            'sub_city',
            'woreda',
            'street',
            'landmark',
            'property_type',
            'status',
            'effective_date',
        )
        read_only_fields = ('id', 'owner')


class BuildingSerializer(serializers.ModelSerializer):
    class Meta:
        model = Building
        fields = (
            'id',
            'owner',
            'property_ref',
            'code',
            'name',
            'floors',
            'total_units_expected',
            'unit_count_status',
            'deed_reference',
            'address_note',
            'status',
        )
        read_only_fields = ('id', 'owner')

    def validate(self, attrs):
        request = self.context.get('request')
        owner_code = getattr(request, 'active_owner_code', None) if request else None
        prop = attrs.get('property_ref') or getattr(self.instance, 'property_ref', None)
        if prop and owner_code and prop.owner.code != owner_code:
            raise serializers.ValidationError({'property_ref': 'Cross-owner property reference is prohibited.'})
        return attrs


class UnitSerializer(serializers.ModelSerializer):
    class Meta:
        model = Unit
        fields = (
            'id',
            'owner',
            'property_ref',
            'building',
            'code',
            'name',
            'floor',
            'area_sqm',
            'unit_type',
            'status',
            'base_rent_etb',
            'previous_identifiers',
        )
        read_only_fields = ('id', 'owner')

    def validate(self, attrs):
        building = attrs.get('building') or getattr(self.instance, 'building', None)
        prop = attrs.get('property_ref') or getattr(self.instance, 'property_ref', None)
        if building and prop and building.property_ref_id != prop.id:
            raise serializers.ValidationError({'building': 'Building does not belong to selected property.'})
        return attrs


class TenantProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = TenantProfile
        fields = (
            'id',
            'owner',
            'code',
            'name',
            'business_type',
            'phone_msisdn',
            'email',
            'emergency_contact',
            'status',
        )
        read_only_fields = ('id', 'owner')


class LeaseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Lease
        fields = (
            'id',
            'owner',
            'lease_number',
            'version',
            'supersedes_lease',
            'unit',
            'tenant',
            'status',
            'start_date',
            'end_date',
            'monthly_rent_etb',
            'security_deposit_etb',
            'billing_cycle',
            'notes',
            'created_at',
        )
        read_only_fields = ('id', 'owner', 'created_at')

    def validate(self, attrs):
        unit = attrs.get('unit') or getattr(self.instance, 'unit', None)
        tenant = attrs.get('tenant') or getattr(self.instance, 'tenant', None)
        start = attrs.get('start_date') or getattr(self.instance, 'start_date', None)
        end = attrs.get('end_date') or getattr(self.instance, 'end_date', None)
        if unit and tenant and unit.owner_id != tenant.owner_id:
            raise serializers.ValidationError('Unit and Tenant must belong to the same owner.')
        if start and end and end <= start:
            raise serializers.ValidationError({'end_date': 'End date must be strictly after start date.'})
        return attrs
