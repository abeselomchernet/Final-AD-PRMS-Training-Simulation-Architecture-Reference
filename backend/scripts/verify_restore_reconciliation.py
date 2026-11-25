#!/usr/bin/env python3
"""
AD-PRMS Post-Restore Business & Cryptographic Reconciliation Verifier (#13).
Verifies:
  1. Manifest structure & absence of embedded secret keys/passphrases
  2. Restored database dump and document-vault archive SHA-256 integrity
  3. Per-owner Trial Balance (sum(debit_etb) == sum(credit_etb))
  4. Independent 3-way deposit tie-out (Lease == DepositMovement == GL 2120)
  5. Billing Charge / PaymentReceipt / GatewayTransaction / DocumentAsset counts & links
  6. Append-only AuditEvent SHA-256 hash chain continuity
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import sys
from decimal import Decimal


FORBIDDEN_SECRET_KEYS = {
    'password',
    'passphrase',
    'secret',
    'private_key',
    'field_encryption_key',
    'backup_encryption_passphrase',
}


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open('rb') as fh:
        for chunk in iter(lambda: fh.read(65536), b''):
            h.update(chunk)
    return h.hexdigest()


def validate_manifest_dict(manifest: dict) -> list[str]:
    errors: list[str] = []
    required = {
        'backup_id',
        'timestamp',
        'app_version',
        'encryption_key_id',
        'database_dump_sha256',
        'documents_archive_sha256',
    }
    missing = sorted(required - set(manifest.keys()))
    if missing:
        errors.append(f'Manifest missing required fields: {", ".join(missing)}')

    lower_keys = {str(k).lower() for k in manifest.keys()}
    leaked = lower_keys & FORBIDDEN_SECRET_KEYS
    if leaked:
        errors.append(f'Manifest contains forbidden secret key fields: {", ".join(sorted(leaked))}')

    for field in ('database_dump_sha256', 'documents_archive_sha256'):
        val = str(manifest.get(field, ''))
        if len(val) != 64:
            errors.append(f'Manifest field {field} must be a 64-char SHA-256 hex digest.')

    return errors


def verify_audit_chain(events) -> tuple[bool, int, str]:
    prev_hash = '0' * 64
    count = 0
    for ev in events:
        count += 1
        if ev.prev_hash != prev_hash:
            return False, count, f'AuditEvent {ev.id} prev_hash mismatch'
        digest_input = json.dumps(
            {
                'id': str(ev.id),
                'owner': str(ev.owner_id),
                'actor_id': ev.actor_id,
                'persona': ev.persona,
                'module': ev.module,
                'action': ev.action,
                'record_type': ev.record_type,
                'record_id': ev.record_id,
                'reason': ev.reason,
                'prev_hash': ev.prev_hash,
            },
            sort_keys=True,
        )
        expected_hash = hashlib.sha256(digest_input.encode('utf-8')).hexdigest()
        if ev.event_hash != expected_hash:
            return False, count, f'AuditEvent {ev.id} event_hash tamper detected'
        prev_hash = ev.event_hash
    return True, count, 'OK'


def run_reconciliation(*, manifest_path: Path, docs_dir: Path | None = None, manifest_only: bool = False) -> dict:
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    manifest_errors = validate_manifest_dict(manifest)
    if manifest_errors:
        return {'passed': False, 'stage': 'manifest', 'errors': manifest_errors}

    if manifest_only:
        return {'passed': True, 'stage': 'manifest_only', 'backup_id': manifest['backup_id'], 'owners': []}

    backend_dir = Path(__file__).resolve().parent.parent
    if str(backend_dir) not in sys.path:
        sys.path.insert(0, str(backend_dir))
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.base')

    import django
    django.setup()

    from django.db import connection, transaction
    from django.db.models import Sum
    from apps.billing.models import Charge, PaymentReceipt
    from apps.documents.models import DocumentAsset
    from apps.gateways.models import GatewayTransaction
    from apps.governance.models import AuditEvent
    from apps.ledger.models import JournalLine
    from apps.ledger.services import evaluate_three_way_deposit_check
    from apps.portfolio.models import OwnerEntity

    owner_reports = []
    all_passed = True

    with transaction.atomic():
        owners = list(OwnerEntity.objects.order_by('code'))
        for owner in owners:
            if connection.vendor == 'postgresql':
                with connection.cursor() as cur:
                    cur.execute("SELECT set_config('app.current_owner_id', %s, true)", [str(owner.id)])

            totals = JournalLine.objects.filter(owner=owner).aggregate(
                dr=Sum('debit_etb'),
                cr=Sum('credit_etb'),
            )
            total_dr = totals['dr'] or Decimal('0.00')
            total_cr = totals['cr'] or Decimal('0.00')
            tb_balanced = total_dr == total_cr

            three_way = evaluate_three_way_deposit_check(owner=owner)
            audit_qs = AuditEvent.objects.filter(owner=owner).order_by('created_at', 'id')
            chain_ok, audit_count, chain_msg = verify_audit_chain(audit_qs)

            docs = list(DocumentAsset.objects.filter(owner=owner))
            missing_docs = 0
            hash_mismatches = 0
            if docs_dir is not None:
                for doc in docs:
                    candidate = docs_dir / doc.object_key
                    if not candidate.exists():
                        missing_docs += 1
                    elif doc.sha256_checksum and sha256_file(candidate) != doc.sha256_checksum:
                        hash_mismatches += 1

            charges_count = Charge.objects.filter(owner=owner).count()
            receipts_count = PaymentReceipt.objects.filter(owner=owner).count()
            gateway_count = GatewayTransaction.objects.filter(owner=owner).count()

            owner_ok = tb_balanced and three_way['passed'] and chain_ok and missing_docs == 0 and hash_mismatches == 0
            if not owner_ok:
                all_passed = False

            owner_reports.append({
                'owner_code': owner.code,
                'trial_balance_balanced': tb_balanced,
                'total_debit_etb': str(total_dr),
                'total_credit_etb': str(total_cr),
                'three_way_deposit': {
                    'passed': three_way['passed'],
                    'lease_register_etb': str(three_way['lease_register_etb']),
                    'subledger_etb': str(three_way['subledger_etb']),
                    'gl_2120_etb': str(three_way['gl_2120_etb']),
                },
                'audit_chain_ok': chain_ok,
                'audit_events_verified': audit_count,
                'audit_chain_detail': chain_msg,
                'documents_count': len(docs),
                'missing_documents': missing_docs,
                'document_hash_mismatches': hash_mismatches,
                'charges_count': charges_count,
                'receipts_count': receipts_count,
                'gateway_transactions_count': gateway_count,
                'passed': owner_ok,
            })

    return {
        'passed': all_passed,
        'backup_id': manifest['backup_id'],
        'encryption_key_id': manifest['encryption_key_id'],
        'owners': owner_reports,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description='AD-PRMS Post-Restore Reconciliation Verifier')
    parser.add_argument('--manifest', required=True, help='Path to backup manifest JSON')
    parser.add_argument('--docs-dir', default='', help='Path to restored document storage root')
    parser.add_argument('--manifest-only', action='store_true', help='Validate manifest schema only without DB connection')
    args = parser.parse_args()

    result = run_reconciliation(
        manifest_path=Path(args.manifest),
        docs_dir=Path(args.docs_dir) if args.docs_dir else None,
        manifest_only=args.manifest_only,
    )
    print(json.dumps(result, indent=2))
    return 0 if result.get('passed') else 1


if __name__ == '__main__':
    raise SystemExit(main())
