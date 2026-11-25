import os
import pytest


@pytest.fixture(scope='session')
def django_db_setup(request):
    """
    When CI runs against a pre-created, pre-migrated, role-hardened PostgreSQL 16 test database
    as restricted role `adprms_app` (NOCREATEDB, NOBYPASSRLS), skip CREATE DATABASE and reuse the
    configured DATABASE_URL directly.
    """
    if os.environ.get('DJANGO_USE_PREMIGRATED_TEST_DB', '').lower() == 'true':
        yield
        return

    from pytest_django.fixtures import django_db_setup as default_django_db_setup

    yield from default_django_db_setup.__wrapped__(request)


@pytest.fixture
def django_db(db):
    """
    Provides a consistent baseline OwnerEntity, UserAccount, and open AccountingPeriod
    for Django DB tests while respecting PostgreSQL 16 FORCE ROW LEVEL SECURITY.
    """
    from datetime import date
    from django.db import transaction
    from apps.accounts.models import UserAccount
    from apps.common.permissions import bind_postgres_rls_owner
    from apps.ledger.models import AccountingPeriod
    from apps.portfolio.models import OwnerEntity

    with transaction.atomic():
        owner, _ = OwnerEntity.objects.get_or_create(
            code='OWN-BASE',
            defaults={
                'name': 'Base Test Owner',
                'entity_type': 'Undetermined',
                'effective_date': date(2026, 1, 1),
            },
        )
        bind_postgres_rls_owner(owner.code)

        user, created = UserAccount.objects.get_or_create(
            username='base_fin_user',
            defaults={
                'user_type': 'STAFF',
                'actor_id': 'ACT-BASE-FIN',
                'role': 'Finance Officer',
                'owner_code': owner.code,
                'allowed_owners': [owner.code],
            },
        )
        if created:
            user.set_password('StrongPassword!2026')
            user.save(update_fields=['password'])

        period, _ = AccountingPeriod.objects.get_or_create(
            owner=owner,
            period_code='2019-03',
            defaults={
                'fiscal_year_ec': 2019,
                'month_index': 3,
                'month_name_en': 'Hidar',
                'start_date_gc': date(2026, 11, 10),
                'end_date_gc': date(2026, 12, 9),
                'status': AccountingPeriod.Status.OPEN,
            },
        )

    return {
        'owner': owner,
        'user': user,
        'period': period,
    }
