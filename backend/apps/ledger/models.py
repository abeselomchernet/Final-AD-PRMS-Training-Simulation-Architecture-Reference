from decimal import Decimal
import uuid
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q
from apps.portfolio.models import Lease, OwnerEntity, TenantProfile, Unit


class Ledger(models.Model):
    class Basis(models.TextChoices):
        ACCRUAL = 'Accrual', 'Accrual'
        CASH = 'Cash', 'Cash'

    class EntityType(models.TextChoices):
        UNDETERMINED = 'Undetermined', 'Undetermined (Pending Documentary Confirmation)'
        SOLE_PROPRIETOR = 'SoleProprietor', 'Individual / Sole Proprietor'
        PLC = 'PLC', 'PLC / Share Company'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.OneToOneField(OwnerEntity, on_delete=models.PROTECT, related_name='ledger')
    ledger_code = models.CharField(max_length=48, unique=True)
    entity_type = models.CharField(max_length=24, choices=EntityType.choices, default=EntityType.UNDETERMINED)
    vat_registered = models.BooleanField(default=False)
    withholding_agent = models.BooleanField(default=False)
    enforce_daily_cash_cap = models.BooleanField(default=False)
    daily_cash_cap_etb = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('50000.00'))
    basis = models.CharField(max_length=16, choices=Basis.choices, default=Basis.ACCRUAL)
    framework = models.CharField(max_length=64, default='Ethiopian SME / IPSAS-aligned')
    enable_live_tax_invoicing = models.BooleanField(default=False)
    active_tax_pack_id = models.CharField(max_length=64, default='TAX-ET-1395-V2026')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class LedgerAccount(models.Model):
    class Category(models.TextChoices):
        ASSET = 'Asset', 'Asset'
        CONTRA_ASSET = 'Contra-Asset', 'Contra-Asset'
        LIABILITY = 'Liability', 'Liability'
        EQUITY = 'Equity', 'Equity'
        REVENUE = 'Revenue', 'Revenue'
        EXPENSE = 'Expense', 'Expense'

    class NormalBalance(models.TextChoices):
        DEBIT = 'Debit', 'Debit'
        CREDIT = 'Credit', 'Credit'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(OwnerEntity, on_delete=models.PROTECT, related_name='ledger_accounts')
    code = models.CharField(max_length=16, db_index=True)
    name = models.CharField(max_length=255)
    name_am = models.CharField(max_length=255, blank=True)
    category = models.CharField(max_length=24, choices=Category.choices)
    normal_balance = models.CharField(max_length=16, choices=NormalBalance.choices)
    tax_deductible_class = models.CharField(max_length=64, default='Standard')
    is_tax_locked = models.BooleanField(default=False)
    is_system_controlled = models.BooleanField(default=False)
    version = models.PositiveIntegerField(default=1)
    status = models.CharField(max_length=24, default='Active')

    class Meta:
        unique_together = ('owner', 'code', 'version')
        indexes = [models.Index(fields=['owner', 'code', 'status'], name='ledger_acct_owner_code_idx')]


class AccountingPeriod(models.Model):
    class Status(models.TextChoices):
        OPEN = 'Open', 'Open'
        SOFT_CLOSED = 'Soft-Closed', 'Soft-Closed'
        CLOSED = 'Closed', 'Closed'
        REOPENED = 'Reopened', 'Reopened'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(OwnerEntity, on_delete=models.PROTECT, related_name='accounting_periods')
    fiscal_year_ec = models.PositiveIntegerField(default=2019)
    month_index = models.PositiveSmallIntegerField()
    period_code = models.CharField(max_length=16)
    month_name_en = models.CharField(max_length=64)
    month_name_am = models.CharField(max_length=64, blank=True)
    start_date_gc = models.DateField()
    end_date_gc = models.DateField()
    status = models.CharField(max_length=24, choices=Status.choices, default=Status.OPEN)
    last_trial_balance_etb = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    closed_at = models.DateTimeField(null=True, blank=True)
    closed_by = models.CharField(max_length=120, blank=True)
    reopen_reason = models.TextField(blank=True)

    class Meta:
        unique_together = ('owner', 'period_code')
        ordering = ['fiscal_year_ec', 'month_index']


