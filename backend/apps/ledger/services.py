from decimal import Decimal, ROUND_HALF_UP
from typing import Any, Iterable
from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone
from apps.portfolio.models import Lease, OwnerEntity, TenantProfile, Unit
from .models import (
    AccountingPeriod,
    CloseChecklistItem,
    DepositMovement,
    JournalEntry,
    JournalLine,
    Ledger,
    LedgerAccount,
    ReconciliationRun,
)

TWO_DP = Decimal('0.01')


def _q2(val: Any) -> Decimal:
    return Decimal(str(val)).quantize(TWO_DP, rounding=ROUND_HALF_UP)


@transaction.atomic
def post_ledger_event(
    *,
    owner: OwnerEntity,
    period_code: str,
    entry_date,
    rule_id: str,
    source_type: str,
    source_id: str,
    idempotency_key: str,
    description: str,
    lines: Iterable[dict[str, Any]],
    maker_actor_id: str,
    checker_actor_id: str = '',
    approval_request_id=None,
    approval_payload_hash: str = '',
    allow_closed_period: bool = False,
    e_invoice_metadata: dict[str, Any] | None = None,
) -> JournalEntry | None:
    """
    Steps 1-6 atomic double-entry posting service.
    - PR-08 (failed gateway attempt): returns None and creates 0 accounting entries.
    - Idempotency key: returns existing journal if already posted.
    - Closed period lock: raises ValidationError unless reopening/year-end override is authorized.
    - Balanced entry invariant: sum(debits) == sum(credits) > 0.
    - Tax-locked account protection & configurable daily cumulative cash cap on account 1010.
    """
    if rule_id == 'PR-08':
        return None

    existing = JournalEntry.objects.filter(owner=owner, idempotency_key=idempotency_key).first()
    if existing is not None:
        return existing

    period = AccountingPeriod.objects.select_for_update().get(owner=owner, period_code=period_code)
    if period.status == AccountingPeriod.Status.CLOSED and not allow_closed_period:
        raise ValidationError(f'Accounting period {period_code} is Closed; posting is blocked.')

    raw_lines = list(lines)
    if len(raw_lines) < 2:
        raise ValidationError('A double-entry journal requires at least 2 balanced lines.')

    total_dr = Decimal('0.00')
    total_cr = Decimal('0.00')
    cash_inflow_or_outflow = Decimal('0.00')
    resolved_lines: list[dict[str, Any]] = []

    for idx, item in enumerate(raw_lines, start=1):
        account = LedgerAccount.objects.filter(owner=owner, code=item['account_code'], status='Active').order_by('-version').first()
        if account is None:
            raise ValidationError(f"Unknown or inactive ledger account {item['account_code']} for owner {owner.code}.")
        if account.is_tax_locked and not getattr(settings, 'ENABLE_LIVE_TAX_INVOICING', False) and rule_id not in {'PR-12', 'PR-13', 'PR-23', 'PR-24'}:
            raise ValidationError(f'Account {account.code} is tax-locked while ENABLE_LIVE_TAX_INVOICING is False.')

        dr = _q2(item.get('debit_etb', '0.00'))
        cr = _q2(item.get('credit_etb', '0.00'))
        if dr < 0 or cr < 0 or (dr > 0 and cr > 0) or (dr == 0 and cr == 0):
            raise ValidationError(f'Line {idx} must have strictly one positive debit or credit amount.')

        if account.code == '1010':
            cash_inflow_or_outflow += max(dr, cr)

        total_dr += dr
        total_cr += cr
        resolved_lines.append({
            'line_number': idx,
            'account': account,
            'debit_etb': dr,
            'credit_etb': cr,
            'tenant': item.get('tenant'),
            'unit': item.get('unit'),
            'tax_code': item.get('tax_code', ''),
            'memo': item.get('memo', ''),
        })

    if total_dr != total_cr or total_dr <= 0:
        raise ValidationError(f'Unbalanced journal: debit {total_dr} != credit {total_cr}.')

    ledger_cfg = Ledger.objects.filter(owner=owner).first()
    if ledger_cfg and ledger_cfg.enforce_daily_cash_cap and cash_inflow_or_outflow > Decimal('0.00') and source_type != 'OpeningBalance':
        prior_cash = JournalLine.objects.filter(
            owner=owner,
            account__code='1010',
            entry__entry_date=entry_date,
        ).exclude(entry__source_type='OpeningBalance').aggregate(
            dr=Sum('debit_etb'),
            cr=Sum('credit_etb'),
        )
        prior_total = _q2((prior_cash['dr'] or Decimal('0.00')) + (prior_cash['cr'] or Decimal('0.00')))
        cumulative_cash = _q2(prior_total + cash_inflow_or_outflow)
        if cumulative_cash > ledger_cfg.daily_cash_cap_etb:
            raise ValidationError(
                f'Daily cash cap exceeded for {entry_date}: cumulative ETB {cumulative_cash} > ETB {ledger_cfg.daily_cash_cap_etb}.'
            )

    seq = JournalEntry.objects.filter(owner=owner).count() + 1
    journal_number = f'JRN-{owner.code.replace("OWN-", "")}-{period.period_code.replace("-", "")}-{seq:04d}'

    invoice_meta = dict(e_invoice_metadata or {})
    if 'mode' not in invoice_meta:
        invoice_meta['mode'] = (
            'LIVE_FISCAL' if getattr(settings, 'ENABLE_LIVE_TAX_INVOICING', False) else 'PROVISIONAL_NON_FISCAL'
        )
    invoice_meta.setdefault('directive', '1142/2026')

    entry = JournalEntry.objects.create(
        owner=owner,
        journal_number=journal_number,
        entry_date=entry_date,
        period=period,
        rule_id=rule_id,
        source_type=source_type,
        source_id=source_id,
        idempotency_key=idempotency_key,
        description=description,
        maker_actor_id=maker_actor_id,
        checker_actor_id=checker_actor_id,
        approval_request_id=approval_request_id,
        approval_payload_hash=approval_payload_hash,
        e_invoice_metadata=invoice_meta,
    )

    for rl in resolved_lines:
        JournalLine.objects.create(
            owner=owner,
            entry=entry,
            line_number=rl['line_number'],
            account=rl['account'],
            debit_etb=rl['debit_etb'],
            credit_etb=rl['credit_etb'],
            tenant=rl['tenant'],
            unit=rl['unit'],
            tax_code=rl['tax_code'],
            memo=rl['memo'],
        )

    return entry


