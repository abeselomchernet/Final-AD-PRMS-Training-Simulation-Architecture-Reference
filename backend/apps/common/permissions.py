from django.db import connection, transaction
from rest_framework import permissions
from rest_framework.exceptions import PermissionDenied


def get_active_owner_code_for_request(user, request) -> str:
    if not user or not getattr(user, 'is_authenticated', False):
        raise PermissionDenied('Authentication required for owner context resolution.')

    requested = request.headers.get('X-Owner-Context') or request.query_params.get('owner_id')
    allowed = [c for c in list(getattr(user, 'allowed_owners', []) or []) if c]
    user_owner = getattr(user, 'owner_code', '') or ''

    if getattr(user, 'user_type', '') == 'TENANT':
        if not user_owner or not getattr(user, 'tenant_id_ref', None):
            raise PermissionDenied('Tenant account is missing owner or tenant profile binding.')
        if requested and requested != user_owner:
            raise PermissionDenied('Cross-owner tenant context access is prohibited.')
        return user_owner

    if getattr(user, 'role', '') == 'Owner / Director':
        target = allowed[0] if allowed else user_owner
        if not target:
            raise PermissionDenied('Owner / Director account lacks assigned owner scope.')
        if requested and requested != target:
            raise PermissionDenied('Owner / Director is locked to a single authorized owner entity.')
        return target

    if not allowed and user_owner:
        allowed = [user_owner]
    if not allowed:
        raise PermissionDenied('Staff account has no authorized owner scopes configured.')

    if requested:
        if requested not in allowed:
            raise PermissionDenied('Cross-owner context access is prohibited.')
        return requested

    return user_owner if user_owner in allowed else allowed[0]


def bind_postgres_rls_owner(owner_code: str) -> None:
    """
    Fail-closed binding of transaction-local PostgreSQL RLS context (`SET LOCAL app.current_owner_id`).
    Requires an active atomic transaction block whenever running against PostgreSQL.
    Safely no-ops only on SQLite unit environments.
    """
    if not owner_code:
        raise PermissionDenied('Cannot bind RLS without a resolved owner_code.')
    if connection.vendor != 'postgresql':
        return
    if not connection.in_atomic_block:
        raise RuntimeError(
            'Security invariant violation: bind_postgres_rls_owner() called outside transaction.atomic().'
        )
    from apps.portfolio.models import OwnerEntity

    owner_id = OwnerEntity.objects.filter(code=owner_code).values_list('id', flat=True).first()
    if not owner_id:
        raise PermissionDenied(f'Owner entity scope "{owner_code}" does not exist.')
    with connection.cursor() as cursor:
        cursor.execute("SELECT set_config('app.current_owner_id', %s, true)", [str(owner_id)])


class AtomicRlsViewMixin:
    """Wraps DRF APIView execution in transaction.atomic() so SET LOCAL RLS never leaks or no-ops."""

    def dispatch(self, request, *args, **kwargs):
        if connection.vendor == 'postgresql':
            with transaction.atomic():
                return super().dispatch(request, *args, **kwargs)
        return super().dispatch(request, *args, **kwargs)


class DenyAuditorWrites(permissions.BasePermission):
    """Auditor / Read-only reviewer can inspect permitted owner records but never mutate state."""

    def has_permission(self, request, view) -> bool:
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if getattr(user, 'role', '') == 'Auditor / Read-only reviewer' and request.method not in permissions.SAFE_METHODS:
            return False
        return True


class IsStaffUser(permissions.BasePermission):
    def has_permission(self, request, view) -> bool:
        user = request.user
        return bool(user and user.is_authenticated and getattr(user, 'user_type', '') == 'STAFF')


class IsStaffOrTenantSelfReadOnly(permissions.BasePermission):
    """Allows authenticated staff OR read-only tenant self-service queries."""

    def has_permission(self, request, view) -> bool:
        user = request.user
        if not user or not user.is_authenticated:
            return False
        user_type = getattr(user, 'user_type', '')
        if user_type == 'STAFF':
            if getattr(user, 'role', '') == 'Auditor / Read-only reviewer' and request.method not in permissions.SAFE_METHODS:
                return False
            return True
        if user_type == 'TENANT':
            return request.method in permissions.SAFE_METHODS
        return False


class OwnerScopedMixin:
    """
    Enforces strict Owner Isolation at both the ORM queryset layer and PostgreSQL RLS layer.
    Tenants see only their own tenant_id + owner_id; Staff see only owners in allowed_owners;
    Owner / Director is locked to a single authorized owner_id.
    """

    owner_field = 'owner__code'
    tenant_field = None

    def dispatch(self, request, *args, **kwargs):
        if connection.vendor == 'postgresql':
            with transaction.atomic():
                return super().dispatch(request, *args, **kwargs)
        return super().dispatch(request, *args, **kwargs)

    def get_active_owner_code(self) -> str:
        owner_code = get_active_owner_code_for_request(self.request.user, self.request)
        bind_postgres_rls_owner(owner_code)
        return owner_code

    def perform_create(self, serializer):
        from apps.portfolio.models import OwnerEntity

        owner_code = self.get_active_owner_code()
        owner = OwnerEntity.objects.get(code=owner_code)
        serializer.save(owner=owner)

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user
        owner_code = self.get_active_owner_code()
        qs = qs.filter(**{self.owner_field: owner_code})
        if getattr(user, 'user_type', '') == 'TENANT' and self.tenant_field:
            if not getattr(user, 'tenant_id_ref', None):
                raise PermissionDenied('Tenant profile binding missing.')
            qs = qs.filter(**{self.tenant_field: user.tenant_id_ref})
        return qs
