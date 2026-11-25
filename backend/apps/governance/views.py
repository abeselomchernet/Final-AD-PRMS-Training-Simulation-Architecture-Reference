from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView
from apps.common.permissions import (
    AtomicRlsViewMixin,
    DenyAuditorWrites,
    IsStaffUser,
    OwnerScopedMixin,
    bind_postgres_rls_owner,
    get_active_owner_code_for_request,
)
from apps.portfolio.models import OwnerEntity
from apps.realtime.publisher import broadcast_owner_event
from .models import ApprovalRequest, AuditEvent, BackupSnapshotRecord, ErcaVerificationGate, TaxRule


class ApprovalRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = ApprovalRequest
        fields = (
            'id',
            'owner',
            'request_number',
            'category',
            'title',
            'target_record_type',
            'target_record_id',
            'maker_actor_id',
            'maker_role',
            'workflow_mode',
            'current_step',
            'total_steps',
            'status',
            'finalized',
            'before_values',
            'after_values',
            'payload_json',
            'payload_hash',
            'approved_checker_actor_id',
            'decision_log',
            'due_date',
            'expiry_date',
            'created_at',
        )
        read_only_fields = (
            'id',
            'owner',
            'maker_actor_id',
            'maker_role',
            'current_step',
            'status',
            'finalized',
            'payload_hash',
            'approved_checker_actor_id',
            'decision_log',
            'created_at',
        )


class TaxRuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = TaxRule
        fields = (
            'id',
            'owner',
            'code',
            'tax_category',
            'taxable_status',
            'rate_percent',
            'lifecycle_stage',
            'source_reference',
            'adviser_evidence',
            'updated_at',
        )
        read_only_fields = ('id', 'owner', 'updated_at')

    def validate(self, attrs):
        request = self.context.get('request')
        owner = self.instance.owner if self.instance else None
        if owner is None and request is not None:
            owner_code = get_active_owner_code_for_request(request.user, request)
            owner = OwnerEntity.objects.filter(code=owner_code).first()
        instance = TaxRule(**{**({'owner': owner} if owner else {}), **attrs})
        try:
            instance.clean()
        except ValidationError as exc:
            raise serializers.ValidationError({'lifecycle_stage': exc.messages})
        return attrs


class AuditEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = AuditEvent
        fields = (
            'id',
            'owner',
            'actor_id',
            'persona',
            'module',
            'action',
            'record_type',
            'record_id',
            'reason',
            'prev_hash',
            'event_hash',
            'created_at',
        )
        read_only_fields = fields


class BackupSnapshotSerializer(serializers.ModelSerializer):
    class Meta:
        model = BackupSnapshotRecord
        fields = (
            'id',
            'owner_code',
            'snapshot_key',
            'sha256_checksum',
            'documents_checksum',
            'encryption_key_id',
            'app_version',
            'manifest_json',
            'reconciliation_passed',
            'status',
            'created_at',
        )
        read_only_fields = fields


class ApprovalRequestViewSet(OwnerScopedMixin, viewsets.ModelViewSet):
    queryset = ApprovalRequest.objects.select_related('owner').all()
    serializer_class = ApprovalRequestSerializer
    permission_classes = [IsStaffUser, DenyAuditorWrites]

    def perform_create(self, serializer):
        owner_code = self.get_active_owner_code()
        owner = OwnerEntity.objects.get(code=owner_code)
        payload = serializer.validated_data.get('payload_json') or serializer.validated_data.get('after_values') or {}
        payload_hash = ApprovalRequest.compute_payload_hash(payload)
        serializer.save(
            owner=owner,
            maker_actor_id=self.request.user.actor_id,
            maker_role=self.request.user.role,
            status='Pending',
            finalized=False,
            approved_checker_actor_id='',
            payload_json=payload,
            payload_hash=payload_hash,
        )

    @action(detail=True, methods=['post'])
    def decide(self, request, pk=None):
        with transaction.atomic():
            req = ApprovalRequest.objects.select_for_update().select_related('owner').get(id=self.get_object().id)
            if req.finalized:
                return Response({'detail': 'ApprovalRequest is already finalized.'}, status=status.HTTP_409_CONFLICT)

            decision = str(request.data.get('decision', '')).strip()  # Approved | Rejected | Returned
            comment = str(request.data.get('comment', '')).strip()
            if decision not in ('Approved', 'Rejected', 'Returned') or not comment:
                return Response({'detail': 'Valid decision and mandatory comment are required.'}, status=status.HTTP_400_BAD_REQUEST)

            try:
                req.assert_checker_sod(request.user.actor_id)
            except ValidationError as exc:
                return Response({'detail': exc.message}, status=status.HTTP_403_FORBIDDEN)

            req.status = decision
            req.finalized = decision in ('Approved', 'Rejected')
            if decision == 'Approved':
                req.approved_checker_actor_id = request.user.actor_id
            req.decision_log.append({
                'timestamp': timezone.now().isoformat(),
                'actor_id': request.user.actor_id,
                'persona': request.user.role,
                'action': decision,
                'comment': comment,
            })
            req.save(update_fields=['status', 'finalized', 'approved_checker_actor_id', 'decision_log'])

            AuditEvent.objects.create(
                owner=req.owner,
                actor_id=request.user.actor_id,
                persona=request.user.role,
                module='Approvals Centre',
                action=f'Approval {decision}',
                record_type='ApprovalRequest',
                record_id=req.request_number,
                reason=comment,
            )

        broadcast_owner_event(
            owner_code=req.owner.code,
            event_type='approval:decided',
            data={'request_number': req.request_number, 'status': req.status},
        )
        return Response(ApprovalRequestSerializer(req).data)


class ErcaGateStatusView(AtomicRlsViewMixin, APIView):
    permission_classes = [IsStaffUser]

    def get(self, request):
        owner_code = get_active_owner_code_for_request(request.user, request)
        bind_postgres_rls_owner(owner_code)
        gate = ErcaVerificationGate.objects.filter(owner__code=owner_code).first()
        if not gate:
            return Response({
                'owner_code': owner_code,
                'erca_tin_verified': False,
                'vat_certificate_verified': False,
                'adviser_signed_off': False,
                'owner_activation_approved': False,
                'live_tax_enabled': False,
                'can_activate_tax_rules': False,
            })
        return Response({
            'owner_code': owner_code,
            'erca_tin_verified': gate.erca_tin_verified,
            'vat_certificate_verified': gate.vat_certificate_verified,
            'adviser_signed_off': gate.adviser_signed_off,
            'owner_activation_approved': gate.owner_activation_approved,
            'live_tax_enabled': gate.live_tax_enabled,
            'can_activate_tax_rules': gate.can_activate_tax_rules(),
        })


class TaxRuleViewSet(OwnerScopedMixin, viewsets.ModelViewSet):
    queryset = TaxRule.objects.select_related('owner').all()
    serializer_class = TaxRuleSerializer
    permission_classes = [IsStaffUser, DenyAuditorWrites]


class AuditEventViewSet(OwnerScopedMixin, viewsets.ReadOnlyModelViewSet):
    queryset = AuditEvent.objects.select_related('owner').order_by('-created_at')
    serializer_class = AuditEventSerializer
    permission_classes = [IsStaffUser]


class BackupSnapshotViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = BackupSnapshotSerializer
    permission_classes = [IsStaffUser, DenyAuditorWrites]

    def get_queryset(self):
        owner_code = get_active_owner_code_for_request(self.request.user, self.request)
        return BackupSnapshotRecord.objects.filter(owner_code__in=['GLOBAL', owner_code]).order_by('-created_at')
