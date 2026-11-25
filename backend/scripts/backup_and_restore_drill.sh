#!/usr/bin/env bash
set -euo pipefail

# AD-PRMS Daily Encrypted Backup & Isolated Restore Verification Drill (#13 / D-010)
# Usage:
#   DATABASE_URL=postgres://adprms_admin:pass@localhost:5432/adprms \
#   BACKUP_ENCRYPTION_PASSPHRASE=strong-secret \
#   BACKUP_ENCRYPTION_KEY_ID=kms-key-ref-01 \
#   DOCUMENTS_DIR=/var/adprms/evidence \
#   ./backend/scripts/backup_and_restore_drill.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
DOCUMENTS_DIR="${DOCUMENTS_DIR:-}"
APP_VERSION="${APP_VERSION:-$(git rev-parse --short HEAD 2>/dev/null || echo 'dev')}"
KEY_ID="${BACKUP_ENCRYPTION_KEY_ID:-ENV-PASSPHRASE-KEY-01}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_ID="ADPRMS-BKP-${TIMESTAMP}"

RAW_DUMP="${BACKUP_DIR}/adprms-${TIMESTAMP}.dump"
ENC_DUMP="${RAW_DUMP}.enc"
RAW_DOCS_TAR="${BACKUP_DIR}/adprms-docs-${TIMESTAMP}.tar.gz"
ENC_DOCS_TAR="${RAW_DOCS_TAR}.enc"
MANIFEST_FILE="${BACKUP_DIR}/adprms-${TIMESTAMP}.manifest.json"
SHA_FILE="${BACKUP_DIR}/adprms-${TIMESTAMP}.sha256"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL is required." >&2
  exit 2
fi
if [ -z "${BACKUP_ENCRYPTION_PASSPHRASE:-}" ]; then
  echo "ERROR: BACKUP_ENCRYPTION_PASSPHRASE is required." >&2
  exit 2
fi

mkdir -p "${BACKUP_DIR}"
DOCS_STAGE=""
VERIFY_TMP=""
VERIFY_DOCS_TAR=""
VERIFY_DOCS_DIR=""

cleanup() {
  rm -f "${RAW_DUMP}" "${RAW_DOCS_TAR}" "${VERIFY_TMP:-}" "${VERIFY_DOCS_TAR:-}"
  if [ -n "${DOCS_STAGE:-}" ] && [ -d "${DOCS_STAGE}" ]; then rm -rf "${DOCS_STAGE}"; fi
  if [ -n "${VERIFY_DOCS_DIR:-}" ] && [ -d "${VERIFY_DOCS_DIR}" ]; then rm -rf "${VERIFY_DOCS_DIR}"; fi
}
trap cleanup EXIT

echo "[1/6] Dumping PostgreSQL database in custom format..."
pg_dump --format=custom --no-owner --no-privileges --file="${RAW_DUMP}" "${DATABASE_URL}"

echo "[2/6] Archiving document/object-storage snapshot..."
if [ -n "${DOCUMENTS_DIR}" ] && [ -d "${DOCUMENTS_DIR}" ]; then
  tar -czf "${RAW_DOCS_TAR}" -C "${DOCUMENTS_DIR}" .
else
  DOCS_STAGE="$(mktemp -d)"
  printf '{"snapshot":"empty-object-vault","timestamp":"%s"}\n' "${TIMESTAMP}" > "${DOCS_STAGE}/.vault-marker.json"
  tar -czf "${RAW_DOCS_TAR}" -C "${DOCS_STAGE}" .
fi

echo "[3/6] Encrypting DB and document snapshots with AES-256-CBC + PBKDF2 (key id: ${KEY_ID})..."
openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt \
  -in "${RAW_DUMP}" -out "${ENC_DUMP}" -pass env:BACKUP_ENCRYPTION_PASSPHRASE
openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt \
  -in "${RAW_DOCS_TAR}" -out "${ENC_DOCS_TAR}" -pass env:BACKUP_ENCRYPTION_PASSPHRASE
chmod 600 "${ENC_DUMP}" "${ENC_DOCS_TAR}"
rm -f "${RAW_DUMP}" "${RAW_DOCS_TAR}"

echo "[4/6] Writing SHA-256 checksums and secret-free backup manifest..."
DB_SHA="$(sha256sum "${ENC_DUMP}" | awk '{print $1}')"
DOCS_SHA="$(sha256sum "${ENC_DOCS_TAR}" | awk '{print $1}')"
sha256sum "${ENC_DUMP}" "${ENC_DOCS_TAR}" > "${SHA_FILE}"
sha256sum -c "${SHA_FILE}"

cat > "${MANIFEST_FILE}" <<EOF
{
  "backup_id": "${BACKUP_ID}",
  "timestamp": "${TIMESTAMP}",
  "app_version": "${APP_VERSION}",
  "encryption_key_id": "${KEY_ID}",
  "database_snapshot": "$(basename "${ENC_DUMP}")",
  "database_dump_sha256": "${DB_SHA}",
  "documents_snapshot": "$(basename "${ENC_DOCS_TAR}")",
  "documents_archive_sha256": "${DOCS_SHA}",
  "rpo_status": "DRAFT_PENDING_OWNER_APPROVAL",
  "rto_status": "DRAFT_PENDING_OWNER_APPROVAL"
}
EOF

if [ -n "${VERIFY_RESTORE_DATABASE_URL:-}" ]; then
  echo "[5/6] Decrypting snapshots into isolated target and running pg_restore..."
  VERIFY_TMP="$(mktemp)"
  VERIFY_DOCS_TAR="$(mktemp)"
  VERIFY_DOCS_DIR="$(mktemp -d)"

  openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 \
    -in "${ENC_DUMP}" -out "${VERIFY_TMP}" -pass env:BACKUP_ENCRYPTION_PASSPHRASE
  openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 \
    -in "${ENC_DOCS_TAR}" -out "${VERIFY_DOCS_TAR}" -pass env:BACKUP_ENCRYPTION_PASSPHRASE
  tar -xzf "${VERIFY_DOCS_TAR}" -C "${VERIFY_DOCS_DIR}"

  pg_restore --clean --if-exists --no-owner --no-privileges --dbname="${VERIFY_RESTORE_DATABASE_URL}" "${VERIFY_TMP}"

  echo "[6/6] Running post-restore business & cryptographic reconciliation..."
  DATABASE_URL="${VERIFY_RESTORE_DATABASE_URL}" python3 "${SCRIPT_DIR}/verify_restore_reconciliation.py" \
    --manifest "${MANIFEST_FILE}" \
    --docs-dir "${VERIFY_DOCS_DIR}"

  echo "RESTORE AND RECONCILIATION DRILL PASSED."
else
  echo "[5/6] Validating backup manifest structure (no live restore target configured)..."
  python3 "${SCRIPT_DIR}/verify_restore_reconciliation.py" --manifest "${MANIFEST_FILE}" --manifest-only
  echo "[6/6] Live DB restore skipped (set VERIFY_RESTORE_DATABASE_URL to execute isolated restore & reconciliation)."
fi

echo "Backup completed: ${MANIFEST_FILE}"
