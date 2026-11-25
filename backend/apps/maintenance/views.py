from decimal import Decimal
from rest_framework import permissions, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError as DRFValidationError
from rest_framework.response import Response
from apps.common.permissions import DenyAuditorWrites, IsStaffUser, OwnerScopedMixin
from apps.portfolio.models import OwnerEntity
from apps.realtime.publisher import broadcast_owner_event
from .models import MaintenanceMessage, MaintenanceTicket


class MaintenanceMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = MaintenanceMessage
        fields = (
            'id',
            'owner',
            'ticket',
            'sender_actor_id',
            'sender_name',
            'sender_role',
            'visibility',
            'body',
            'attachment_key',
            'created_at',
        )
        read_only_fields = ('id', 'owner', 'ticket', 'sender_actor_id', 'sender_name', 'sender_role', 'created_at')


class MaintenanceTicketSerializer(serializers.ModelSerializer):
    class Meta:
        model = MaintenanceTicket
        fields = (
            'id',
            'owner',
            'ticket_number',
            'unit',
            'tenant',
            'category',
            'priority',
            'title',
            'description',
            'estimated_cost_etb',
            'work_order_state',
            'photo_object_key',
            'created_at',
        )
        read_only_fields = ('id', 'owner', 'created_at')


class MaintenanceTicketViewSet(OwnerScopedMixin, viewsets.ModelViewSet):
    queryset = MaintenanceTicket.objects.select_related('owner', 'unit', 'tenant').all()
    serializer_class = MaintenanceTicketSerializer
    permission_classes = [permissions.IsAuthenticated, DenyAuditorWrites]
    tenant_field = 'tenant_id'

    def get_permissions(self):
        if self.action in ('update', 'partial_update', 'destroy'):
            return [permissions.IsAuthenticated(), IsStaffUser(), DenyAuditorWrites()]
        return [perm() if isinstance(perm, type) else perm for perm in self.permission_classes]

    def perform_create(self, serializer):
        owner_code = self.get_active_owner_code()
        owner = OwnerEntity.objects.get(code=owner_code)
        unit = serializer.validated_data.get('unit')
        if unit and unit.owner_id != owner.id:
            raise DRFValidationError({'unit': 'Selected unit does not belong to the active owner scope.'})

        if getattr(self.request.user, 'user_type', '') == 'TENANT':
            tenant_ref = getattr(self.request.user, 'tenant_id_ref', None)
            serializer.save(
                owner=owner,
                tenant_id=tenant_ref,
                estimated_cost_etb=Decimal('0.00'),
                work_order_state='Logged',
            )
            return

        tenant = serializer.validated_data.get('tenant')
        if tenant and tenant.owner_id != owner.id:
            raise DRFValidationError({'tenant': 'Selected tenant does not belong to the active owner scope.'})
        serializer.save(owner=owner)

    @action(detail=True, methods=['get', 'post'])
    def messages(self, request, pk=None):
        ticket = self.get_object()
        is_tenant = getattr(request.user, 'user_type', '') == 'TENANT'

        if request.method == 'GET':
            qs = ticket.messages.all()
            if is_tenant:
                qs = qs.filter(visibility=MaintenanceMessage.Visibility.SHARED_WITH_TENANT)
            return Response(MaintenanceMessageSerializer(qs, many=True).data)

        body = str(request.data.get('body', '')).strip()
        if not body:
            return Response({'detail': 'Message body is required.'}, status=status.HTTP_400_BAD_REQUEST)

        visibility = (
            MaintenanceMessage.Visibility.SHARED_WITH_TENANT
            if is_tenant
            else request.data.get('visibility', MaintenanceMessage.Visibility.SHARED_WITH_TENANT)
        )
        msg = MaintenanceMessage.objects.create(
            owner=ticket.owner,
            ticket=ticket,
            sender_actor_id=request.user.actor_id,
            sender_name=request.user.get_full_name() or request.user.username,
            sender_role='Tenant' if is_tenant else ('Owner' if request.user.role == 'Owner / Director' else 'Staff'),
            visibility=visibility,
            body=body,
            attachment_key=str(request.data.get('attachment_key', '')),
        )

        # Only broadcast Shared messages to tenant channels; internal staff notes stay in staff/owner room
        broadcast_owner_event(
            owner_code=ticket.owner.code,
            event_type='maintenance:message',
            data=MaintenanceMessageSerializer(msg).data,
            tenant_id=str(ticket.tenant_id) if (ticket.tenant_id and visibility == MaintenanceMessage.Visibility.SHARED_WITH_TENANT) else None,
        )
        return Response(MaintenanceMessageSerializer(msg).data, status=status.HTTP_201_CREATED)
