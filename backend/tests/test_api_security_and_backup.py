from datetime import date
from decimal import Decimal
import hashlib
import json
from pathlib import Path
import uuid

from django.db import transaction
from django.test import override_settings
import pytest
from rest_framework.test import APIClient

from apps.accounts.models import UserAccount
from apps.common.permissions import bind_postgres_rls_owner
from apps.governance.models import ApprovalRequest, AuditEvent
from apps.ledger.models import AccountingPeriod, JournalEntry, LedgerAccount
from apps.portfolio.models import OwnerEntity
from scripts.verify_restore_reconciliation import run_reconciliation, validate_manifest_dict, verify_audit_chain


@pytest.mark.django_db
def test_api_rbac_approval_forgery_protection_and_prod_ui(tmp_path):
    with transaction.atomic():
        owner = OwnerEntity.objects.create(
            code='OWN-API-A',
            name='API Owner A',
            entity_type='Undetermined',
            effective_date=date(2026, 1, 1),
        )
        bind_postgres_rls_owner('OWN-API-A')

        AccountingPeriod.objects.create(
            owner=owner,
            fiscal_year_ec=2019,
            month_index=3,
            period_code='2019-03',
            month_name_en='Hidar',
            start_date_gc=date(2026, 11, 10),
            end_date_gc=date(2026, 12, 9),
        )
        LedgerAccount.objects.create(owner=owner, code='1020', name='CBE Bank', category='Asset', normal_balance='Debit')
        LedgerAccount.objects.create(owner=owner, code='5600', name='Bank Charges', category='Expense', normal_balance='Debit')

        fin_user = UserAccount.objects.create_user(
            username='fin_api',
            password='StrongPassword!2026',
            user_type='STAFF',
            actor_id='ACT-FIN-API',
            role='Finance Officer',
            owner_code='OWN-API-A',
            allowed_owners=['OWN-API-A'],
        )
        gm_user = UserAccount.objects.create_user(
            username='gm_api',
            password='StrongPassword!2026',
            user_type='STAFF',
            actor_id='ACT-GM-API',
            role='General Manager',
            owner_code='OWN-API-A',
            allowed_owners=['OWN-API-A'],
        )
        auditor_user = UserAccount.objects.create_user(
            username='aud_api',
            password='StrongPassword!2026',
            user_type='STAFF',
            actor_id='ACT-AUD-API',
            role='Auditor / Read-only reviewer',
            owner_code='OWN-API-A',
            allowed_owners=['OWN-API-A'],
        )
        tenant_user = UserAccount.objects.create_user(
            username='ten_api',
            password='StrongPassword!2026',
            user_type='TENANT',
            actor_id='ACT-TEN-API',
            role='Tenant',
            owner_code='OWN-API-A',
            allowed_owners=['OWN-API-A'],
            tenant_id_ref=uuid.uuid4(),
        )

        client = APIClient()

        # 1. Unauthenticated blocked
        assert client.get('/api/v1/ledger/accounts/').status_code == 401
        assert client.get('/prod/').status_code == 302

        # 2. Auditor blocked on writes
        client.force_authenticate(user=auditor_user)
        assert client.post('/api/v1/ledger/post/', {}, format='json').status_code == 403

        # 3. Tenant blocked from staff API and /prod/
        client.force_authenticate(user=tenant_user)
        assert client.get('/api/v1/ledger/accounts/').status_code == 403
        client.force_login(tenant_user)
        assert client.get('/prod/').status_code == 403

        # 4. Staff /prod/ UI works cleanly
        client.force_login(fin_user)
        prod_res = client.get('/prod/')
        assert prod_res.status_code == 200
        assert b'AUTHORITATIVE PRODUCTION STACK' in prod_res.content

        # 5. Manual journal posting requires server-verified ApprovalRequest & prevents self-approval
        client.force_authenticate(user=fin_user)
        payload = {
            'period_code': '2019-03',
            'entry_date': '2026-11-25',
            'rule_id': 'Manual',
            'idempotency_key': 'API-MJ-001',
            'lines': [
                {'account_code': '5600', 'debit_etb': '500.00'},
                {'account_code': '1020', 'credit_etb': '500.00'},
            ],
        }
        # Without approval_request_id -> 403
        assert client.post('/api/v1/ledger/post/', payload, format='json').status_code == 403

        # Create ApprovalRequest as Finance Officer
        apr_res = client.post(
            '/api/v1/governance/approvals/',
            {
                'request_number': 'REQ-API-MJ-1',
                'category': 'Finance',
                'title': 'Approve Bank Charge 500',
                'target_record_type': 'JournalEntry',
                'target_record_id': 'API-MJ-001',
                'payload_json': payload,
            },
            format='json',
        )
        assert apr_res.status_code == 201
        apr_id = apr_res.data['id']

        # Maker self-approval blocked -> 403
        self_decide = client.post(
            f'/api/v1/governance/approvals/{apr_id}/decide/',
            {'decision': 'Approved', 'comment': 'Attempt self approval'},
            format='json',
        )
        assert self_decide.status_code == 403

        # Independent checker (GM) approves -> 200
        client.force_authenticate(user=gm_user)
        gm_decide = client.post(
            f'/api/v1/governance/approvals/{apr_id}/decide/',
            {'decision': 'Approved', 'comment': 'Verified bank advice'},
            format='json',
        )
        assert gm_decide.status_code == 200

        # Maker cannot execute own approved request directly if still acting as maker -> 403
        client.force_authenticate(user=fin_user)
        assert client.post('/api/v1/ledger/post/', {**payload, 'approval_request_id': apr_id}, format='json').status_code == 403

        # Tampered amount fails payload_hash verification -> 403
        client.force_authenticate(user=gm_user)
        tampered = {
            **payload,
            'lines': [
                {'account_code': '5600', 'debit_etb': '9999.00'},
                {'account_code': '1020', 'credit_etb': '9999.00'},
            ],
            'approval_request_id': apr_id,
        }
        assert client.post('/api/v1/ledger/post/', tampered, format='json').status_code == 403

        # Valid approved execution succeeds -> 201
        ok_post = client.post('/api/v1/ledger/post/', {**payload, 'approval_request_id': apr_id}, format='json')
        assert ok_post.status_code == 201
        assert JournalEntry.objects.filter(id=ok_post.data['id'], approval_request_id=apr_id).exists()

        # 6. Gateway webhooks fail closed when disabled (503) or unsigned (403)
        assert client.post('/api/v1/gateways/webhooks/arifpay/', {}, format='json').status_code == 503
        assert client.post('/api/v1/gateways/arifpay/webhook/', {}, format='json').status_code == 503
        with override_settings(ENABLE_LIVE_GATEWAYS=True, ARIFPAY_WEBHOOK_SECRET='whsec_test'):
            assert client.post('/api/v1/gateways/webhooks/arifpay/', {'nonce': 'X'}, format='json').status_code == 403
            assert client.post('/api/v1/gateways/arifpay/webhook/', {'nonce': 'X'}, format='json').status_code == 403

        # 7. Backup manifest secret leakage rejection & full DB/Audit chain reconciliation
        bad_manifest = {'backup_id': 'B1', 'backup_encryption_passphrase': 'LEAK'}
        assert len(validate_manifest_dict(bad_manifest)) >= 2

        manifest_file = tmp_path / 'manifest.json'
        manifest_file.write_text(
            json.dumps({
                'backup_id': 'ADPRMS-TEST-BKP',
                'timestamp': '20261118T120000Z',
                'app_version': 'test-sha',
                'encryption_key_id': 'kms-key-ref-01',
                'database_dump_sha256': 'a' * 64,
                'documents_archive_sha256': 'b' * 64,
            }),
            encoding='utf-8',
        )
        docs_root = Path(tmp_path / 'docs')
        docs_root.mkdir()
        recon = run_reconciliation(manifest_path=manifest_file, docs_dir=docs_root)
        assert recon['passed'] is True
        events = list(AuditEvent.objects.filter(owner=owner).order_by('created_at', 'id'))
        chain_ok, count, _ = verify_audit_chain(events)
        assert chain_ok is True and count >= 1
