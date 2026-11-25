from datetime import date
from decimal import Decimal
import uuid

from django.core.exceptions import ValidationError
from django.db import transaction
import pytest

from apps.common.permissions import bind_postgres_rls_owner
from apps.ledger.models import AccountingPeriod, DepositMovement, JournalEntry, Ledger, LedgerAccount, TaxRulePack
from apps.ledger.services import (
    evaluate_three_way_deposit_check,
    post_ledger_event,
    record_deposit_movement,
    reverse_journal_entry,
)
from apps.ledger.tax_engine import compute_marginal_tax_from_bands, compute_workpaper_comparison
from apps.portfolio.models import Building, Lease, OwnerEntity, Property, TenantProfile, Unit


SAMPLE_1395_PARAMS = {
    'marginal_bands': [
        {'upper_etb': '24000.00', 'rate': '0.00', 'deduction_etb': '0.00'},
        {'upper_etb': '48000.00', 'rate': '0.15', 'deduction_etb': '3600.00'},
        {'upper_etb': '84000.00', 'rate': '0.20', 'deduction_etb': '6000.00'},
        {'upper_etb': '120000.00', 'rate': '0.25', 'deduction_etb': '10200.00'},
        {'upper_etb': '168000.00', 'rate': '0.30', 'deduction_etb': '16200.00'},
        {'upper_etb': None, 'rate': '0.35', 'deduction_etb': '24600.00'},
    ],
    'corporate_rate': '0.30',
    'flat_allowances': ['0.20', '0.35'],
    'vat_rate': '0.15',
    'wht_rate': '0.03',
    'quarterly_advance_ratio': '0.25',
    'property_tax_base_ratio': '0.25',
    'property_tax_levy_rate': '0.005',
}

LEGACY_1395_PARAMS = {
    **SAMPLE_1395_PARAMS,
    'corporate_rate': '0.28',
    'flat_allowances': ['0.35'],
}


def test_configured_marginal_bands_calculation():
    bands = SAMPLE_1395_PARAMS['marginal_bands']
    assert compute_marginal_tax_from_bands(Decimal('200000.00'), bands) == Decimal('45400.00')
    assert compute_marginal_tax_from_bands(Decimal('24000.00'), bands) == Decimal('0.00')


def test_workpaper_defaults_to_undetermined_and_non_fiscal_draft():
    wp = compute_workpaper_comparison(
        gross_rent_etb=Decimal('990000.00'),
        operating_expenses_etb=Decimal('200880.00'),
        depreciation_etb=Decimal('264000.00'),
        vat_registered=True,
        wht_qualifying_payments_etb=Decimal('12000.00'),
        property_assessed_value_etb=Decimal('6000000.00'),
        enable_live_tax_invoicing=True,  # Even when True, Draft + Undetermined keeps NON_FISCAL_DRAFT_ONLY
        parameters=SAMPLE_1395_PARAMS,
        rule_pack_meta={'pack_id': 'TAX-DRAFT-01', 'lifecycle_stage': 'Draft', 'reviewer_license_ref': ''},
    )
    assert wp['entity_type'] == 'Undetermined'
    assert wp['legal_form_status'] == 'UNDETERMINED_PENDING_DOCUMENTARY_CONFIRMATION'
    assert wp['books']['estimated_tax_etb'] is None
    assert wp['enable_live_tax_invoicing'] is False
    assert wp['fiscal_mode'] == 'NON_FISCAL_DRAFT_ONLY'
    assert wp['books']['taxable_income_etb'] == Decimal('525120.00')
    assert wp['flat_scenarios']['flat_20pct']['deductions_etb'] == Decimal('198000.00')
    assert wp['flat_scenarios']['flat_35pct']['deductions_etb'] == Decimal('346500.00')
    assert wp['output_vat_draft_etb'] == Decimal('148500.00')
    assert wp['wht_payable_etb'] == Decimal('360.00')
    assert wp['property_tax_base_etb'] == Decimal('1500000.00')


def test_workpaper_confirmed_plc_and_requires_four_signoffs():
    wp = compute_workpaper_comparison(
        gross_rent_etb=Decimal('500000.00'),
        operating_expenses_etb=Decimal('100000.00'),
        entity_type='PLC',
        vat_registered=False,
        enable_live_tax_invoicing=True,
        parameters=SAMPLE_1395_PARAMS,
        rule_pack_meta={
            'pack_id': 'TAX-ACTIVE-TEST',
            'lifecycle_stage': 'Active',
            'reviewer_license_ref': 'ADV-ET-101',
            'requires_four_signoffs': True,
            'four_signoffs_verified': False,
        },
    )
    assert wp['books']['taxable_income_etb'] == Decimal('400000.00')
    assert wp['books']['estimated_tax_etb'] == Decimal('120000.00')
    assert wp['fiscal_mode'] == 'NON_FISCAL_DRAFT_ONLY'


