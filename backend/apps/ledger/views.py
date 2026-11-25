from datetime import date
from decimal import Decimal
from django.conf import settings
from django.core.exceptions import ValidationError
from django.db.models import Sum
from rest_framework import status, viewsets
from rest_framework.exceptions import PermissionDenied, ValidationError as DRFValidationError
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
from apps.governance.models import ApprovalRequest, ErcaVerificationGate
from apps.portfolio.models import OwnerEntity
from .models import (
    AccountingPeriod,
    DepositMovement,
    JournalEntry,
    JournalLine,
    Ledger,
    LedgerAccount,
    TaxWorkpaper,
)
from .serializers import (
    AccountingPeriodSerializer,
    DepositMovementSerializer,
    JournalEntrySerializer,
    LedgerAccountSerializer,
    TaxWorkpaperSerializer,
)
from .services import (
    evaluate_three_way_deposit_check,
    post_ledger_event,
    request_period_close,
    reverse_journal_entry,
)
from .tax_engine import compute_workpaper_comparison, resolve_tax_rule_pack


def _resolve_verified_approval(
    *,
    owner: OwnerEntity,
    approval_request_id: str | None,
    executor_actor_id: str,
    expected_payload: dict | None = None,
) -> ApprovalRequest:
    if not approval_request_id:
        raise PermissionDenied('Server-side approved ApprovalRequest (approval_request_id) is required for this action.')
    req = ApprovalRequest.objects.filter(id=approval_request_id, owner=owner).first()
    if not req:
        raise PermissionDenied('Referenced ApprovalRequest does not exist within the active owner scope.')
    try:
        checker_actor = req.verify_approved_for_execution(expected_payload=expected_payload)
    except ValidationError as exc:
        raise PermissionDenied(str(exc.message if hasattr(exc, 'message') else exc)) from exc
    if executor_actor_id == req.maker_actor_id:
        raise PermissionDenied('Maker-Checker SoD violation: maker cannot execute an approval request they initiated.')
    if executor_actor_id != checker_actor and executor_actor_id != req.maker_actor_id:
        # Independent checker or authorized staff executing an already-checked request is valid as long as checker != maker
        pass
    return req


class LedgerAccountViewSet(OwnerScopedMixin, viewsets.ReadOnlyModelViewSet):
    queryset = LedgerAccount.objects.select_related('owner').order_by('code', '-version')
    serializer_class = LedgerAccountSerializer
    permission_classes = [IsStaffUser, DenyAuditorWrites]


class AccountingPeriodViewSet(OwnerScopedMixin, viewsets.ReadOnlyModelViewSet):
    queryset = AccountingPeriod.objects.select_related('owner').order_by('fiscal_year_ec', 'month_index')
    serializer_class = AccountingPeriodSerializer
    permission_classes = [IsStaffUser, DenyAuditorWrites]


class JournalEntryViewSet(OwnerScopedMixin, viewsets.ReadOnlyModelViewSet):
    queryset = JournalEntry.objects.select_related('owner', 'period').prefetch_related('lines__account').order_by('-entry_date', '-posted_at')
    serializer_class = JournalEntrySerializer
    permission_classes = [IsStaffUser, DenyAuditorWrites]


class DepositMovementViewSet(OwnerScopedMixin, viewsets.ModelViewSet):
    queryset = DepositMovement.objects.select_related('owner', 'tenant', 'lease', 'posted_journal').order_by('-effective_date', '-created_at')
    serializer_class = DepositMovementSerializer
    permission_classes = [IsStaffUser, DenyAuditorWrites]
    http_method_names = ['get', 'post', 'head', 'options']

    def perform_create(self, serializer):
        owner_code = self.get_active_owner_code()
        owner = OwnerEntity.objects.get(code=owner_code)
        serializer.save(owner=owner, maker_actor_id=self.request.user.actor_id)


class TrialBalanceApiView(AtomicRlsViewMixin, APIView):
    permission_classes = [IsStaffUser]

    def get(self, request):
        owner_code = get_active_owner_code_for_request(request.user, request)
        bind_postgres_rls_owner(owner_code)
        owner = OwnerEntity.objects.get(code=owner_code)
        period_code = request.query_params.get('period_code')

        line_qs = JournalLine.objects.filter(owner=owner).select_related('account', 'entry__period')
        if period_code:
            target_period = AccountingPeriod.objects.filter(owner=owner, period_code=period_code).first()
            if target_period:
                line_qs = line_qs.filter(
                    entry__period__fiscal_year_ec=target_period.fiscal_year_ec,
                    entry__period__month_index__lte=target_period.month_index,
                )

        rows = (
            line_qs.values('account__code', 'account__name', 'account__category', 'account__normal_balance')
            .annotate(total_debit=Sum('debit_etb'), total_credit=Sum('credit_etb'))
            .order_by('account__code')
        )

        accounts_out = []
        tb_dr = Decimal('0.00')
        tb_cr = Decimal('0.00')
        for row in rows:
            dr = row['total_debit'] or Decimal('0.00')
            cr = row['total_credit'] or Decimal('0.00')
            net_dr = dr - cr if dr >= cr else Decimal('0.00')
            net_cr = cr - dr if cr > dr else Decimal('0.00')
            tb_dr += net_dr
            tb_cr += net_cr
            accounts_out.append({
                'code': row['account__code'],
                'name': row['account__name'],
                'category': row['account__category'],
                'normal_balance': row['account__normal_balance'],
                'debit_etb': str(net_dr),
                'credit_etb': str(net_cr),
            })

        return Response({
            'owner_code': owner_code,
            'period_code': period_code,
            'total_debit_etb': str(tb_dr),
            'total_credit_etb': str(tb_cr),
            'balanced': tb_dr == tb_cr,
            'accounts': accounts_out,
        })


