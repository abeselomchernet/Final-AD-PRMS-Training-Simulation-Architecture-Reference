from rest_framework import serializers
from .models import (
    AccountingPeriod,
    CloseChecklistItem,
    DepositMovement,
    FixedAssetItem,
    GatewaySettlementBatch,
    JournalEntry,
    JournalLine,
    Ledger,
    LedgerAccount,
    PostingRuleVersion,
    ReconciliationRun,
    TaxRulePack,
    TaxWorkpaper,
)


class LedgerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Ledger
        fields = (
            'id',
            'owner',
            'ledger_code',
            'entity_type',
            'vat_registered',
            'withholding_agent',
            'enforce_daily_cash_cap',
            'daily_cash_cap_etb',
            'basis',
            'framework',
            'enable_live_tax_invoicing',
            'active_tax_pack_id',
            'created_at',
            'updated_at',
        )
        read_only_fields = fields


class LedgerAccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = LedgerAccount
        fields = (
            'id',
            'owner',
            'code',
            'name',
            'name_am',
            'category',
            'normal_balance',
            'tax_deductible_class',
            'is_tax_locked',
            'is_system_controlled',
            'version',
            'status',
        )
        read_only_fields = fields


class AccountingPeriodSerializer(serializers.ModelSerializer):
    class Meta:
        model = AccountingPeriod
        fields = (
            'id',
            'owner',
            'fiscal_year_ec',
            'month_index',
            'period_code',
            'month_name_en',
            'month_name_am',
            'start_date_gc',
            'end_date_gc',
            'status',
            'last_trial_balance_etb',
            'closed_at',
            'closed_by',
            'reopen_reason',
        )
        read_only_fields = fields


class PostingRuleVersionSerializer(serializers.ModelSerializer):
    class Meta:
        model = PostingRuleVersion
        fields = (
            'id',
            'rule_id',
            'version',
            'title',
            'debit_account_code',
            'credit_account_code',
            'conditions',
            'effective_date',
            'is_active',
        )
        read_only_fields = fields


class JournalLineSerializer(serializers.ModelSerializer):
    account_code = serializers.CharField(source='account.code', read_only=True)
    account_name = serializers.CharField(source='account.name', read_only=True)

    class Meta:
        model = JournalLine
        fields = (
            'id',
            'owner',
            'entry',
            'line_number',
            'account',
            'account_code',
            'account_name',
            'debit_etb',
            'credit_etb',
            'tenant',
            'unit',
            'tax_code',
            'memo',
        )
        read_only_fields = fields


class JournalEntrySerializer(serializers.ModelSerializer):
    lines = JournalLineSerializer(many=True, read_only=True)
    period_code = serializers.CharField(source='period.period_code', read_only=True)

    class Meta:
        model = JournalEntry
        fields = (
            'id',
            'owner',
            'journal_number',
            'entry_date',
            'period',
            'period_code',
            'rule_id',
            'source_type',
            'source_id',
            'idempotency_key',
            'description',
            'status',
            'maker_actor_id',
            'checker_actor_id',
            'approval_request_id',
            'approval_payload_hash',
            'reversal_of_journal',
            'reversed_by_journal',
            'e_invoice_metadata',
            'posted_at',
            'lines',
        )
        read_only_fields = fields


class DepositMovementSerializer(serializers.ModelSerializer):
    tenant_code = serializers.CharField(source='tenant.code', read_only=True)
    tenant_name = serializers.CharField(source='tenant.name', read_only=True)
    lease_number = serializers.CharField(source='lease.lease_number', read_only=True)

    class Meta:
        model = DepositMovement
        fields = (
            'id',
            'owner',
            'tenant',
            'tenant_code',
            'tenant_name',
            'lease',
            'lease_number',
            'movement_type',
            'signed_amount_etb',
            'effective_date',
            'reference',
            'posted_journal',
            'maker_actor_id',
            'notes',
            'created_at',
        )
        read_only_fields = ('id', 'owner', 'maker_actor_id', 'created_at')


class GatewaySettlementBatchSerializer(serializers.ModelSerializer):
    class Meta:
        model = GatewaySettlementBatch
        fields = (
            'id',
            'owner',
            'batch_code',
            'provider',
            'settlement_date',
            'gross_etb',
            'gateway_fee_etb',
            'net_deposited_etb',
            'status',
            'settlement_journal',
        )
        read_only_fields = fields


class ReconciliationRunSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReconciliationRun
        fields = (
            'id',
            'owner',
            'period',
            'account_code',
            'statement_ending_etb',
            'ledger_ending_etb',
            'variance_etb',
            'status',
            'reconciled_by',
            'reconciled_at',
        )
        read_only_fields = fields


class CloseChecklistItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = CloseChecklistItem
        fields = (
            'id',
            'owner',
            'period',
            'check_code',
            'label',
            'passed',
            'detail',
        )
        read_only_fields = fields


class FixedAssetItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = FixedAssetItem
        fields = (
            'id',
            'owner',
            'asset_code',
            'name',
            'asset_account_code',
            'accum_depr_account_code',
            'cost_etb',
            'useful_life_months',
            'monthly_depreciation_etb',
            'accumulated_depreciation_etb',
            'last_depreciation_period',
        )
        read_only_fields = fields


class TaxRulePackSerializer(serializers.ModelSerializer):
    class Meta:
        model = TaxRulePack
        fields = (
            'id',
            'pack_id',
            'version',
            'proclamation_ref',
            'effective_from',
            'effective_to',
            'lifecycle_stage',
            'reviewer_name',
            'reviewer_license_ref',
            'approval_history_json',
            'parameters_json',
            'requires_four_signoffs',
            'created_at',
        )
        read_only_fields = ('id', 'created_at')


class TaxWorkpaperSerializer(serializers.ModelSerializer):
    class Meta:
        model = TaxWorkpaper
        fields = (
            'id',
            'owner',
            'period',
            'tax_pack',
            'entity_type_evaluated',
            'rule_pack_version',
            'evaluation_date',
            'gross_rent_etb',
            'deductible_expenses_etb',
            'taxable_income_books_etb',
            'tax_books_etb',
            'tax_flat_etb',
            'output_vat_draft_etb',
            'wht_payable_etb',
            'quarterly_advance_etb',
            'property_tax_draft_etb',
            'is_non_fiscal_draft',
            'generated_at',
        )
        read_only_fields = fields
