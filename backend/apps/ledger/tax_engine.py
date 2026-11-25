from datetime import date
from decimal import Decimal, ROUND_HALF_UP
from typing import Any
from django.db.models import Q

TWO_DP = Decimal('0.01')


def _q2(val: Decimal | int | float | str) -> Decimal:
    return Decimal(str(val)).quantize(TWO_DP, rounding=ROUND_HALF_UP)


def compute_marginal_tax_from_bands(
    annual_taxable_etb: Decimal | int | float | str,
    marginal_bands: list[dict[str, Any]],
) -> Decimal:
    """Evaluates progressive bands strictly from versioned rule-pack configuration."""
    if not marginal_bands:
        raise ValueError('Versioned rule pack is missing marginal_bands.')
    taxable = max(Decimal('0.00'), _q2(annual_taxable_etb))
    for band in marginal_bands:
        upper_raw = band.get('upper_etb')
        upper = Decimal(str(upper_raw)) if upper_raw is not None else None
        rate = Decimal(str(band['rate']))
        deduction = Decimal(str(band.get('deduction_etb', '0.00')))
        if upper is None or taxable <= upper:
            return max(Decimal('0.00'), _q2((taxable * rate) - deduction))
    return Decimal('0.00')


def resolve_tax_rule_pack(*, as_of_date: date | None = None, pack_id: str | None = None):
    """Fetches the active/draft versioned TaxRulePack for a given effective date or pack_id."""
    from .models import TaxRulePack

    if pack_id:
        return TaxRulePack.objects.filter(pack_id=pack_id).order_by('-version').first()

    target_date = as_of_date or date.today()
    return (
        TaxRulePack.objects.filter(effective_from__lte=target_date)
        .filter(Q(effective_to__isnull=True) | Q(effective_to__gte=target_date))
        .order_by('-effective_from', '-version')
        .first()
    )