class PostJournalApiView(AtomicRlsViewMixin, APIView):
    permission_classes = [IsStaffUser, DenyAuditorWrites]

    def post(self, request):
        owner_code = get_active_owner_code_for_request(request.user, request)
        bind_postgres_rls_owner(owner_code)
        owner = OwnerEntity.objects.get(code=owner_code)
        data = request.data
        source_type = str(data.get('source_type', 'ManualJournal'))
        actor_id = getattr(request.user, 'actor_id', '') or str(getattr(request.user, 'id', ''))

        maker_actor_id = actor_id
        checker_actor_id = ''
        approval_req_id = data.get('approval_request_id')
        approval_hash = ''

        if source_type == 'ManualJournal' or approval_req_id:
            expected_payload = {
                'period_code': data.get('period_code'),
                'entry_date': data.get('entry_date'),
                'rule_id': data.get('rule_id'),
                'idempotency_key': data.get('idempotency_key'),
                'lines': data.get('lines', []),
            }
            req = _resolve_verified_approval(
                owner=owner,
                approval_request_id=approval_req_id,
                executor_actor_id=actor_id,
                expected_payload=expected_payload,
            )
            maker_actor_id = req.maker_actor_id
            checker_actor_id = req.approved_checker_actor_id
            approval_hash = req.payload_hash

        try:
            entry = post_ledger_event(
                owner=owner,
                period_code=data['period_code'],
                entry_date=date.fromisoformat(data['entry_date']),
                rule_id=data['rule_id'],
                source_type=source_type,
                source_id=data.get('source_id', 'API'),
                idempotency_key=data['idempotency_key'],
                description=data.get('description', ''),
                lines=data.get('lines', []),
                maker_actor_id=maker_actor_id,
                checker_actor_id=checker_actor_id,
                approval_request_id=approval_req_id,
                approval_payload_hash=approval_hash,
            )
        except (KeyError, ValueError, ValidationError) as exc:
            raise DRFValidationError({'detail': str(exc)}) from exc

        if entry is None:
            return Response({'posted': False, 'reason': 'PR-08 failed gateway event creates 0 accounting entries.'})
        return Response(JournalEntrySerializer(entry).data, status=status.HTTP_201_CREATED)


class ReverseJournalApiView(AtomicRlsViewMixin, APIView):
    permission_classes = [IsStaffUser, DenyAuditorWrites]

    def post(self, request, journal_id):
        owner_code = get_active_owner_code_for_request(request.user, request)
        bind_postgres_rls_owner(owner_code)
        owner = OwnerEntity.objects.get(code=owner_code)
        original = JournalEntry.objects.filter(id=journal_id, owner=owner).first()
        if not original:
            return Response({'detail': 'JournalEntry not found in active owner scope.'}, status=status.HTTP_404_NOT_FOUND)

        actor_id = getattr(request.user, 'actor_id', '') or str(getattr(request.user, 'id', ''))
        approval_req_id = request.data.get('approval_request_id')
        req = _resolve_verified_approval(
            owner=owner,
            approval_request_id=approval_req_id,
            executor_actor_id=actor_id,
            expected_payload={
                'journal_id': str(original.id),
                'period_code': request.data.get('period_code'),
            },
        )

        try:
            reversal = reverse_journal_entry(
                original_entry=original,
                period_code=request.data['period_code'],
                reversal_date=date.fromisoformat(request.data['reversal_date']),
                reason=request.data.get('reason', 'PR-25 authorized reversal'),
                maker_actor_id=req.maker_actor_id,
                checker_actor_id=req.approved_checker_actor_id,
                approval_request_id=req.id,
                approval_payload_hash=req.payload_hash,
            )
        except (KeyError, ValueError, ValidationError) as exc:
            raise DRFValidationError({'detail': str(exc)}) from exc

        return Response(JournalEntrySerializer(reversal).data, status=status.HTTP_201_CREATED)


