from django.urls import include, path
from rest_framework.routers import DefaultRouter
from .views import (
    BuildingViewSet,
    LeaseViewSet,
    OwnerViewSet,
    PartyIdentityViewSet,
    PropertyViewSet,
    TenantMyLeaseViewSet,
    TenantMyProfileViewSet,
    TenantMyUnitViewSet,
    TenantProfileViewSet,
    UnitViewSet,
)

router = DefaultRouter()
router.register('owners', OwnerViewSet, basename='owners')
router.register('parties', PartyIdentityViewSet, basename='parties')
router.register('properties', PropertyViewSet, basename='properties')
router.register('buildings', BuildingViewSet, basename='buildings')
router.register('units', UnitViewSet, basename='units')
router.register('tenants', TenantProfileViewSet, basename='tenants')
router.register('leases', LeaseViewSet, basename='leases')
router.register('my/units', TenantMyUnitViewSet, basename='my-units')
router.register('my/profile', TenantMyProfileViewSet, basename='my-profile')
router.register('my/leases', TenantMyLeaseViewSet, basename='my-leases')

urlpatterns = [
    path('', include(router.urls)),
]