@pytest.mark.django_db
def test_historical_tax_rule_pack_effective_dates_and_reproducibility(django_db):
    TaxRulePack.objects.create(
        pack_id='PACK-2025-LEGACY',
        version=1,
        proclamation_ref='Legacy Proclamation Draft',
        effective_from=date(2025, 1, 1),
        effective_to=date(2026, 6, 30),
        lifecycle_stage='Draft',
        parameters_json=LEGACY_1395_PARAMS,
    )
    TaxRulePack.objects.create(
        pack_id='PACK-2026-NEW',
        version=2,
        proclamation_ref='1395/2025 Draft Pack',
        effective_from=date(2026, 7, 1),
        effective_to=None,
        lifecycle_stage='Draft',
        parameters_json=SAMPLE_1395_PARAMS,
    )

    before_change = compute_workpaper_comparison(
        gross_rent_etb=Decimal('500000.00'),
        operating_expenses_etb=Decimal('100000.00'),
        entity_type='PLC',
        as_of_date=date(2026, 5, 15),
    )
    after_change = compute_workpaper_comparison(
        gross_rent_etb=Decimal('500000.00'),
        operating_expenses_etb=Decimal('100000.00'),
        entity_type='PLC',
        as_of_date=date(2026, 8, 1),
    )
    assert before_change['pack_id'] == 'PACK-2025-LEGACY'
    assert before_change['books']['estimated_tax_etb'] == Decimal('112000.00')
    assert after_change['pack_id'] == 'PACK-2026-NEW'
    assert after_change['books']['estimated_tax_etb'] == Decimal('120000.00')


@pytest.mark.django_db
def test_pr08_failed_gateway_and_sod_reversal_guards(django_db):
    base_owner = django_db['owner']
    base_actor = django_db['user'].actor_id
    res = post_ledger_event(
        owner=base_owner,
        period_code=django_db['period'].period_code,
        entry_date=date(2026, 11, 24),
        rule_id='PR-08',
        source_type='GatewayAttempt',
        source_id='E1',
        idempotency_key='UNIT-PR08-E1',
        description='Failed Telebirr E1',
        lines=[],
        maker_actor_id=base_actor,
    )
    assert res is None

    dummy_entry = JournalEntry(id=uuid.uuid4(), owner=base_owner, journal_number='J15', maker_actor_id=base_actor)
    with pytest.raises(ValidationError):
        reverse_journal_entry(
            original_entry=dummy_entry,
            period_code=django_db['period'].period_code,
            reversal_date=date(2026, 11, 25),
            reason='Self reversal check',
            maker_actor_id=base_actor,
            checker_actor_id=base_actor,
        )


