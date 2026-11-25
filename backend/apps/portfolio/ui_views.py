from django.contrib.auth.decorators import login_required
from django.db import connection, transaction
from django.http import HttpResponseForbidden
from django.shortcuts import render
from apps.common.permissions import bind_postgres_rls_owner, get_active_owner_code_for_request
from apps.ledger.models import AccountingPeriod, JournalEntry, Ledger, TaxRulePack
from apps.ledger.services import evaluate_three_way_deposit_check
from apps.portfolio.models import Building, Lease, OwnerEntity, PartyIdentity, Unit


class _HeaderAdapter:
    def __init__(self, django_request):
        self.headers = django_request.headers
        self.query_params = django_request.GET


def _resolve_prod_owner_context(request):
    adapted = _HeaderAdapter(request)
    owner_code = get_active_owner_code_for_request(request.user, adapted)
    bind_postgres_rls_owner(owner_code)
    owner = OwnerEntity.objects.filter(code=owner_code).first()
    return owner_code, owner


@login_required
def prod_dashboard(request):
    if getattr(request.user, 'user_type', '') != 'STAFF':
        return HttpResponseForbidden('Staff authentication required for AD-PRMS Production Console.')
    with transaction.atomic():
        owner_code, owner = _resolve_prod_owner_context(request)
        buildings = list(Building.objects.filter(owner=owner).order_by('code')) if owner else []
        parties = list(PartyIdentity.objects.filter(owner=owner).order_by('code')) if owner else []
        three_way = evaluate_three_way_deposit_check(owner=owner) if owner else {'passed': True}
        tax_pack = TaxRulePack.objects.order_by('-effective_from', '-version').first()
        return render(
            request,
            'adprms_prod/dashboard.html',
            {
                'owner_code': owner_code,
                'owner': owner,
                'buildings': buildings,
                'parties': parties,
                'three_way': three_way,
                'tax_pack': tax_pack,
                'db_vendor': connection.vendor,
            },
        )


@login_required
def prod_portfolio_partial(request):
    if getattr(request.user, 'user_type', '') != 'STAFF':
        return HttpResponseForbidden('Staff authentication required.')
    with transaction.atomic():
        owner_code, owner = _resolve_prod_owner_context(request)
        buildings = list(Building.objects.filter(owner=owner).order_by('code')) if owner else []
        units_count = Unit.objects.filter(owner=owner).count() if owner else 0
        active_leases_count = Lease.objects.filter(owner=owner, status='Active').count() if owner else 0
        parties = list(PartyIdentity.objects.filter(owner=owner).order_by('code')) if owner else []
        return render(
            request,
            'adprms_prod/portfolio_partial.html',
            {
                'owner_code': owner_code,
                'owner': owner,
                'buildings': buildings,
                'units_count': units_count,
                'active_leases_count': active_leases_count,
                'parties': parties,
            },
        )


@login_required
def prod_ledger_partial(request):
    if getattr(request.user, 'user_type', '') != 'STAFF':
        return HttpResponseForbidden('Staff authentication required.')
    with transaction.atomic():
        owner_code, owner = _resolve_prod_owner_context(request)
        ledger = Ledger.objects.filter(owner=owner).first() if owner else None
        periods = list(AccountingPeriod.objects.filter(owner=owner).order_by('fiscal_year_ec', 'month_index')) if owner else []
        recent_journals = (
            list(JournalEntry.objects.filter(owner=owner).select_related('period').order_by('-posted_at')[:12])
            if owner
            else []
        )
        three_way = evaluate_three_way_deposit_check(owner=owner) if owner else {'passed': True}
        return render(
            request,
            'adprms_prod/ledger_partial.html',
            {
                'owner_code': owner_code,
                'ledger': ledger,
                'periods': periods,
                'recent_journals': recent_journals,
                'three_way': three_way,
            },
        )