@transaction.atomic
def record_deposit_movement(
    *,
    owner: OwnerEntity,
    tenant: TenantProfile,
    lease: Lease,
    movement_type: str,
    signed_amount_etb: Decimal,
    effective_date,
    reference: str,
    maker_actor_id: str,
    posted_journal: JournalEntry | None = None,
    notes: str = '',
) -> DepositMovement:
    """Records an immutable event in the independent DepositMovement subledger."""
    if tenant.owner_id != owner.id or lease.owner_id != owner.id:
        raise ValidationError('Cross-owner invariant violation on DepositMovement.')
    return DepositMovement.objects.create(
        owner=owner,
        tenant=tenant,
        lease=lease,
        movement_type=movement_type,
        signed_amount_etb=_q2(signed_amount_etb),
        effective_date=effective_date,
        reference=reference,
        posted_journal=posted_journal,
        maker_actor_id=maker_actor_id,
        notes=notes,
    )


@transaction.atomic
def reverse_journal_entry(
    *,
    original_entry: JournalEntry,
    period_code: str,
    reversal_date,
    reason: str,
    maker_actor_id: str,
    checker_actor_id: str,
    approval_request_id=None,
    approval_payload_hash: str = '',
) -> JournalEntry:
    """PR-25 mirror reversal with Maker-Checker Segregation of Duties."""
    if not checker_actor_id or checker_actor_id == maker_actor_id:
        raise ValidationError('Maker-Checker SoD violation: reversal requires an independent checker.')
    if original_entry.status == JournalEntry.Status.REVERSED:
        raise ValidationError(f'Journal {original_entry.journal_number} is already reversed.')

    mirror_lines = [
        {
            'account_code': line.account.code,
            'debit_etb': line.credit_etb,
            'credit_etb': line.debit_etb,
            'tenant': line.tenant,
            'unit': line.unit,
            'tax_code': line.tax_code,
            'memo': f'PR-25 reversal of {original_entry.journal_number}: {reason}',
        }
        for line in original_entry.lines.select_related('account', 'tenant', 'unit').order_by('line_number')
    ]

    reversal = post_ledger_event(
        owner=original_entry.owner,
        period_code=period_code,
        entry_date=reversal_date,
        rule_id='PR-25',
        source_type='JournalReversal',
        source_id=str(original_entry.id),
        idempotency_key=f'REV-{original_entry.id}',
        description=f'PR-25 Mirror Reversal of {original_entry.journal_number}: {reason}',
        lines=mirror_lines,
        maker_actor_id=maker_actor_id,
        checker_actor_id=checker_actor_id,
        approval_request_id=approval_request_id,
        approval_payload_hash=approval_payload_hash,
    )
    assert reversal is not None
    reversal.reversal_of_journal = original_entry
    reversal.save(update_fields=['reversal_of_journal'])

    original_entry.status = JournalEntry.Status.REVERSED
    original_entry.reversed_by_journal = reversal
    original_entry.save(update_fields=['status', 'reversed_by_journal'])
    return reversal


