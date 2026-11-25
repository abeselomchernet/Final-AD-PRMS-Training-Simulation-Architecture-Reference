from datetime import date
from django.core.exceptions import ValidationError
from django.db import transaction
from apps.common.permissions import bind_postgres_rls_owner
from .models import Building, OwnerEntity, PartyIdentity, Property


@transaction.atomic
def seed_single_title_holder_portfolio(*, owner_code: str = 'OWN-ABDULWEHAB') -> dict:
    """
    Canonical production portfolio structure for Issue #8:
    - 1 registered Title-Holder (Abdulwehab Dekebo) owning 5 commercial/mixed-use buildings (~20 rentable units each).
    - Separate PartyIdentity for 'Abdulwehab Dekebo Trading' marked 'Pending Documentary Confirmation'
      with inter_entity_posting_enabled=False until tax/legal advisers verify registration.
    """
    owner, _ = OwnerEntity.objects.get_or_create(
        code=owner_code,
        defaults={
            'name': 'Abdulwehab Dekebo (Registered Title-Holder)',
            'entity_type': 'Undetermined — Pending Documentary Confirmation',
            'status': 'Active',
            'effective_date': date(2026, 1, 1),
        },
    )
    bind_postgres_rls_owner(owner.code)

    title_holder, _ = PartyIdentity.objects.get_or_create(
        owner=owner,
        code='PARTY-TITLE-HOLDER',
        defaults={
            'legal_name': 'Abdulwehab Dekebo',
            'party_kind': PartyIdentity.PartyKind.REGISTERED_TITLE_HOLDER,
            'confirmation_status': PartyIdentity.ConfirmationStatus.CONFIRMED_TITLE_HOLDER,
            'inter_entity_posting_enabled': False,
            'notes': 'Single registered property title-holder across all five buildings.',
        },
    )

    trading_party, _ = PartyIdentity.objects.get_or_create(
        owner=owner,
        code='PARTY-AD-TRADING',
        defaults={
            'legal_name': 'Abdulwehab Dekebo Trading',
            'party_kind': PartyIdentity.PartyKind.PENDING_TRADING_IDENTITY,
            'confirmation_status': PartyIdentity.ConfirmationStatus.PENDING_DOCUMENTARY,
            'inter_entity_posting_enabled': False,
            'notes': 'Distinct commercial trading identity; inter-entity ledger postings blocked pending documentary review.',
        },
    )

    prop, _ = Property.objects.get_or_create(
        owner=owner,
        code='PROP-AD-CORE',
        defaults={
            'name': 'Abdulwehab Dekebo Five-Building Portfolio',
            'sub_city': 'Addis Ababa (Bole / Kirkos / Yeka — Deed Pending)',
            'woreda': 'TBD',
            'property_type': 'Mixed-Use Commercial',
            'status': 'Active',
            'effective_date': date(2026, 1, 1),
        },
    )

    buildings = []
    for idx in range(1, 6):
        bld, _ = Building.objects.get_or_create(
            owner=owner,
            code=f'BLD-0{idx}',
            defaults={
                'property_ref': prop,
                'name': f'Abdulwehab Building {idx}',
                'floors': 4,
                'total_units_expected': 20,
                'unit_count_status': Building.UnitCountStatus.PROVISIONAL,
                'address_note': f'Building {idx} (~20 rentable units estimated pending physical unit audit)',
            },
        )
        buildings.append(bld)

    return {
        'owner': owner,
        'title_holder': title_holder,
        'trading_party': trading_party,
        'property': prop,
        'buildings': buildings,
    }


def assert_inter_entity_posting_permitted(owner: OwnerEntity, target_party_code: str) -> None:
    """Blocks cross-entity postings to/from Abdulwehab Dekebo Trading unless documentary confirmation & opt-in pass."""
    party = PartyIdentity.objects.filter(owner=owner, code=target_party_code).first()
    if not party:
        raise ValidationError(f'Unknown PartyIdentity "{target_party_code}" for owner {owner.code}.')
    if (
        party.confirmation_status != PartyIdentity.ConfirmationStatus.CONFIRMED_TITLE_HOLDER
        and not party.inter_entity_posting_enabled
    ):
        raise ValidationError(
            f'Inter-entity posting with "{party.legal_name}" ({party.confirmation_status}) is blocked '
            'pending legal/tax documentary review.'
        )