class PeriodCloseApiView(AtomicRlsViewMixin, APIView):
    permission_classes = [IsStaffUser, DenyAuditorWrites]

    def post(self, request):
        owner_code = get_active_owner_code_for_request(request.user, request)
        bind_postgres_rls_owner(owner_code)
        owner = OwnerEntity.objects.get(code=owner_code)
        actor_id = getattr(request.user, 'actor_id', '') or str(getattr(request.user, 'id', ''))
        period_code = request.data.get('period_code')
        approval_req_id = request.data.get('approval_request_id')

        req = _resolve_verified_approval(
            owner=owner,
            approval_request_id=approval_req_id,
            executor_actor_id=actor_id,
            expected_payload={'period_code': period_code},
        )

        try:
            period = request_period_close(
                owner=owner,
                period_code=period_code,
                maker_actor_id=req.maker_actor_id,
                checker_actor_id=req.approved_checker_actor_id,
            )
        except (KeyError, ValidationError) as exc:
            raise DRFValidationError({'detail': str(exc)}) from exc

        return Response(AccountingPeriodSerializer(period).data)


class ThreeWayDepositCheckApiView(AtomicRlsViewMixin, APIView):
    permission_classes = [IsStaffUser]

    def get(self, request):
        owner_code = get_active_owner_code_for_request(request.user, request)
        bind_postgres_rls_owner(owner_code)
        owner = OwnerEntity.objects.get(code=owner_code)
        result = evaluate_three_way_deposit_check(owner=owner)
        return Response({
            'owner_code': owner_code,
            'gross_active_lease_deposits_etb': str(result['gross_active_lease_deposits_etb']),
            'active_lease_adjustments_etb': str(result['active_lease_adjustments_etb']),
            'lease_register_etb': str(result['lease_register_etb']),
            'gl_2120_etb': str(result['gl_2120_etb']),
            'subledger_etb': str(result['subledger_etb']),
            'gl_vs_subledger_variance_etb': str(result['gl_vs_subledger_variance_etb']),
            'lease_vs_subledger_variance_etb': str(result['lease_vs_subledger_variance_etb']),
            'unlinked_movements': result['unlinked_movements'],
            'passed': result['passed'],
        })


class TaxWorkpaperApiView(AtomicRlsViewMixin, APIView):
    permission_classes = [IsStaffUser]

    def get(self, request):
        owner_code = get_active_owner_code_for_request(request.user, request)
        bind_postgres_rls_owner(owner_code)
        owner = OwnerEntity.objects.get(code=owner_code)
        workpapers = TaxWorkpaper.objects.filter(owner=owner).order_by('-generated_at')
        return Response(TaxWorkpaperSerializer(workpapers, many=True).data)

    def post(self, request):
        owner_code = get_active_owner_code_for_request(request.user, request)
        bind_postgres_rls_owner(owner_code)
        owner = OwnerEntity.objects.get(code=owner_code)
        payload = request.data

        as_of_raw = payload.get('as_of_date')
        as_of = date.fromisoformat(as_of_raw) if as_of_raw else None
        pack_id = payload.get('pack_id')
        pack = resolve_tax_rule_pack(as_of_date=as_of, pack_id=pack_id)
        if pack is None:
            return Response(
                {'detail': 'No versioned TaxRulePack configured for the requested date/pack_id.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        ledger_cfg = Ledger.objects.filter(owner=owner).first()
        entity_type = str(payload.get('entity_type') or (ledger_cfg.entity_type if ledger_cfg else 'Undetermined'))
        gate = ErcaVerificationGate.objects.filter(owner=owner).first()
        gate_verified = bool(
            gate
            and gate.can_activate_tax_rules()
            and gate.live_tax_enabled
            and getattr(settings, 'ENABLE_LIVE_TAX_INVOICING', False)
        )

        try:
            result = compute_workpaper_comparison(
                gross_rent_etb=Decimal(str(payload.get('gross_rent_etb', '0'))),
                operating_expenses_etb=Decimal(str(payload.get('operating_expenses_etb', '0'))),
                depreciation_etb=Decimal(str(payload.get('depreciation_etb', '0'))),
                entity_type=entity_type,
                vat_registered=bool(payload.get('vat_registered', False)),
                wht_qualifying_payments_etb=Decimal(str(payload.get('wht_qualifying_payments_etb', '0'))),
                property_assessed_value_etb=Decimal(str(payload.get('property_assessed_value_etb', '0'))),
                enable_live_tax_invoicing=gate_verified,
                as_of_date=as_of,
                pack_id=pack.pack_id,
                rule_pack_meta={
                    'pack_id': pack.pack_id,
                    'version': pack.version,
                    'proclamation_ref': pack.proclamation_ref,
                    'effective_from': pack.effective_from.isoformat(),
                    'effective_to': pack.effective_to.isoformat() if pack.effective_to else None,
                    'lifecycle_stage': pack.lifecycle_stage,
                    'reviewer_name': pack.reviewer_name,
                    'reviewer_license_ref': pack.reviewer_license_ref,
                    'requires_four_signoffs': pack.requires_four_signoffs,
                    'four_signoffs_verified': bool(gate and gate.can_activate_tax_rules()),
                },
            )
        except ValueError as exc:
            raise DRFValidationError({'detail': str(exc)}) from exc

        return Response(result)