def evaluate_three_way_deposit_check(*, owner: OwnerEntity) -> dict[str, Any]:
    """
    Independent 3-way security deposit reconciliation (#11):
      1) Net Active Lease Register Deposits (Lease security_deposit_etb less active-lease deductions/refunds)
      2) GL Account 2120 Tenant Deposits Held (credit - debit across JournalLine)
      3) Independent DepositMovement Subledger (sum of signed_amount_etb across DepositMovement)
    Note: Does NOT compute subledger by grouping GL 2120 JournalLines, so GL-to-subledger discrepancies are caught.
    """
    gross_lease_sum = (
        Lease.objects.filter(owner=owner, status='Active').aggregate(total=Sum('security_deposit_etb'))['total']
        or Decimal('0.00')
    )
    active_deductions_or_refunds = (
        DepositMovement.objects.filter(
            owner=owner,
            lease__status='Active',
            movement_type__in=[DepositMovement.MovementType.DEDUCTION, DepositMovement.MovementType.REFUND],
            signed_amount_etb__lt=Decimal('0.00'),
        ).aggregate(total=Sum('signed_amount_etb'))['total']
        or Decimal('0.00')
    )
    lease_register_etb = _q2(gross_lease_sum + active_deductions_or_refunds)

    gl_agg = JournalLine.objects.filter(owner=owner, account__code='2120').aggregate(
        dr=Sum('debit_etb'),
        cr=Sum('credit_etb'),
    )
    gl_2120 = _q2((gl_agg['cr'] or Decimal('0.00')) - (gl_agg['dr'] or Decimal('0.00')))

    subledger_sum = _q2(
        DepositMovement.objects.filter(owner=owner).aggregate(total=Sum('signed_amount_etb'))['total']
        or Decimal('0.00')
    )
    unlinked_movements = DepositMovement.objects.filter(owner=owner, posted_journal__isnull=True).count()

    passed = (lease_register_etb == gl_2120 == subledger_sum) and (unlinked_movements == 0)
    return {
        'gross_active_lease_deposits_etb': _q2(gross_lease_sum),
        'active_lease_adjustments_etb': _q2(active_deductions_or_refunds),
        'lease_register_etb': lease_register_etb,
        'gl_2120_etb': gl_2120,
        'subledger_etb': subledger_sum,
        'gl_vs_subledger_variance_etb': _q2(gl_2120 - subledger_sum),
        'lease_vs_subledger_variance_etb': _q2(lease_register_etb - subledger_sum),
        'unlinked_movements': unlinked_movements,
        'passed': passed,
    }


