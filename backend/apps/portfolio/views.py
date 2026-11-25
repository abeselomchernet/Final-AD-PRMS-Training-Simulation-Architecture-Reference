from rest_framework import permissions, viewsets
from apps.common.permissions import (
    DenyAuditorWrites,
    IsStaffOrTenantSelfReadOnly,
    IsStaffUser,
    OwnerScopedMixin,
)
from .models import Building, Lease, OwnerEntity, PartyIdentity, Property, TenantProfile, Unit
from .serializers import (
    BuildingSerializer,
    LeaseSerializer,
    OwnerEntitySerializer,
    PartyIdentitySerializer,
    PropertySerializer,
    TenantProfileSerializer,
    UnitSerializer,
)


class PropertyViewSet(OwnerScopedMixin, viewsets.ModelViewSet):
    queryset = Property.objects.select_related('owner').all()
    serializer_class = PropertySerializer
    permission_classes = [permissions.IsAuthenticated, IsStaffUser, DenyAuditorWrites]


class BuildingViewSet(OwnerScopedMixin, viewsets.ModelViewSet):
    queryset = Building.objects.select_related('owner', 'property_ref').all()
    serializer_class = BuildingSerializer
    permission_classes = [permissions.IsAuthenticated, IsStaffUser, DenyAuditorWrites]


class PartyIdentityViewSet(OwnerScopedMixin, viewsets.ReadOnlyModelViewSet):
    queryset = PartyIdentity.objects.select_related('owner').all()
    serializer_class = PartyIdentitySerializer
    permission_classes = [permissions.IsAuthenticated, IsStaffUser]


class UnitViewSet(OwnerScopedMixin, viewsets.ModelViewSet):
    queryset = Unit.objects.select_related('owner', 'property_ref', 'building').all()
    serializer_class = UnitSerializer
    permission_classes = [permissions.IsAuthenticated, IsStaffUser, DenyAuditorWrites]


class TenantProfileViewSet(OwnerScopedMixin, viewsets.ModelViewSet):
    queryset = TenantProfile.objects.select_related('owner').all()
    serializer_class = TenantProfileSerializer
    permission_classes = [permissions.IsAuthenticated, IsStaffUser, DenyAuditorWrites]


class LeaseViewSet(OwnerScopedMixin, viewsets.ModelViewSet):
    queryset = Lease.objects.select_related('owner', 'unit', 'tenant').all()
    serializer_class = LeaseSerializer
    permission_classes = [permissions.IsAuthenticated, IsStaffUser, DenyAuditorWrites]


class TenantMyUnitViewSet(OwnerScopedMixin, viewsets.ReadOnlyModelViewSet):
    queryset = Unit.objects.select_related('owner', 'property_ref', 'building').all()
    serializer_class = UnitSerializer
    permission_classes = [permissions.IsAuthenticated, IsStaffOrTenantSelfReadOnly]

    def get_queryset(self):
        qs = super().get_queryset()
        if getattr(self.request.user, 'user_type', '') == 'TENANT':
            return qs.filter(leases__tenant_id=self.request.user.tenant_id_ref).distinct()
        return qs


class TenantMyProfileViewSet(OwnerScopedMixin, viewsets.ReadOnlyModelViewSet):
    queryset = TenantProfile.objects.select_related('owner').all()
    serializer_class = TenantProfileSerializer
    permission_classes = [permissions.IsAuthenticated, IsStaffOrTenantSelfReadOnly]
    tenant_field = 'id'


class TenantMyLeaseViewSet(OwnerScopedMixin, viewsets.ReadOnlyModelViewSet):
    queryset = Lease.objects.select_related('owner', 'unit', 'tenant').all()
    serializer_class = LeaseSerializer
    permission_classes = [permissions.IsAuthenticated, IsStaffOrTenantSelfReadOnly]
    tenant_field = 'tenant_id'


class OwnerViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = OwnerEntity.objects.all()
    serializer_class = OwnerEntitySerializer
    permission_classes = [permissions.IsAuthenticated, IsStaffUser]

    def get_queryset(self):
        allowed = list(getattr(self.request.user, 'allowed_owners', []) or [])
        return self.queryset.filter(code__in=allowed)