class PostingRuleVersion(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    rule_id = models.CharField(max_length=16, db_index=True)
    version = models.PositiveIntegerField(default=1)
    title = models.CharField(max_length=255)
    debit_account_code = models.CharField(max_length=16)
    credit_account_code = models.CharField(max_length=16)
    conditions = models.TextField(blank=True)
    effective_date = models.DateField()
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = ('rule_id', 'version')


class JournalEntry(models.Model):
    class Status(models.TextChoices):
        POSTED = 'Posted', 'Posted'
        REVERSED = 'Reversed', 'Reversed'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(OwnerEntity, on_delete=models.PROTECT, related_name='journal_entries')
    journal_number = models.CharField(max_length=48)
    entry_date = models.DateField()
    period = models.ForeignKey(AccountingPeriod, on_delete=models.PROTECT, related_name='journal_entries')
    rule_id = models.CharField(max_length=16, db_index=True)
    source_type = models.CharField(max_length=64)
    source_id = models.CharField(max_length=64, db_index=True)
    idempotency_key = models.CharField(max_length=128)
    description = models.TextField()
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.POSTED)
    maker_actor_id = models.CharField(max_length=64)
    checker_actor_id = models.CharField(max_length=64, blank=True)
    approval_request_id = models.UUIDField(null=True, blank=True, db_index=True)
    approval_payload_hash = models.CharField(max_length=64, blank=True)
    reversal_of_journal = models.ForeignKey(
        'self', null=True, blank=True, on_delete=models.PROTECT, related_name='reversing_entries'
    )
    reversed_by_journal = models.ForeignKey(
        'self', null=True, blank=True, on_delete=models.PROTECT, related_name='reversed_original_entries'
    )
    e_invoice_metadata = models.JSONField(default=dict, blank=True)
    posted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = [('owner', 'journal_number'), ('owner', 'idempotency_key')]
        indexes = [models.Index(fields=['owner', 'period', 'entry_date'], name='ledger_jrn_owner_per_dt_idx')]


class JournalLine(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(OwnerEntity, on_delete=models.PROTECT, related_name='journal_lines')
    entry = models.ForeignKey(JournalEntry, on_delete=models.CASCADE, related_name='lines')
    line_number = models.PositiveSmallIntegerField()
    account = models.ForeignKey(LedgerAccount, on_delete=models.PROTECT, related_name='journal_lines')
    debit_etb = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    credit_etb = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    tenant = models.ForeignKey(TenantProfile, null=True, blank=True, on_delete=models.PROTECT)
    unit = models.ForeignKey(Unit, null=True, blank=True, on_delete=models.PROTECT)
    tax_code = models.CharField(max_length=32, blank=True)
    memo = models.CharField(max_length=255, blank=True)

    class Meta:
        unique_together = ('entry', 'line_number')
        constraints = [
            models.CheckConstraint(condition=Q(debit_etb__gte=0) & Q(credit_etb__gte=0), name='ledger_line_non_negative'),
            models.CheckConstraint(
                condition=~(Q(debit_etb__gt=0) & Q(credit_etb__gt=0)),
                name='ledger_line_single_sided',
            ),
        ]


class DepositMovement(models.Model):
    """
    Independent append-only tenant security-deposit subledger (#11).
    Tracks receipts, refunds, deductions, lease transfers, and opening balances
    independently of JournalLine so 3-way tie-out checks real subledger divergence.
    """

    class MovementType(models.TextChoices):
        RECEIPT = 'Receipt', 'Receipt'
        REFUND = 'Refund', 'Refund'
        DEDUCTION = 'Deduction', 'Deduction'
        LEASE_TRANSFER = 'LeaseTransfer', 'Lease Transfer'
        OPENING_BALANCE = 'OpeningBalance', 'Opening Balance'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(OwnerEntity, on_delete=models.PROTECT, related_name='deposit_movements')
    tenant = models.ForeignKey(TenantProfile, on_delete=models.PROTECT, related_name='deposit_movements')
    lease = models.ForeignKey(Lease, on_delete=models.PROTECT, related_name='deposit_movements')
    movement_type = models.CharField(max_length=24, choices=MovementType.choices)
    signed_amount_etb = models.DecimalField(max_digits=14, decimal_places=2)
    effective_date = models.DateField()
    reference = models.CharField(max_length=128)
    posted_journal = models.ForeignKey(
        JournalEntry, null=True, blank=True, on_delete=models.PROTECT, related_name='deposit_movements'
    )
    maker_actor_id = models.CharField(max_length=64)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=['owner', 'tenant', 'effective_date'], name='ledger_dep_own_ten_dt_idx')]

    def clean(self) -> None:
        if self.tenant_id and self.owner_id and self.tenant.owner_id != self.owner_id:
            raise ValidationError('Cross-owner invariant violation: DepositMovement.owner must match Tenant.owner.')
        if self.lease_id and self.owner_id and self.lease.owner_id != self.owner_id:
            raise ValidationError('Cross-owner invariant violation: DepositMovement.owner must match Lease.owner.')
        if self.signed_amount_etb == Decimal('0.00'):
            raise ValidationError('DepositMovement signed_amount_etb cannot be zero.')

    def save(self, *args, **kwargs):
        if not self._state.adding:
            raise ValidationError('DepositMovement is append-only and cannot be modified.')
        self.clean()
        return super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValidationError('DepositMovement is append-only and cannot be deleted.')