@transaction.atomic
def request_period_close(
    *,
    owner: OwnerEntity,
    period_code: str,
    maker_actor_id: str,
    checker_actor_id: str,
) -> AccountingPeriod:
    """Locks period after close validations and enforces Maker-Checker SoD."""
    if not checker_actor_id or checker_actor_id == maker_actor_id:
        raise ValidationError('Maker-Checker SoD violation: period close requires an independent checker.')

    period = AccountingPeriod.objects.select_for_update().get(owner=owner, period_code=period_code)
    totals = JournalLine.objects.filter(owner=owner, entry__period__fiscal_year_ec=period.fiscal_year_ec, entry__period__month_index__lte=period.month_index).aggregate(
        dr=Sum('debit_etb'),
        cr=Sum('credit_etb'),
    )
    total_dr = _q2(totals['dr'] or Decimal('0.00'))
    total_cr = _q2(totals['cr'] or Decimal('0.00'))
    if total_dr != total_cr:
        raise ValidationError(f'Trial Balance out of balance ({total_dr} vs {total_cr}).')

    clearing_agg = JournalLine.objects.filter(owner=owner, account__code='1040', entry__period=period).aggregate(
        dr=Sum('debit_etb'),
        cr=Sum('credit_etb'),
    )
    clearing_net = _q2((clearing_agg['dr'] or Decimal('0.00')) - (clearing_agg['cr'] or Decimal('0.00')))
    if clearing_net != Decimal('0.00'):
        raise ValidationError(f'Account 1040 Payment Clearing is non-zero (ETB {clearing_net}).')

    recon_ok = ReconciliationRun.objects.filter(owner=owner, period=period, account_code='1020', status='Reconciled').exists()
    three_way = evaluate_three_way_deposit_check(owner=owner)

    CloseChecklistItem.objects.update_or_create(
        owner=owner,
        period=period,
        check_code='CHK-TB-BALANCED',
        defaults={'label': 'Trial balance debits equal credits', 'passed': total_dr == total_cr},
    )
    CloseChecklistItem.objects.update_or_create(
        owner=owner,
        period=period,
        check_code='CHK-1040-ZERO',
        defaults={'label': 'Account 1040 Clearing is 0.00', 'passed': clearing_net == Decimal('0.00')},
    )
    CloseChecklistItem.objects.update_or_create(
        owner=owner,
        period=period,
        check_code='CHK-3WAY-DEPOSIT',
        defaults={
            'label': '3-way deposit tie-out (Lease == DepositMovement Subledger == GL 2120)',
            'passed': three_way['passed'],
            'detail': f"lease={three_way['lease_register_etb']} subledger={three_way['subledger_etb']} gl2120={three_way['gl_2120_etb']}",
        },
    )
    CloseChecklistItem.objects.update_or_create(
        owner=owner,
        period=period,
        check_code='CHK-1020-RECON',
        defaults={'label': 'Bank 1020 reconciliation posted', 'passed': recon_ok},
    )

    if not three_way['passed'] or not recon_ok:
        raise ValidationError('Close checklist failed: verify bank 1020 reconciliation and independent 3-way deposit match.')

    period.status = AccountingPeriod.Status.CLOSED
    period.last_trial_balance_etb = total_dr
    period.closed_at = timezone.now()
    period.closed_by = checker_actor_id
    period.save(update_fields=['status', 'last_trial_balance_etb', 'closed_at', 'closed_by'])
    return period
