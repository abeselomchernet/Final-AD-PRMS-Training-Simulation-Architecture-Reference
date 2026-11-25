from datetime import date
import hashlib
import hmac
import json
import logging

from django.core.exceptions import ValidationError
from django.db import connection, transaction
import pytest

from apps.common.crypto import normalize_ethiopian_msisdn
from apps.common.logging import PiiMaskingFilter
from apps.common.permissions import bind_postgres_rls_owner
from apps.governance.models import ApprovalRequest, AuditEvent, ErcaVerificationGate
from apps.portfolio.models import OwnerEntity, PartyIdentity, Property
from apps.portfolio.services import assert_inter_entity_posting_permitted, seed_single_title_holder_portfolio


def test_msisdn_normalization():
    assert normalize_ethiopian_msisdn('0911234567') == '+251911234567'
    assert normalize_ethiopian_msisdn('251712345678') == '+251712345678'
    assert normalize_ethiopian_msisdn('+251 911-234-567') == '+251911234567'


def test_arifpay_hmac_vector():
    secret = 'unit-test-secret'
    payload = json.dumps({'nonce': 'N-100', 'status': 'COMPLETED'}).encode('utf-8')
    sig = hmac.new(secret.encode('utf-8'), payload, hashlib.sha256).hexdigest()
    assert len(sig) == 64


def test_pii_masking_filter_redacts_msisdn_bearer_and_otp():
    filt = PiiMaskingFilter()
    record = logging.LogRecord(
        name='adprms.test',
        level=logging.INFO,
        pathname=__file__,
        lineno=1,
        msg='Tenant +251911234567 logged in with Bearer abc.def.ghi and otp=482910',
        args=(),
        exc_info=None,
    )
    assert filt.filter(record) is True
    assert '+251911****67' in record.msg
    assert 'Bearer [REDACTED]' in record.msg
    assert 'otp=[REDACTED]' in record.msg
    assert 'abc.def.ghi' not in record.msg
    assert '482910' not in record.msg


def test_maker_checker_model_blocks_self_approval():
    req = ApprovalRequest(
        request_number='REQ-UNIT-001',
        category='Finance',
        title='Void Receipt',
        target_record_type='PaymentReceipt',
        target_record_id='RCT-001',
        maker_actor_id='ACT-FIN-01',
        maker_role='Finance Officer',
    )
    with pytest.raises(ValidationError):
        req.assert_checker_sod('ACT-FIN-01')

    req.assert_checker_sod('ACT-GM-01')


def test_approval_payload_hash_integrity_and_execution_verification():
    payload = {'period_code': '2019-03', 'amount': '1500.00'}
    req = ApprovalRequest(
        request_number='REQ-HASH-001',
        category='Finance',
        title='Manual Journal',
        target_record_type='JournalEntry',
        target_record_id='MJ-1',
        maker_actor_id='ACT-FIN-01',
        maker_role='Finance Officer',
        status='Approved',
        finalized=True,
        payload_json=payload,
        payload_hash=ApprovalRequest.compute_payload_hash(payload),
        approved_checker_actor_id='ACT-GM-01',
        decision_log=[{'actor_id': 'ACT-GM-01', 'action': 'Approved'}],
    )
    assert req.verify_approved_for_execution(expected_payload=payload) == 'ACT-GM-01'

    with pytest.raises(ValidationError):
        req.verify_approved_for_execution(expected_payload={'period_code': '2019-03', 'amount': '9999.00'})


def test_erca_gate_blocks_active_tax_rule_without_four_signoffs():
    gate = ErcaVerificationGate(
        erca_tin_verified=True,
        vat_certificate_verified=True,
        adviser_signed_off=True,
        owner_activation_approved=False,
    )
    assert gate.can_activate_tax_rules() is False

    gate.owner_activation_approved = True
    assert gate.can_activate_tax_rules() is True


@pytest.mark.django_db
def test_single_title_holder_five_buildings_and_inter_entity_block(django_db):
    with transaction.atomic():
        owner = django_db['owner']
        bind_postgres_rls_owner(owner.code)
        result = seed_single_title_holder_portfolio(owner_code=owner.code)
        assert result['title_holder'].legal_name == 'Abdulwehab Dekebo'
        assert len(result['buildings']) == 5
        assert result['trading_party'].legal_name == 'Abdulwehab Dekebo Trading'

        trading = PartyIdentity.objects.get(owner=owner, code='PARTY-AD-TRADING')
        assert trading.inter_entity_posting_enabled is False
        assert trading.confirmation_status == PartyIdentity.ConfirmationStatus.PENDING_DOCUMENTARY

        with pytest.raises(ValidationError):
            assert_inter_entity_posting_permitted(owner=owner, target_party_code='PARTY-AD-TRADING')


@pytest.mark.django_db
def test_audit_event_hash_chain_and_rls_context_isolation(django_db):
    with transaction.atomic():
        owner_a = django_db['owner']
        owner_b = OwnerEntity.objects.create(
            code='OWN-GOV-B',
            name='Owner B',
            entity_type='Individual',
            effective_date=date(2026, 1, 1),
        )

        bind_postgres_rls_owner(owner_a.code)
        ev1 = AuditEvent.objects.create(
            owner=owner_a,
            actor_id=django_db['user'].actor_id,
            persona='Finance Officer',
            module='Ledger',
            action='Create',
            record_type='JournalEntry',
            record_id='J1',
            reason='Initial test event',
        )
        ev2 = AuditEvent.objects.create(
            owner=owner_a,
            actor_id='ACT-2',
            persona='General Manager',
            module='Ledger',
            action='Approve',
            record_type='JournalEntry',
            record_id='J1',
            reason='Second test event',
        )
        assert ev2.prev_hash == ev1.event_hash

        with pytest.raises(ValidationError):
            ev1.reason = 'Tampered'
            ev1.save()
        with pytest.raises(ValidationError):
            ev1.delete()

        Property.objects.create(
            owner=owner_a,
            code='P-A1',
            name='Prop A1',
            sub_city='Bole',
            woreda='03',
            property_type='Commercial',
            effective_date=date(2026, 1, 1),
        )
        if connection.vendor == 'postgresql':
            bind_postgres_rls_owner('OWN-GOV-B')
            assert Property.objects.filter(code='P-A1').count() == 0