def compute_workpaper_comparison(
    *,
    gross_rent_etb: Decimal,
    operating_expenses_etb: Decimal,
    depreciation_etb: Decimal = Decimal('0.00'),
    entity_type: str = 'Undetermined',
    vat_registered: bool = False,
    wht_qualifying_payments_etb: Decimal = Decimal('0.00'),
    property_assessed_value_etb: Decimal = Decimal('0.00'),
    enable_live_tax_invoicing: bool = False,
    parameters: dict[str, Any] | None = None,
    as_of_date: date | None = None,
    pack_id: str | None = None,
    rule_pack_meta: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Evaluates tax workpaper comparisons strictly from a versioned TaxRulePack configuration (#12).
    - No statutory rate, threshold, deduction, or property-tax base is hardcoded in calculation code.
    - Taxpayer legal form defaults to 'Undetermined' until documentary confirmation.
    - Output remains labeled NON_FISCAL_DRAFT_ONLY unless ALL activation gates, adviser sign-off,
      confirmed legal form, and ENABLE_LIVE_TAX_INVOICING are satisfied.
    """
    resolved_params = parameters
    meta = dict(rule_pack_meta or {})
    if resolved_params is None:
        pack = resolve_tax_rule_pack(as_of_date=as_of_date, pack_id=pack_id)
        if pack is None:
            raise ValueError(
                'No versioned TaxRulePack found for the requested evaluation date/pack_id; '
                'statutory parameters must come from a validated TaxRulePack.'
            )
        resolved_params = pack.parameters_json or {}
        meta.setdefault('pack_id', pack.pack_id)
        meta.setdefault('version', pack.version)
        meta.setdefault('proclamation_ref', pack.proclamation_ref)
        meta.setdefault('effective_from', pack.effective_from.isoformat())
        meta.setdefault('effective_to', pack.effective_to.isoformat() if pack.effective_to else None)
        meta.setdefault('lifecycle_stage', pack.lifecycle_stage)
        meta.setdefault('reviewer_name', pack.reviewer_name)
        meta.setdefault('reviewer_license_ref', pack.reviewer_license_ref)
        meta.setdefault('requires_four_signoffs', pack.requires_four_signoffs)

    required_keys = (
        'marginal_bands',
        'corporate_rate',
        'flat_allowances',
        'vat_rate',
        'wht_rate',
        'quarterly_advance_ratio',
        'property_tax_base_ratio',
        'property_tax_levy_rate',
    )
    missing = [k for k in required_keys if k not in resolved_params]
    if missing:
        raise ValueError(f'TaxRulePack parameters_json is incomplete; missing keys: {", ".join(missing)}')

    gross = max(Decimal('0.00'), _q2(gross_rent_etb))
    books_deductions = max(Decimal('0.00'), _q2(operating_expenses_etb + depreciation_etb))
    taxable_books = max(Decimal('0.00'), _q2(gross - books_deductions))

    marginal_bands = list(resolved_params['marginal_bands'])
    corporate_rate = Decimal(str(resolved_params['corporate_rate']))
    vat_rate = Decimal(str(resolved_params['vat_rate']))
    wht_rate = Decimal(str(resolved_params['wht_rate']))
    advance_ratio = Decimal(str(resolved_params['quarterly_advance_ratio']))
    prop_base_ratio = Decimal(str(resolved_params['property_tax_base_ratio']))
    prop_levy_rate = Decimal(str(resolved_params['property_tax_levy_rate']))

    allowances = [Decimal(str(a)) for a in resolved_params['flat_allowances']]
    flat_scenarios: dict[str, dict[str, Decimal]] = {}
    for pct in allowances:
        pct_label = f"flat_{int((pct * Decimal('100')).to_integral_value())}pct"
        deductions = _q2(gross * pct)
        taxable_flat = max(Decimal('0.00'), _q2(gross - deductions))
        if entity_type == 'PLC':
            est = _q2(taxable_flat * corporate_rate)
        elif entity_type == 'SoleProprietor':
            est = compute_marginal_tax_from_bands(taxable_flat, marginal_bands)
        else:
            est = Decimal('0.00')
        flat_scenarios[pct_label] = {
            'allowance_ratio': pct,
            'deductions_etb': deductions,
            'taxable_income_etb': taxable_flat,
            'estimated_tax_etb': est if entity_type in ('SoleProprietor', 'PLC') else None,
            'sole_proprietor_draft_etb': compute_marginal_tax_from_bands(taxable_flat, marginal_bands),
            'plc_draft_etb': _q2(taxable_flat * corporate_rate),
        }

    sole_prop_books_tax = compute_marginal_tax_from_bands(taxable_books, marginal_bands)
    plc_books_tax = _q2(taxable_books * corporate_rate)
    if entity_type == 'PLC':
        tax_books: Decimal | None = plc_books_tax
        quarterly_advance = _q2(plc_books_tax * advance_ratio)
        legal_form_status = 'CONFIRMED_PLC'
    elif entity_type == 'SoleProprietor':
        tax_books = sole_prop_books_tax
        quarterly_advance = _q2(sole_prop_books_tax * advance_ratio)
        legal_form_status = 'CONFIRMED_SOLE_PROPRIETOR'
    else:
        tax_books = None
        quarterly_advance = Decimal('0.00')
        legal_form_status = 'UNDETERMINED_PENDING_DOCUMENTARY_CONFIRMATION'

    output_vat_draft = _q2(gross * vat_rate) if vat_registered else Decimal('0.00')
    wht_payable = _q2(wht_qualifying_payments_etb * wht_rate)
    property_tax_base = _q2(property_assessed_value_etb * prop_base_ratio)
    property_tax_draft = _q2(property_tax_base * prop_levy_rate)

    adviser_signed = bool(meta.get('reviewer_license_ref'))
    pack_active = meta.get('lifecycle_stage') == 'Active'
    four_signoffs_ok = (not meta.get('requires_four_signoffs', True)) or bool(meta.get('four_signoffs_verified', False))
    live_allowed = bool(
        enable_live_tax_invoicing
        and adviser_signed
        and pack_active
        and four_signoffs_ok
        and entity_type in ('SoleProprietor', 'PLC')
    )

    return {
        'pack_id': meta.get('pack_id', pack_id or 'UNASSIGNED_DRAFT_PACK'),
        'pack_version': meta.get('version', 1),
        'proclamation_ref': meta.get('proclamation_ref', 'UNVERIFIED_DRAFT_SOURCE'),
        'effective_from': meta.get('effective_from'),
        'effective_to': meta.get('effective_to'),
        'evaluation_date': (as_of_date or date.today()).isoformat(),
        'lifecycle_stage': meta.get('lifecycle_stage', 'Draft'),
        'adviser_signed_off': adviser_signed,
        'fiscal_mode': 'LIVE_FISCAL' if live_allowed else 'NON_FISCAL_DRAFT_ONLY',
        'is_non_fiscal_draft': not live_allowed,
        'enable_live_tax_invoicing': live_allowed,
        'entity_type': entity_type,
        'legal_form_status': legal_form_status,
        'gross_rent_etb': gross,
        'books': {
            'deductions_etb': books_deductions,
            'taxable_income_etb': taxable_books,
            'estimated_tax_etb': tax_books,
            'sole_proprietor_draft_etb': sole_prop_books_tax,
            'plc_draft_etb': plc_books_tax,
        },
        'flat_scenarios': flat_scenarios,
        'output_vat_draft_etb': output_vat_draft,
        'wht_payable_etb': wht_payable,
        'quarterly_advance_etb': quarterly_advance,
        'property_tax_base_etb': property_tax_base,
        'property_tax_draft_etb': property_tax_draft,
    }