class LeaseAccountingSchedule(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(OwnerEntity, on_delete=models.PROTECT, related_name='lease_schedules')
    lease = models.ForeignKey(Lease, on_delete=models.PROTECT, related_name='accounting_schedules')
    period = models.ForeignKey(AccountingPeriod, on_delete=models.PROTECT, related_name='lease_schedules')
    earned_rent_etb = models.DecimalField(max_digits=14, decimal_places=2)
    billed_rent_etb = models.DecimalField(max_digits=14, decimal_places=2)
    deferred_balance_etb = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    accrued_balance_etb = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    posted_journal = models.ForeignKey(JournalEntry, null=True, blank=True, on_delete=models.PROTECT)

    class Meta:
        indexes = [models.Index(fields=['owner', 'lease', 'period'], name='ledger_sched_own_lse_per_idx')]


class GatewaySettlementBatch(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(OwnerEntity, on_delete=models.PROTECT, related_name='settlement_batches')
    batch_code = models.CharField(max_length=64)
    provider = models.CharField(max_length=32)
    settlement_date = models.DateField()
    gross_etb = models.DecimalField(max_digits=14, decimal_places=2)
    gateway_fee_etb = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    net_deposited_etb = models.DecimalField(max_digits=14, decimal_places=2)
    status = models.CharField(max_length=32, default='Reconciled')
    settlement_journal = models.ForeignKey(JournalEntry, null=True, blank=True, on_delete=models.PROTECT)

    class Meta:
        unique_together = ('owner', 'batch_code')


class ReconciliationRun(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(OwnerEntity, on_delete=models.PROTECT, related_name='reconciliation_runs')
    period = models.ForeignKey(AccountingPeriod, on_delete=models.PROTECT, related_name='reconciliation_runs')
    account_code = models.CharField(max_length=16)
    statement_ending_etb = models.DecimalField(max_digits=14, decimal_places=2)
    ledger_ending_etb = models.DecimalField(max_digits=14, decimal_places=2)
    variance_etb = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    status = models.CharField(max_length=24, default='Reconciled')
    reconciled_by = models.CharField(max_length=120)
    reconciled_at = models.DateTimeField(auto_now_add=True)


class CloseChecklistItem(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(OwnerEntity, on_delete=models.PROTECT, related_name='close_checklist_items')
    period = models.ForeignKey(AccountingPeriod, on_delete=models.PROTECT, related_name='close_checklist_items')
    check_code = models.CharField(max_length=32)
    label = models.CharField(max_length=255)
    passed = models.BooleanField(default=False)
    detail = models.TextField(blank=True)

    class Meta:
        unique_together = ('owner', 'period', 'check_code')


class FixedAssetItem(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(OwnerEntity, on_delete=models.PROTECT, related_name='fixed_assets')
    asset_code = models.CharField(max_length=48)
    name = models.CharField(max_length=255)
    asset_account_code = models.CharField(max_length=16, default='1510')
    accum_depr_account_code = models.CharField(max_length=16, default='1590')
    cost_etb = models.DecimalField(max_digits=14, decimal_places=2)
    useful_life_months = models.PositiveIntegerField(default=60)
    monthly_depreciation_etb = models.DecimalField(max_digits=14, decimal_places=2)
    accumulated_depreciation_etb = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    last_depreciation_period = models.CharField(max_length=16, blank=True)

    class Meta:
        unique_together = ('owner', 'asset_code')


class TaxRulePack(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    pack_id = models.CharField(max_length=64, unique=True)
    version = models.PositiveIntegerField(default=1)
    proclamation_ref = models.CharField(max_length=128)
    effective_from = models.DateField()
    effective_to = models.DateField(null=True, blank=True)
    lifecycle_stage = models.CharField(max_length=24, default='Draft')
    reviewer_name = models.CharField(max_length=128, blank=True)
    reviewer_license_ref = models.CharField(max_length=128, blank=True)
    approval_history_json = models.JSONField(default=list, blank=True)
    parameters_json = models.JSONField(default=dict)
    requires_four_signoffs = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)


class TaxWorkpaper(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.ForeignKey(OwnerEntity, on_delete=models.PROTECT, related_name='tax_workpapers')
    period = models.ForeignKey(AccountingPeriod, on_delete=models.PROTECT, related_name='tax_workpapers')
    tax_pack = models.ForeignKey(TaxRulePack, on_delete=models.PROTECT, related_name='workpapers')
    entity_type_evaluated = models.CharField(max_length=24, default='Undetermined')
    rule_pack_version = models.PositiveIntegerField(default=1)
    evaluation_date = models.DateField(null=True, blank=True)
    gross_rent_etb = models.DecimalField(max_digits=14, decimal_places=2)
    deductible_expenses_etb = models.DecimalField(max_digits=14, decimal_places=2)
    taxable_income_books_etb = models.DecimalField(max_digits=14, decimal_places=2)
    tax_books_etb = models.DecimalField(max_digits=14, decimal_places=2)
    tax_flat_etb = models.DecimalField(max_digits=14, decimal_places=2)
    output_vat_draft_etb = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    wht_payable_etb = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    quarterly_advance_etb = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    property_tax_draft_etb = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal('0.00'))
    is_non_fiscal_draft = models.BooleanField(default=True)
    generated_at = models.DateTimeField(auto_now_add=True)