@pytest.mark.django_db
def test_ledger_posting_idempotency_period_lock_cash_cap_and_independent_3way_deposit(django_db):
    with transaction.atomic():
        owner = django_db['owner']
        bind_postgres_rls_owner(owner.code)

        Ledger.objects.create(
            owner=owner,
            ledger_code='LED-TEST-01',
            enforce_daily_cash_cap=True,
            daily_cash_cap_etb=Decimal('50000.00'),
        )
        open_period = django_db['period']
        closed_period = AccountingPeriod.objects.create(
            owner=owner,
            fiscal_year_ec=2019,
            month_index=2,
            period_code='2019-02',
            month_name_en='Tikimt',
            start_date_gc=date(2026, 10, 11),
            end_date_gc=date(2026, 11, 9),
            status=AccountingPeriod.Status.CLOSED,
        )

        acct_cash = LedgerAccount.objects.create(owner=owner, code='1010', name='Cash on Hand', category='Asset', normal_balance='Debit')
        acct_bank = LedgerAccount.objects.create(owner=owner, code='1020', name='CBE Bank', category='Asset', normal_balance='Debit')
        acct_dep = LedgerAccount.objects.create(owner=owner, code='2120', name='Tenant Deposits Held', category='Liability', normal_balance='Credit')
        acct_exp = LedgerAccount.objects.create(owner=owner, code='5600', name='Bank Charges', category='Expense', normal_balance='Debit')
        assert acct_cash and acct_bank and acct_dep and acct_exp and open_period and closed_period

        # 1. Unbalanced entry rejected
        with pytest.raises(ValidationError):
            post_ledger_event(
                owner=owner,
                period_code='2019-03',
                entry_date=date(2026, 11, 20),
                rule_id='PR-20',
                source_type='ManualJournal',
                source_id='M1',
                idempotency_key='UNBAL-1',
                description='Unbalanced',
                lines=[{'account_code': '5600', 'debit_etb': '100.00'}, {'account_code': '1020', 'credit_etb': '90.00'}],
                maker_actor_id='ACT-FIN',
            )

        # 2. Closed period rejected
        with pytest.raises(ValidationError):
            post_ledger_event(
                owner=owner,
                period_code='2019-02',
                entry_date=date(2026, 10, 20),
                rule_id='PR-20',
                source_type='ManualJournal',
                source_id='M2',
                idempotency_key='CLOSED-1',
                description='Closed period',
                lines=[{'account_code': '5600', 'debit_etb': '100.00'}, {'account_code': '1020', 'credit_etb': '100.00'}],
                maker_actor_id='ACT-FIN',
            )

        # 3. Cumulative daily cash cap (30k + 25k > 50k fails)
        post_ledger_event(
            owner=owner,
            period_code='2019-03',
            entry_date=date(2026, 11, 20),
            rule_id='PR-02',
            source_type='CashReceipt',
            source_id='C1',
            idempotency_key='CASH-1',
            description='First cash receipt',
            lines=[{'account_code': '1010', 'debit_etb': '30000.00'}, {'account_code': '1020', 'credit_etb': '30000.00'}],
            maker_actor_id='ACT-FIN',
        )
        with pytest.raises(ValidationError):
            post_ledger_event(
                owner=owner,
                period_code='2019-03',
                entry_date=date(2026, 11, 20),
                rule_id='PR-02',
                source_type='CashReceipt',
                source_id='C2',
                idempotency_key='CASH-2',
                description='Cumulative overflow',
                lines=[{'account_code': '1010', 'debit_etb': '25000.00'}, {'account_code': '1020', 'credit_etb': '25000.00'}],
                maker_actor_id='ACT-FIN',
            )

        # 4. Idempotency returns identical journal
        j_first = post_ledger_event(
            owner=owner,
            period_code='2019-03',
            entry_date=date(2026, 11, 21),
            rule_id='PR-20',
            source_type='ManualJournal',
            source_id='M3',
            idempotency_key='IDEMP-1',
            description='Bank fee',
            lines=[{'account_code': '5600', 'debit_etb': '250.00'}, {'account_code': '1020', 'credit_etb': '250.00'}],
            maker_actor_id='ACT-FIN',
            checker_actor_id='ACT-GM',
        )
        j_dup = post_ledger_event(
            owner=owner,
            period_code='2019-03',
            entry_date=date(2026, 11, 21),
            rule_id='PR-20',
            source_type='ManualJournal',
            source_id='M3',
            idempotency_key='IDEMP-1',
            description='Bank fee',
            lines=[{'account_code': '5600', 'debit_etb': '250.00'}, {'account_code': '1020', 'credit_etb': '250.00'}],
            maker_actor_id='ACT-FIN',
            checker_actor_id='ACT-GM',
        )
        assert j_first is not None and j_dup is not None and j_first.id == j_dup.id

        # 5. Independent DepositMovement subledger catches GL-to-subledger divergence
        prop = Property.objects.create(
            owner=owner, code='P1', name='Prop 1', sub_city='Bole', woreda='03', property_type='Commercial', effective_date=date(2026, 1, 1)
        )
        bldg = Building.objects.create(owner=owner, property_ref=prop, code='B1', name='B1')
        unit = Unit.objects.create(
            owner=owner, property_ref=prop, building=bldg, code='U1', name='Unit 1', area_sqm=Decimal('40.00'), unit_type='Shop', base_rent_etb=Decimal('15000.00')
        )
        tenant = TenantProfile.objects.create(
            owner=owner, code='T1', name='Tenant One', business_type='Retail', phone_msisdn='+251911223344'
        )
        lease = Lease.objects.create(
            owner=owner,
            lease_number='L-001',
            unit=unit,
            tenant=tenant,
            status='Active',
            start_date=date(2026, 11, 1),
            end_date=date(2027, 10, 31),
            monthly_rent_etb=Decimal('15000.00'),
            security_deposit_etb=Decimal('15000.00'),
        )
        dep_jrn = post_ledger_event(
            owner=owner,
            period_code='2019-03',
            entry_date=date(2026, 11, 22),
            rule_id='PR-09',
            source_type='LeaseDeposit',
            source_id=str(lease.id),
            idempotency_key='DEP-J1',
            description='Deposit receipt',
            lines=[
                {'account_code': '1020', 'debit_etb': '15000.00', 'tenant': tenant, 'unit': unit},
                {'account_code': '2120', 'credit_etb': '15000.00', 'tenant': tenant, 'unit': unit},
            ],
            maker_actor_id='ACT-FIN',
        )
        # Before DepositMovement subledger entry is recorded, 3-way check MUST fail!
        mismatch = evaluate_three_way_deposit_check(owner=owner)
        assert mismatch['passed'] is False
        assert mismatch['gl_2120_etb'] == Decimal('15000.00')
        assert mismatch['subledger_etb'] == Decimal('0.00')

        mov = record_deposit_movement(
            owner=owner,
            tenant=tenant,
            lease=lease,
            movement_type=DepositMovement.MovementType.RECEIPT,
            signed_amount_etb=Decimal('15000.00'),
            effective_date=date(2026, 11, 22),
            reference='DEP-L-001',
            maker_actor_id='ACT-FIN',
            posted_journal=dep_jrn,
        )
        assert mov.id is not None
        matched = evaluate_three_way_deposit_check(owner=owner)
        assert matched['passed'] is True
        assert matched['lease_register_etb'] == Decimal('15000.00')
        assert matched['subledger_etb'] == Decimal('15000.00')
        assert matched['gl_2120_etb'] == Decimal('15000.00')
