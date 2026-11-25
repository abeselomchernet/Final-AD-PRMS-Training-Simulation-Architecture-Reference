import crypto from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type webPushType from 'web-push';
import { initMcpSchema } from './mcpGovernanceStore.ts';

const require = createRequire(import.meta.url);
const webpush = require('web-push') as typeof webPushType;

export interface StoredWorkspaceState {
  initialized: boolean;
  revision: number;
  state: Record<string, unknown> | null;
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface UploadedFileMetadata {
  fileId: string;
  ownerId: string;
  entityType: string;
  entityRefId: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  diskName: string;
  createdAt: string;
}

export interface ArifPayServerSession {
  sessionId: string;
  nonce: string;
  ownerId: string;
  tenantId: string;
  chargeId: string;
  amountEtb: number;
  paymentMethods: string[];
  checkoutUrl: string;
  status: 'PENDING' | 'COMPLETED' | 'EXPIRED' | 'FAILED';
  transactionId: string;
  createdAt: string;
  expiresAt: string;
}

export interface SyncEventPayload {
  eventId: string;
  type:
    | 'payment:settled'
    | 'sandbox:webhook:received'
    | 'maintenance:message'
    | 'maintenance:ticket'
    | 'approval:decided'
    | 'sms:dispatched'
    | 'notice:published'
    | 'state:synced'
    | 'state:reset';
  ownerId: string;
  originClientId?: string;
  timestamp: string;
  data: Record<string, unknown>;
}

export interface PushSubscriptionRecord {
  endpoint: string;
  p256dh: string;
  auth: string;
  deviceLabel: string;
  ownerId: string;
  actorId: string;
  createdAt: string;
}

const TENANT_PHONE_MAP: Record<
  string,
  { username: string; tenantId: string; displayName: string; ownerId: string }
> = {
  '+251910000001': {
    username: 'tenant.a101.demo',
    tenantId: 'TNT-A01',
    displayName: 'Synth Tenant A-101 (Demo)',
    ownerId: 'OWN-ALPHA',
  },
  '+251910000002': {
    username: 'tenant.a102.demo',
    tenantId: 'TNT-A02',
    displayName: 'Synth Tenant A-102 (Demo)',
    ownerId: 'OWN-ALPHA',
  },
  '+251910000003': {
    username: 'tenant.b101.demo',
    tenantId: 'TNT-B01',
    displayName: 'Synth Tenant B-101 (Demo)',
    ownerId: 'OWN-BETA',
  },
};

function normalizeEthiopianMsisdn(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('251') && digits.length === 12) return `+${digits}`;
  if ((digits.startsWith('09') || digits.startsWith('07')) && digits.length === 10) {
    return `+251${digits.slice(1)}`;
  }
  if ((digits.startsWith('9') || digits.startsWith('7')) && digits.length === 9) {
    return `+251${digits}`;
  }
  return raw.trim();
}

function validateFileMagicBytes(mimeType: string, buf: Buffer): boolean {
  if (buf.length < 4) return false;
  if (mimeType === 'application/pdf') {
    return buf.subarray(0, 5).toString('ascii') === '%PDF-';
  }
  if (mimeType === 'image/jpeg') {
    return buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
  }
  if (mimeType === 'image/png') {
    return (
      buf[0] === 0x89 &&
      buf[1] === 0x50 &&
      buf[2] === 0x4e &&
      buf[3] === 0x47
    );
  }
  if (mimeType === 'image/webp') {
    return (
      buf.length >= 12 &&
      buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buf.subarray(8, 12).toString('ascii') === 'WEBP'
    );
  }
  return false;
}

function extForMime(mimeType: string): string {
  if (mimeType === 'application/pdf') return '.pdf';
  if (mimeType === 'image/png') return '.png';
  if (mimeType === 'image/webp') return '.webp';
  return '.jpg';
}

export class OfficeSqliteStore {
  private readonly db: DatabaseSync;
  private readonly uploadsDir: string;
  private readonly vapidPublicKey: string;
  private readonly vapidPrivateKey: string;
  private readonly vapidSubject: string;

  constructor(dataDir: string, dbPathOverride?: string) {
    const resolvedDataDir = path.resolve(dataDir);
    const dbPath = dbPathOverride ? path.resolve(dbPathOverride) : path.join(resolvedDataDir, 'adprms-office.db');
    this.uploadsDir = path.join(path.dirname(dbPath), 'uploads');

    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    fs.mkdirSync(this.uploadsDir, { recursive: true });

    this.db = new DatabaseSync(dbPath);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;

      CREATE TABLE IF NOT EXISTS workspace_state (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        revision INTEGER NOT NULL,
        state_json TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        updated_by TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS uploaded_files (
        file_id TEXT PRIMARY KEY,
        owner_id TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_ref_id TEXT NOT NULL,
        filename TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        size_bytes INTEGER NOT NULL,
        sha256 TEXT NOT NULL,
        disk_name TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS server_config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS push_subscriptions (
        endpoint TEXT PRIMARY KEY,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        device_label TEXT NOT NULL,
        owner_id TEXT NOT NULL,
        actor_id TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS gateway_sessions (
        session_id TEXT PRIMARY KEY,
        nonce TEXT UNIQUE NOT NULL,
        provider TEXT NOT NULL,
        owner_id TEXT NOT NULL,
        tenant_id TEXT NOT NULL,
        charge_id TEXT NOT NULL,
        amount_etb REAL NOT NULL,
        status TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sms_sandbox_outbox (
        id TEXT PRIMARY KEY,
        owner_id TEXT NOT NULL,
        msisdn TEXT NOT NULL,
        trigger_type TEXT NOT NULL,
        locale TEXT NOT NULL,
        body TEXT NOT NULL,
        otp_code TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS tenant_otp_challenges (
        msisdn TEXT PRIMARY KEY,
        code TEXT NOT NULL,
        expires_at_ms INTEGER NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        max_attempts INTEGER NOT NULL DEFAULT 5,
        last_requested_at_ms INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sync_events (
        seq INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id TEXT UNIQUE NOT NULL,
        type TEXT NOT NULL,
        owner_id TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        timestamp TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS ledgers (
        id TEXT PRIMARY KEY,
        owner_id TEXT UNIQUE NOT NULL,
        ledger_code TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        vat_registered INTEGER NOT NULL DEFAULT 0,
        basis TEXT NOT NULL DEFAULT 'Accrual',
        framework TEXT NOT NULL DEFAULT 'IFRS for SMEs',
        currency TEXT NOT NULL DEFAULT 'ETB',
        enable_live_tax_invoicing INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS ledger_accounts (
        id TEXT PRIMARY KEY,
        owner_id TEXT NOT NULL,
        code TEXT NOT NULL,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        normal_balance TEXT NOT NULL,
        is_tax_locked INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'Active',
        version INTEGER NOT NULL DEFAULT 1,
        UNIQUE(owner_id, code, version)
      );

      CREATE TABLE IF NOT EXISTS accounting_periods (
        id TEXT PRIMARY KEY,
        owner_id TEXT NOT NULL,
        fiscal_year_ec INTEGER NOT NULL,
        month_index INTEGER NOT NULL,
        period_code TEXT NOT NULL,
        month_name_en TEXT NOT NULL,
        start_date_gc TEXT NOT NULL,
        end_date_gc TEXT NOT NULL,
        status TEXT NOT NULL,
        last_trial_balance_cents INTEGER DEFAULT 0,
        closed_at TEXT,
        closed_by TEXT,
        UNIQUE(owner_id, period_code)
      );

      CREATE TABLE IF NOT EXISTS posting_rule_versions (
        rule_id TEXT NOT NULL,
        version INTEGER NOT NULL,
        title TEXT NOT NULL,
        conditions TEXT NOT NULL,
        effective_date TEXT NOT NULL,
        PRIMARY KEY(rule_id, version)
      );

      CREATE TABLE IF NOT EXISTS journal_entries (
        id TEXT PRIMARY KEY,
        owner_id TEXT NOT NULL,
        journal_number TEXT NOT NULL,
        entry_date TEXT NOT NULL,
        period_code TEXT NOT NULL,
        rule_id TEXT NOT NULL,
        source_type TEXT NOT NULL,
        source_id TEXT NOT NULL,
        idempotency_key TEXT NOT NULL,
        description TEXT NOT NULL,
        status TEXT NOT NULL,
        maker_actor_id TEXT NOT NULL,
        checker_actor_id TEXT,
        reversal_of_journal_id TEXT,
        reversed_by_journal_id TEXT,
        created_at TEXT NOT NULL,
        UNIQUE(owner_id, idempotency_key)
      );

      CREATE TABLE IF NOT EXISTS journal_lines (
        id TEXT PRIMARY KEY,
        journal_id TEXT NOT NULL REFERENCES journal_entries(id),
        owner_id TEXT NOT NULL,
        line_number INTEGER NOT NULL,
        account_code TEXT NOT NULL,
        account_name TEXT NOT NULL,
        debit_cents INTEGER NOT NULL DEFAULT 0,
        credit_cents INTEGER NOT NULL DEFAULT 0,
        tenant_id TEXT,
        unit_id TEXT,
        tax_code TEXT,
        CHECK (debit_cents >= 0 AND credit_cents >= 0 AND NOT (debit_cents > 0 AND credit_cents > 0))
      );

      CREATE TABLE IF NOT EXISTS gateway_settlement_batches (
        id TEXT PRIMARY KEY,
        owner_id TEXT NOT NULL,
        provider TEXT NOT NULL,
        batch_number TEXT NOT NULL,
        period_code TEXT NOT NULL,
        gross_cents INTEGER NOT NULL,
        fee_cents INTEGER NOT NULL,
        net_settled_cents INTEGER NOT NULL,
        status TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS reconciliation_runs (
        id TEXT PRIMARY KEY,
        owner_id TEXT NOT NULL,
        period_code TEXT NOT NULL,
        bank_account_code TEXT NOT NULL,
        statement_closing_cents INTEGER NOT NULL,
        ledger_closing_cents INTEGER NOT NULL,
        clearing_balance_cents INTEGER NOT NULL,
        three_way_bank_cents INTEGER NOT NULL,
        three_way_ledger_cents INTEGER NOT NULL,
        three_way_subledger_cents INTEGER NOT NULL,
        status TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS close_checklists (
        id TEXT PRIMARY KEY,
        owner_id TEXT NOT NULL,
        period_code TEXT NOT NULL,
        status TEXT NOT NULL,
        passed_count INTEGER NOT NULL,
        total_count INTEGER NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS fixed_assets (
        id TEXT PRIMARY KEY,
        owner_id TEXT NOT NULL,
        asset_code TEXT NOT NULL,
        name TEXT NOT NULL,
        asset_class TEXT NOT NULL,
        cost_cents INTEGER NOT NULL,
        accum_dep_cents INTEGER NOT NULL,
        useful_life_months INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS tax_workpapers (
        id TEXT PRIMARY KEY,
        owner_id TEXT NOT NULL,
        period_code TEXT NOT NULL,
        tax_books_cents INTEGER NOT NULL,
        tax_flat20_cents INTEGER NOT NULL,
        tax_flat35_cents INTEGER NOT NULL,
        wht_payable_cents INTEGER NOT NULL,
        property_tax_estimate_cents INTEGER NOT NULL,
        workpaper_status TEXT NOT NULL,
        generated_at TEXT NOT NULL
      );

      -- Append-only ledger immutability triggers in SQLite
      CREATE TRIGGER IF NOT EXISTS trg_journal_lines_no_update
      BEFORE UPDATE ON journal_lines
      BEGIN
        SELECT RAISE(ABORT, 'Append-only violation: journal_lines rows cannot be updated.');
      END;

      CREATE TRIGGER IF NOT EXISTS trg_journal_lines_no_delete
      BEFORE DELETE ON journal_lines
      BEGIN
        SELECT RAISE(ABORT, 'Append-only violation: journal_lines rows cannot be deleted.');
      END;

      CREATE TRIGGER IF NOT EXISTS trg_journal_entries_no_delete
      BEFORE DELETE ON journal_entries
      BEGIN
        SELECT RAISE(ABORT, 'Append-only violation: posted journal_entries cannot be deleted.');
      END;

      CREATE TRIGGER IF NOT EXISTS trg_journal_entries_protect_core
      BEFORE UPDATE ON journal_entries
      WHEN (
        OLD.entry_date != NEW.entry_date
        OR OLD.period_code != NEW.period_code
        OR OLD.source_id != NEW.source_id
        OR OLD.description != NEW.description
        OR OLD.maker_actor_id != NEW.maker_actor_id
      )
      BEGIN
        SELECT RAISE(ABORT, 'Append-only violation: core fields of posted journal_entries are immutable; post a PR-25 mirror reversal.');
      END;
    `);

    // Safe forward schema migration for existing SQLite files
    try {
      this.db.exec('ALTER TABLE tenant_otp_challenges ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0;');
    } catch {
      // Column already exists
    }
    try {
      this.db.exec('ALTER TABLE tenant_otp_challenges ADD COLUMN max_attempts INTEGER NOT NULL DEFAULT 5;');
    } catch {
      // Column already exists
    }
    try {
      this.db.exec('ALTER TABLE tenant_otp_challenges ADD COLUMN last_requested_at_ms INTEGER NOT NULL DEFAULT 0;');
    } catch {
      // Column already exists
    }

    initMcpSchema(this.db);

    const vapid = this.ensureLocalVapidKeys();
    this.vapidPublicKey = vapid.publicKey;
    this.vapidPrivateKey = vapid.privateKey;
    this.vapidSubject = vapid.subject;
    webpush.setVapidDetails(this.vapidSubject, this.vapidPublicKey, this.vapidPrivateKey);
  }

  getDatabase(): DatabaseSync {
    return this.db;
  }

  ensureSyntheticSeedInitialized(
    seedFactory: () => Record<string, unknown>,
    isProduction = process.env.NODE_ENV === 'production'
  ): boolean {
    if (isProduction) return false;
    const existing = this.db
      .prepare('SELECT revision FROM workspace_state WHERE id = 1')
      .get() as { revision: number } | undefined;
    if (existing) return false;
    const seedState = seedFactory();
    this.saveWorkspaceState(seedState, 'system-cold-boot-seed', true);
    return true;
  }

  private ensureLocalVapidKeys(): { publicKey: string; privateKey: string; subject: string } {
    const existing = this.db
      .prepare('SELECT value FROM server_config WHERE key = ?')
      .get('vapid_keys') as { value: string } | undefined;

    if (existing?.value) {
      try {
        const parsed = JSON.parse(existing.value) as {
          publicKey?: string;
          privateKey?: string;
          subject?: string;
        };
        if (parsed.publicKey && parsed.privateKey) {
          return {
            publicKey: parsed.publicKey,
            privateKey: parsed.privateKey,
            subject: parsed.subject || 'mailto:office-test@adprms.local',
          };
        }
      } catch {
        // Regenerate cleanly if malformed
      }
    }

    const keys = webpush.generateVAPIDKeys();
    const record = {
      publicKey: keys.publicKey,
      privateKey: keys.privateKey,
      subject: 'mailto:office-test@adprms.local',
    };
    this.db
      .prepare(
        `INSERT INTO server_config (key, value, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
      )
      .run('vapid_keys', JSON.stringify(record), new Date().toISOString());
    return record;
  }

  getVapidPublicKey(): string {
    return this.vapidPublicKey;
  }

  getWorkspaceState(): StoredWorkspaceState {
    const row = this.db
      .prepare('SELECT revision, state_json, updated_at, updated_by FROM workspace_state WHERE id = 1')
      .get() as
      | { revision: number; state_json: string; updated_at: string; updated_by: string }
      | undefined;

    if (!row) {
      return {
        initialized: false,
        revision: 0,
        state: null,
        updatedAt: null,
        updatedBy: null,
      };
    }

    try {
      return {
        initialized: true,
        revision: row.revision,
        state: JSON.parse(row.state_json) as Record<string, unknown>,
        updatedAt: row.updated_at,
        updatedBy: row.updated_by,
      };
    } catch {
      return {
        initialized: false,
        revision: 0,
        state: null,
        updatedAt: null,
        updatedBy: null,
      };
    }
  }

  saveWorkspaceState(
    state: Record<string, unknown>,
    updatedBy = 'office-client',
    onlyIfUninitialized = false,
    expectedRevision?: number
  ): { revision: number; updatedAt: string; reusedExisting: boolean; conflict?: boolean } {
    const existing = this.db
      .prepare('SELECT revision, updated_at FROM workspace_state WHERE id = 1')
      .get() as { revision: number; updated_at: string } | undefined;

    if (onlyIfUninitialized && existing) {
      return {
        revision: existing.revision,
        updatedAt: existing.updated_at,
        reusedExisting: true,
        conflict: false,
      };
    }

    if (
      typeof expectedRevision === 'number' &&
      Number.isFinite(expectedRevision) &&
      existing &&
      existing.revision !== expectedRevision
    ) {
      return {
        revision: existing.revision,
        updatedAt: existing.updated_at,
        reusedExisting: false,
        conflict: true,
      };
    }

    const nextRevision = (existing?.revision || 0) + 1;
    const updatedAt = new Date().toISOString();
    const serialized = JSON.stringify(state);

    this.db
      .prepare(
        `INSERT INTO workspace_state (id, revision, state_json, updated_at, updated_by)
         VALUES (1, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           revision = excluded.revision,
           state_json = excluded.state_json,
           updated_at = excluded.updated_at,
           updated_by = excluded.updated_by`
      )
      .run(nextRevision, serialized, updatedAt, updatedBy);

    this.syncNormalizedLedgerFromState(state, updatedAt);

    return { revision: nextRevision, updatedAt, reusedExisting: false, conflict: false };
  }

  resetWorkspaceState(state: Record<string, unknown>, resetBy: string): { revision: number; updatedAt: string } {
    const res = this.saveWorkspaceState(state, resetBy, false);
    this.db.exec('DELETE FROM sync_events;');
    return { revision: res.revision, updatedAt: res.updatedAt };
  }

  saveUploadedFile(input: {
    ownerId: string;
    entityType: string;
    entityRefId: string;
    filename: string;
    mimeType: string;
    buffer: Buffer;
  }): { ok: true; file: UploadedFileMetadata } | { ok: false; error: string } {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowedMimes.includes(input.mimeType)) {
      return { ok: false, error: 'Unsupported MIME type. Allowed: JPEG, PNG, WEBP, PDF.' };
    }
    if (input.buffer.length <= 0 || input.buffer.length > 10 * 1024 * 1024) {
      return { ok: false, error: 'File size must be between 1 byte and 10 MB.' };
    }
    if (!validateFileMagicBytes(input.mimeType, input.buffer)) {
      return { ok: false, error: 'File binary header does not match declared MIME type.' };
    }

    const sha256 = crypto.createHash('sha256').update(input.buffer).digest('hex');
    const fileId = `EVD-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const safeBase = path.basename(input.filename || 'evidence').replace(/[^a-zA-Z0-9._-]/g, '_');
    const diskName = `${fileId}${extForMime(input.mimeType)}`;
    const diskPath = path.join(this.uploadsDir, diskName);

    fs.writeFileSync(diskPath, input.buffer);

    const createdAt = new Date().toISOString();
    const meta: UploadedFileMetadata = {
      fileId,
      ownerId: input.ownerId || 'OWN-ALPHA',
      entityType: input.entityType || 'GENERAL',
      entityRefId: input.entityRefId || '',
      filename: safeBase,
      mimeType: input.mimeType,
      sizeBytes: input.buffer.length,
      sha256,
      diskName,
      createdAt,
    };

    this.db
      .prepare(
        `INSERT INTO uploaded_files (
          file_id, owner_id, entity_type, entity_ref_id, filename, mime_type, size_bytes, sha256, disk_name, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        meta.fileId,
        meta.ownerId,
        meta.entityType,
        meta.entityRefId,
        meta.filename,
        meta.mimeType,
        meta.sizeBytes,
        meta.sha256,
        meta.diskName,
        meta.createdAt
      );

    return { ok: true, file: meta };
  }

  getUploadedFile(fileId: string): { meta: UploadedFileMetadata; buffer: Buffer } | null {
    const row = this.db
      .prepare(
        `SELECT file_id, owner_id, entity_type, entity_ref_id, filename, mime_type, size_bytes, sha256, disk_name, created_at
         FROM uploaded_files WHERE file_id = ?`
      )
      .get(fileId) as
      | {
          file_id: string;
          owner_id: string;
          entity_type: string;
          entity_ref_id: string;
          filename: string;
          mime_type: string;
          size_bytes: number;
          sha256: string;
          disk_name: string;
          created_at: string;
        }
      | undefined;

    if (!row) return null;
    const diskPath = path.join(this.uploadsDir, row.disk_name);
    if (!fs.existsSync(diskPath)) return null;

    return {
      meta: {
        fileId: row.file_id,
        ownerId: row.owner_id,
        entityType: row.entity_type,
        entityRefId: row.entity_ref_id,
        filename: row.filename,
        mimeType: row.mime_type,
        sizeBytes: row.size_bytes,
        sha256: row.sha256,
        diskName: row.disk_name,
        createdAt: row.created_at,
      },
      buffer: fs.readFileSync(diskPath),
    };
  }

  listUploadedFiles(ownerId?: string): UploadedFileMetadata[] {
    const rows = (
      ownerId
        ? this.db
            .prepare(
              `SELECT file_id, owner_id, entity_type, entity_ref_id, filename, mime_type, size_bytes, sha256, disk_name, created_at
               FROM uploaded_files WHERE owner_id = ? ORDER BY created_at DESC LIMIT 100`
            )
            .all(ownerId)
        : this.db
            .prepare(
              `SELECT file_id, owner_id, entity_type, entity_ref_id, filename, mime_type, size_bytes, sha256, disk_name, created_at
               FROM uploaded_files ORDER BY created_at DESC LIMIT 100`
            )
            .all()
    ) as Array<{
      file_id: string;
      owner_id: string;
      entity_type: string;
      entity_ref_id: string;
      filename: string;
      mime_type: string;
      size_bytes: number;
      sha256: string;
      disk_name: string;
      created_at: string;
    }>;

    return rows.map((row) => ({
      fileId: row.file_id,
      ownerId: row.owner_id,
      entityType: row.entity_type,
      entityRefId: row.entity_ref_id,
      filename: row.filename,
      mimeType: row.mime_type,
      sizeBytes: row.size_bytes,
      sha256: row.sha256,
      diskName: row.disk_name,
      createdAt: row.created_at,
    }));
  }

  getUploadsCount(): number {
    const row = this.db.prepare('SELECT COUNT(*) AS cnt FROM uploaded_files').get() as { cnt: number };
    return Number(row?.cnt || 0);
  }

  savePushSubscription(input: {
    endpoint: string;
    p256dh: string;
    auth: string;
    deviceLabel: string;
    ownerId?: string;
    actorId?: string;
  }): PushSubscriptionRecord {
    const createdAt = new Date().toISOString();
    const record: PushSubscriptionRecord = {
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      deviceLabel: input.deviceLabel || 'AD-PRMS Device',
      ownerId: input.ownerId || 'ALL',
      actorId: input.actorId || 'ANONYMOUS',
      createdAt,
    };
    this.db
      .prepare(
        `INSERT INTO push_subscriptions (endpoint, p256dh, auth, device_label, owner_id, actor_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(endpoint) DO UPDATE SET
           p256dh = excluded.p256dh,
           auth = excluded.auth,
           device_label = excluded.device_label,
           owner_id = excluded.owner_id,
           actor_id = excluded.actor_id`
      )
      .run(
        record.endpoint,
        record.p256dh,
        record.auth,
        record.deviceLabel,
        record.ownerId,
        record.actorId,
        record.createdAt
      );
    return record;
  }

  removePushSubscription(endpoint: string): void {
    this.db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(endpoint);
  }

  getPushSubscribersCount(): number {
    const row = this.db.prepare('SELECT COUNT(*) AS cnt FROM push_subscriptions').get() as { cnt: number };
    return Number(row?.cnt || 0);
  }

  async sendPushNotifications(input: {
    title: string;
    body: string;
    url?: string;
    tag?: string;
    ownerId?: string;
  }): Promise<{ attempted: number; delivered: number; failed: number }> {
    const rows = (
      input.ownerId
        ? this.db
            .prepare(
              `SELECT endpoint, p256dh, auth, device_label FROM push_subscriptions
               WHERE owner_id = ? OR owner_id = 'ALL'`
            )
            .all(input.ownerId)
        : this.db.prepare('SELECT endpoint, p256dh, auth, device_label FROM push_subscriptions').all()
    ) as Array<{ endpoint: string; p256dh: string; auth: string; device_label: string }>;

    if (rows.length === 0) {
      return { attempted: 0, delivered: 0, failed: 0 };
    }

    const payload = JSON.stringify({
      title: input.title,
      body: input.body,
      url: input.url || '/',
      tag: input.tag || 'adprms-office-push',
    });

    let delivered = 0;
    let failed = 0;

    await Promise.all(
      rows.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            payload
          );
          delivered += 1;
        } catch (err: unknown) {
          failed += 1;
          const statusCode =
            typeof err === 'object' && err !== null && 'statusCode' in err
              ? Number((err as { statusCode?: number }).statusCode)
              : 0;
          if (statusCode === 404 || statusCode === 410) {
            this.removePushSubscription(sub.endpoint);
          }
        }
      })
    );

    return { attempted: rows.length, delivered, failed };
  }

  getArifPaySessionByNonce(nonce: string): ArifPayServerSession | null {
    const row = this.db
      .prepare('SELECT payload_json FROM gateway_sessions WHERE nonce = ?')
      .get(nonce) as { payload_json: string } | undefined;
    return row ? (JSON.parse(row.payload_json) as ArifPayServerSession) : null;
  }

  getArifPaySessionById(sessionId: string): ArifPayServerSession | null {
    const row = this.db
      .prepare('SELECT payload_json FROM gateway_sessions WHERE session_id = ?')
      .get(sessionId) as { payload_json: string } | undefined;
    return row ? (JSON.parse(row.payload_json) as ArifPayServerSession) : null;
  }

  upsertArifPaySession(session: ArifPayServerSession): void {
    this.db
      .prepare(
        `INSERT INTO gateway_sessions (
          session_id, nonce, provider, owner_id, tenant_id, charge_id, amount_etb, status, payload_json, created_at, expires_at
        ) VALUES (?, ?, 'ARIFPAY', ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(session_id) DO UPDATE SET
          status = excluded.status,
          payload_json = excluded.payload_json`
      )
      .run(
        session.sessionId,
        session.nonce,
        session.ownerId,
        session.tenantId,
        session.chargeId,
        session.amountEtb,
        session.status,
        JSON.stringify(session),
        session.createdAt,
        session.expiresAt
      );
  }

  logSmsOutbox(input: {
    ownerId: string;
    msisdn: string;
    triggerType: string;
    locale: string;
    body: string;
    otpCode?: string;
  }): { id: string; createdAt: string } {
    const id = `SMS-SQL-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`;
    const createdAt = new Date().toISOString();
    this.db
      .prepare(
        `INSERT INTO sms_sandbox_outbox (id, owner_id, msisdn, trigger_type, locale, body, otp_code, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        input.ownerId || 'OWN-ALPHA',
        input.msisdn || '+251900000000',
        input.triggerType || 'General Notice',
        input.locale || 'en',
        input.body || '',
        input.otpCode || null,
        createdAt
      );
    return { id, createdAt };
  }

  requestSimulatedTenantOtp(
    rawMsisdn: string,
    locale: 'en' | 'am' = 'en'
  ): {
    ok: boolean;
    msisdn: string;
    code?: string;
    matchedAccount?: { username: string; tenantId: string; displayName: string; ownerId: string };
    error?: string;
  } {
    const msisdn = normalizeEthiopianMsisdn(rawMsisdn);
    if (!/^\+251[79]\d{8}$/.test(msisdn)) {
      return {
        ok: false,
        msisdn,
        error:
          locale === 'am'
            ? 'ትክክለኛ የኢትዮጵያ ስልክ ቁጥር ያስገቡ (+2519XXXXXXXX ወይም 09XXXXXXXX)።'
            : 'Enter a valid Ethiopian phone number (+2519XXXXXXXX or 09XXXXXXXX).',
      };
    }

    const matchedAccount = TENANT_PHONE_MAP[msisdn];
    if (!matchedAccount) {
      return {
        ok: false,
        msisdn,
        error:
          locale === 'am'
            ? 'ይህ ስልክ ቁጥር ከተመዘገበ የተከራይ መለያ ጋር አልተገናኘም (+251910000001 / 002 / 003 ይጠቀሙ)።'
            : 'Phone number is not registered to a demo tenant account (+251910000001 / 002 / 003).',
      };
    }

    const nowMs = Date.now();
    const existing = this.db
      .prepare('SELECT last_requested_at_ms FROM tenant_otp_challenges WHERE msisdn = ?')
      .get(msisdn) as { last_requested_at_ms?: number } | undefined;
    if (existing?.last_requested_at_ms && nowMs - existing.last_requested_at_ms < 5000) {
      return {
        ok: false,
        msisdn,
        error:
          locale === 'am'
            ? 'እባክዎ ሌላ OTP ከመጠየቅዎ በፊት ጥቂት ሰከንዶች ይጠብቁ።'
            : 'Please wait a few seconds before requesting another OTP.',
      };
    }

    const code = String(crypto.randomInt(100000, 999999));
    const expiresAtMs = nowMs + 5 * 60 * 1000;
    const createdAt = new Date(nowMs).toISOString();

    this.db
      .prepare(
        `INSERT INTO tenant_otp_challenges (msisdn, code, expires_at_ms, attempts, max_attempts, last_requested_at_ms, created_at)
         VALUES (?, ?, ?, 0, 5, ?, ?)
         ON CONFLICT(msisdn) DO UPDATE SET
           code = excluded.code,
           expires_at_ms = excluded.expires_at_ms,
           attempts = 0,
           last_requested_at_ms = excluded.last_requested_at_ms,
           created_at = excluded.created_at`
      )
      .run(msisdn, code, expiresAtMs, nowMs, createdAt);

    const smsBody =
      locale === 'am'
        ? `[AD-PRMS ሙከራ OTP] የእርስዎ የተከራይ መግቢያ ኮድ ${code} ነው። ለ5 ደቂቃ ያገለግላል።`
        : `[AD-PRMS Office Test OTP] Your Tenant Portal verification code is ${code}. Valid for 5 minutes.`;

    this.logSmsOutbox({
      ownerId: matchedAccount.ownerId,
      msisdn,
      triggerType: 'Tenant OTP (Sandbox)',
      locale,
      body: smsBody,
      otpCode: code,
    });

    return { ok: true, msisdn, code, matchedAccount };
  }

  verifySimulatedTenantOtp(
    rawMsisdn: string,
    rawCode: string
  ): {
    ok: boolean;
    msisdn: string;
    account?: { username: string; tenantId: string; displayName: string; ownerId: string };
    error?: string;
  } {
    const msisdn = normalizeEthiopianMsisdn(rawMsisdn);
    const code = rawCode.trim();
    const account = TENANT_PHONE_MAP[msisdn];
    if (!account) {
      return { ok: false, msisdn, error: 'Phone number is not registered to a demo tenant account.' };
    }

    const row = this.db
      .prepare('SELECT code, expires_at_ms, attempts, max_attempts FROM tenant_otp_challenges WHERE msisdn = ?')
      .get(msisdn) as { code: string; expires_at_ms: number; attempts: number; max_attempts: number } | undefined;

    if (!row) {
      return { ok: false, msisdn, error: 'No active OTP challenge for this phone number. Tap "Send SMS OTP" first.' };
    }
    if (Date.now() > row.expires_at_ms) {
      this.db.prepare('DELETE FROM tenant_otp_challenges WHERE msisdn = ?').run(msisdn);
      return { ok: false, msisdn, error: 'Sandbox OTP expired. Request a new verification code.' };
    }
    if ((row.attempts || 0) >= (row.max_attempts || 5)) {
      this.db.prepare('DELETE FROM tenant_otp_challenges WHERE msisdn = ?').run(msisdn);
      return { ok: false, msisdn, error: 'OTP locked after too many failed attempts. Request a new code.' };
    }
    if (row.code !== code) {
      const nextAttempts = (row.attempts || 0) + 1;
      this.db.prepare('UPDATE tenant_otp_challenges SET attempts = ? WHERE msisdn = ?').run(nextAttempts, msisdn);
      if (nextAttempts >= (row.max_attempts || 5)) {
        this.db.prepare('DELETE FROM tenant_otp_challenges WHERE msisdn = ?').run(msisdn);
        return { ok: false, msisdn, error: 'OTP locked after too many failed attempts. Request a new code.' };
      }
      return { ok: false, msisdn, error: 'Incorrect 6-digit verification code.' };
    }

    this.db.prepare('DELETE FROM tenant_otp_challenges WHERE msisdn = ?').run(msisdn);
    return { ok: true, msisdn, account };
  }

  recordSyncEvent(event: SyncEventPayload): boolean {
    const existing = this.db
      .prepare('SELECT 1 FROM sync_events WHERE event_id = ?')
      .get(event.eventId);
    if (existing) return false;

    this.db
      .prepare(
        `INSERT INTO sync_events (event_id, type, owner_id, payload_json, timestamp)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(event.eventId, event.type, event.ownerId, JSON.stringify(event), event.timestamp);

    this.db.exec(
      'DELETE FROM sync_events WHERE seq NOT IN (SELECT seq FROM sync_events ORDER BY seq DESC LIMIT 100)'
    );
    return true;
  }

  getRecentSyncEvents(limit = 20): SyncEventPayload[] {
    const rows = this.db
      .prepare('SELECT payload_json FROM sync_events ORDER BY seq DESC LIMIT ?')
      .all(limit) as Array<{ payload_json: string }>;
    return rows
      .map((r) => {
        try {
          return JSON.parse(r.payload_json) as SyncEventPayload;
        } catch {
          return null;
        }
      })
      .filter((x): x is SyncEventPayload => x !== null);
  }

  private syncNormalizedLedgerFromState(state: Record<string, unknown>, updatedAt: string): void {
    try {
      const configs = (Array.isArray(state.ledgerConfigs) ? state.ledgerConfigs : []) as Array<Record<string, unknown>>;
      const upsertLedger = this.db.prepare(`
        INSERT INTO ledgers (id, owner_id, ledger_code, entity_type, vat_registered, basis, framework, currency, enable_live_tax_invoicing, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'ETB', 0, ?)
        ON CONFLICT(owner_id) DO UPDATE SET
          vat_registered = excluded.vat_registered,
          basis = excluded.basis,
          framework = excluded.framework,
          updated_at = excluded.updated_at
      `);
      for (const cfg of configs) {
        upsertLedger.run(
          String(cfg.id || `CFG-${cfg.ownerId}`),
          String(cfg.ownerId || 'OWN-ALPHA'),
          String(cfg.ledgerCode || 'LDG-OWN-ALPHA'),
          String(cfg.entityType || 'Individual'),
          cfg.vatRegistered ? 1 : 0,
          String(cfg.basis || 'Accrual'),
          String(cfg.framework || 'IFRS for SMEs'),
          updatedAt
        );
      }

      const accounts = (Array.isArray(state.ledgerAccountsV2) ? state.ledgerAccountsV2 : []) as Array<Record<string, unknown>>;
      const upsertAcct = this.db.prepare(`
        INSERT INTO ledger_accounts (id, owner_id, code, name, category, normal_balance, is_tax_locked, status, version)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(owner_id, code, version) DO UPDATE SET
          name = excluded.name,
          status = excluded.status
      `);
      for (const a of accounts) {
        upsertAcct.run(
          String(a.id),
          String(a.ownerId),
          String(a.code),
          String(a.name),
          String(a.category),
          String(a.normalBalance || 'Debit'),
          a.isTaxLocked ? 1 : 0,
          String(a.status || 'Active'),
          Number(a.version || 1)
        );
      }

      const periods = (Array.isArray(state.accountingPeriods) ? state.accountingPeriods : []) as Array<Record<string, unknown>>;
      const upsertPeriod = this.db.prepare(`
        INSERT INTO accounting_periods (id, owner_id, fiscal_year_ec, month_index, period_code, month_name_en, start_date_gc, end_date_gc, status, last_trial_balance_cents, closed_at, closed_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(owner_id, period_code) DO UPDATE SET
          status = excluded.status,
          last_trial_balance_cents = excluded.last_trial_balance_cents,
          closed_at = excluded.closed_at,
          closed_by = excluded.closed_by
      `);
      for (const p of periods) {
        upsertPeriod.run(
          String(p.id),
          String(p.ownerId),
          Number(p.fiscalYearEc || 2019),
          Number(p.monthIndex || 1),
          String(p.periodCode),
          String(p.monthNameEn || ''),
          String(p.startDateGc || ''),
          String(p.endDateGc || ''),
          String(p.status || 'Open'),
          Number(p.lastTrialBalanceCents || 0),
          p.closedAt ? String(p.closedAt) : null,
          p.closedBy ? String(p.closedBy) : null
        );
      }

      // Append-only sync for journal_entries and journal_lines
      const journals = (Array.isArray(state.ledgerJournals) ? state.ledgerJournals : []) as Array<Record<string, unknown>>;
      const insertEntry = this.db.prepare(`
        INSERT INTO journal_entries (
          id, owner_id, journal_number, entry_date, period_code, rule_id, source_type, source_id,
          idempotency_key, description, status, maker_actor_id, checker_actor_id, reversal_of_journal_id, reversed_by_journal_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          status = excluded.status,
          reversed_by_journal_id = excluded.reversed_by_journal_id,
          reversal_of_journal_id = excluded.reversal_of_journal_id
      `);
      const insertLine = this.db.prepare(`
        INSERT OR IGNORE INTO journal_lines (
          id, journal_id, owner_id, line_number, account_code, account_name, debit_cents, credit_cents, tenant_id, unit_id, tax_code
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const je of journals) {
        insertEntry.run(
          String(je.id),
          String(je.ownerId),
          String(je.journalNumber),
          String(je.entryDate),
          String(je.periodCode),
          String(je.ruleId || 'Manual'),
          String(je.sourceType || 'ManualJournal'),
          String(je.sourceId || ''),
          String(je.idempotencyKey || je.id),
          String(je.description || ''),
          String(je.status || 'Posted'),
          String(je.makerActorId || 'SYSTEM'),
          je.checkerActorId ? String(je.checkerActorId) : null,
          je.reversalOfJournalId ? String(je.reversalOfJournalId) : null,
          je.reversedByJournalId ? String(je.reversedByJournalId) : null,
          String(je.createdAt || updatedAt)
        );
        const lines = (Array.isArray(je.lines) ? je.lines : []) as Array<Record<string, unknown>>;
        for (const l of lines) {
          insertLine.run(
            String(l.id),
            String(je.id),
            String(je.ownerId),
            Number(l.lineNumber || 1),
            String(l.accountCode),
            String(l.accountName || ''),
            Math.max(0, Math.round(Number(l.debitCents || 0))),
            Math.max(0, Math.round(Number(l.creditCents || 0))),
            l.tenantId ? String(l.tenantId) : null,
            l.unitId ? String(l.unitId) : null,
            l.taxCode ? String(l.taxCode) : null
          );
        }
      }

      const workpapers = (Array.isArray(state.taxWorkpapers) ? state.taxWorkpapers : []) as Array<Record<string, unknown>>;
      const upsertWp = this.db.prepare(`
        INSERT INTO tax_workpapers (id, owner_id, period_code, tax_books_cents, tax_flat20_cents, tax_flat35_cents, wht_payable_cents, property_tax_estimate_cents, workpaper_status, generated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          tax_books_cents = excluded.tax_books_cents,
          tax_flat20_cents = excluded.tax_flat20_cents,
          tax_flat35_cents = excluded.tax_flat35_cents,
          wht_payable_cents = excluded.wht_payable_cents,
          property_tax_estimate_cents = excluded.property_tax_estimate_cents,
          generated_at = excluded.generated_at
      `);
      for (const wp of workpapers) {
        upsertWp.run(
          String(wp.id),
          String(wp.ownerId),
          String(wp.periodCode),
          Number(wp.taxBooksCents || 0),
          Number(wp.taxFlat20Cents || 0),
          Number(wp.taxFlat35Cents || 0),
          Number(wp.whtPayableCents || 0),
          Number(wp.propertyTaxEstimateCents || 0),
          String(wp.workpaperStatus || 'Workpaper Draft — Active Gate Locked'),
          String(wp.generatedAt || updatedAt)
        );
      }
    } catch (err) {
      console.error('SQLite normalized ledger sync skipped error:', err);
    }
  }

  getLedgerSummary(ownerId = 'OWN-ALPHA'): Record<string, unknown> {
    const ledger = this.db
      .prepare('SELECT * FROM ledgers WHERE owner_id = ?')
      .get(ownerId) as Record<string, unknown> | undefined;
    const journalStats = this.db
      .prepare('SELECT COUNT(*) AS cnt FROM journal_entries WHERE owner_id = ?')
      .get(ownerId) as { cnt: number };
    const lineTotals = this.db
      .prepare('SELECT COALESCE(SUM(debit_cents), 0) AS dr, COALESCE(SUM(credit_cents), 0) AS cr FROM journal_lines WHERE owner_id = ?')
      .get(ownerId) as { dr: number; cr: number };
    const periods = this.db
      .prepare('SELECT period_code, month_name_en, status, last_trial_balance_cents FROM accounting_periods WHERE owner_id = ? ORDER BY month_index ASC')
      .all(ownerId) as Array<Record<string, unknown>>;
    const workpaper = this.db
      .prepare('SELECT * FROM tax_workpapers WHERE owner_id = ? ORDER BY generated_at DESC LIMIT 1')
      .get(ownerId) as Record<string, unknown> | undefined;

    return {
      ok: true,
      ownerId,
      ledger: ledger || null,
      journalCount: Number(journalStats?.cnt || 0),
      journalTotalDebitCents: Number(lineTotals?.dr || 0),
      journalTotalCreditCents: Number(lineTotals?.cr || 0),
      balanced: Number(lineTotals?.dr || 0) === Number(lineTotals?.cr || 0),
      periods,
      latestWorkpaper: workpaper || null,
      enableLiveTaxInvoicing: false,
    };
  }

  listLedgerAccountsSql(ownerId = 'OWN-ALPHA'): Array<Record<string, unknown>> {
    return this.db
      .prepare(
        `SELECT id, owner_id, code, name, category, normal_balance, is_tax_locked, status, version
         FROM ledger_accounts WHERE owner_id = ? ORDER BY code ASC`
      )
      .all(ownerId) as Array<Record<string, unknown>>;
  }

  listLedgerJournalsSql(
    ownerId = 'OWN-ALPHA',
    opts?: { accountCodePrefix?: string; periodCode?: string; limit?: number }
  ): Array<Record<string, unknown>> {
    const limit = Math.max(1, Math.min(200, Number(opts?.limit || 50)));
    const conditions = ['je.owner_id = ?'];
    const args: Array<string | number> = [ownerId];

    if (opts?.periodCode) {
      conditions.push('je.period_code = ?');
      args.push(opts.periodCode);
    }
    if (opts?.accountCodePrefix) {
      conditions.push(
        'EXISTS (SELECT 1 FROM journal_lines jl WHERE jl.journal_id = je.id AND jl.account_code LIKE ?)'
      );
      args.push(`${opts.accountCodePrefix}%`);
    }
    args.push(limit);

    const entries = this.db
      .prepare(
        `SELECT je.* FROM journal_entries je
         WHERE ${conditions.join(' AND ')}
         ORDER BY je.entry_date DESC, je.created_at DESC
         LIMIT ?`
      )
      .all(...args) as Array<Record<string, unknown>>;

    const getLines = this.db.prepare(
      `SELECT id, line_number, account_code, account_name, debit_cents, credit_cents, tenant_id, unit_id, tax_code
       FROM journal_lines WHERE journal_id = ? ORDER BY line_number ASC`
    );

    return entries.map((e) => ({
      ...e,
      lines: getLines.all(String(e.id)),
    }));
  }

  getLedgerTrialBalanceSql(ownerId = 'OWN-ALPHA', periodCode?: string): Record<string, unknown> {
    const params: Array<string> = [ownerId];
    let periodJoinFilter = '';
    if (periodCode) {
      periodJoinFilter = 'AND je.period_code = ?';
      params.push(periodCode);
    }
    const rows = this.db
      .prepare(
        `SELECT
           jl.account_code AS accountCode,
           MAX(jl.account_name) AS accountName,
           COALESCE(SUM(jl.debit_cents), 0) AS totalDebitCents,
           COALESCE(SUM(jl.credit_cents), 0) AS totalCreditCents
         FROM journal_lines jl
         JOIN journal_entries je ON je.id = jl.journal_id
         WHERE jl.owner_id = ? ${periodJoinFilter}
         GROUP BY jl.account_code
         ORDER BY jl.account_code ASC`
      )
      .all(...params) as Array<{
      accountCode: string;
      accountName: string;
      totalDebitCents: number;
      totalCreditCents: number;
    }>;

    let totalDebitCents = 0;
    let totalCreditCents = 0;
    for (const r of rows) {
      totalDebitCents += Number(r.totalDebitCents || 0);
      totalCreditCents += Number(r.totalCreditCents || 0);
    }

    return {
      ok: true,
      ownerId,
      periodCode: periodCode || 'ALL',
      rows,
      totalDebitCents,
      totalCreditCents,
      balanced: totalDebitCents === totalCreditCents,
    };
  }

  postLedgerJournalSql(input: {
    ownerId: string;
    entryDate: string;
    periodCode: string;
    ruleId: string;
    sourceType: string;
    sourceId: string;
    idempotencyKey: string;
    description: string;
    makerActorId: string;
    checkerActorId?: string;
    lines: Array<{ accountCode: string; accountName?: string; debitCents: number; creditCents: number }>;
  }): {
    ok: boolean;
    reused?: boolean;
    journalId?: string;
    journalNumber?: string;
    debitCents?: number;
    creditCents?: number;
    error?: string;
  } {
    if (input.ruleId === 'PR-08') {
      return { ok: false, error: 'PR-08 failed gateway event creates 0 ledger journals.' };
    }

    const existing = this.db
      .prepare('SELECT id, journal_number FROM journal_entries WHERE owner_id = ? AND idempotency_key = ?')
      .get(input.ownerId, input.idempotencyKey) as { id: string; journal_number: string } | undefined;
    if (existing) {
      return { ok: true, reused: true, journalId: existing.id, journalNumber: existing.journal_number };
    }

    const period = this.db
      .prepare('SELECT status FROM accounting_periods WHERE owner_id = ? AND period_code = ?')
      .get(input.ownerId, input.periodCode) as { status: string } | undefined;
    if (period && (period.status === 'Closed' || period.status === 'Closing')) {
      return { ok: false, error: `Period ${input.periodCode} is ${period.status}; posting refused.` };
    }

    if (!Array.isArray(input.lines) || input.lines.length < 2) {
      return { ok: false, error: 'Double-entry journal requires at least 2 balanced lines.' };
    }

    const ownerAccountsCount = (
      this.db.prepare('SELECT COUNT(*) AS cnt FROM ledger_accounts WHERE owner_id = ?').get(input.ownerId) as {
        cnt: number;
      }
    ).cnt;

    let dr = 0;
    let cr = 0;
    const resolvedNames: string[] = [];

    for (let i = 0; i < input.lines.length; i++) {
      const l = input.lines[i];
      const lineDr = Math.round(Number(l.debitCents || 0));
      const lineCr = Math.round(Number(l.creditCents || 0));

      if (lineDr < 0 || lineCr < 0 || (lineDr > 0 && lineCr > 0) || (lineDr === 0 && lineCr === 0)) {
        return {
          ok: false,
          error: `Line ${i + 1} (${l.accountCode}) must carry strictly one positive debit or credit amount.`,
        };
      }
      if (l.accountCode === '2210' || l.accountCode === '1190') {
        return { ok: false, error: `Account ${l.accountCode} is Tax-Locked in SQLite ledger.` };
      }

      const acct = this.db
        .prepare('SELECT name, status, is_tax_locked FROM ledger_accounts WHERE owner_id = ? AND code = ? ORDER BY version DESC LIMIT 1')
        .get(input.ownerId, l.accountCode) as { name: string; status: string; is_tax_locked: number } | undefined;

      if (ownerAccountsCount > 0) {
        if (!acct) {
          return { ok: false, error: `Account ${l.accountCode} does not exist for owner ${input.ownerId}.` };
        }
        if (acct.status !== 'Active') {
          return { ok: false, error: `Account ${l.accountCode} is ${acct.status}, not Active.` };
        }
        if (acct.is_tax_locked) {
          return { ok: false, error: `Account ${l.accountCode} is Tax-Locked in SQLite ledger.` };
        }
      }

      resolvedNames.push(acct?.name || l.accountName || l.accountCode);
      dr += lineDr;
      cr += lineCr;
    }

    if (dr <= 0 || dr !== cr) {
      return { ok: false, error: `Unbalanced journal entry: Dr ${dr} != Cr ${cr}.` };
    }

    const journalId = `JE-SQL-${input.ownerId}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const countRow = this.db
      .prepare('SELECT COUNT(*) AS cnt FROM journal_entries WHERE owner_id = ?')
      .get(input.ownerId) as { cnt: number };
    const jNum = `J${String(Number(countRow?.cnt || 0) + 1).padStart(2, '0')}`;
    const now = new Date().toISOString();

    this.db.exec('BEGIN IMMEDIATE;');
    try {
      this.db
        .prepare(`
          INSERT INTO journal_entries (
            id, owner_id, journal_number, entry_date, period_code, rule_id, source_type, source_id,
            idempotency_key, description, status, maker_actor_id, checker_actor_id, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Posted', ?, ?, ?)
        `)
        .run(
          journalId,
          input.ownerId,
          jNum,
          input.entryDate,
          input.periodCode,
          input.ruleId || 'Manual',
          input.sourceType || 'ManualJournal',
          input.sourceId || journalId,
          input.idempotencyKey,
          input.description,
          input.makerActorId || 'SYSTEM',
          input.checkerActorId || null,
          now
        );

      const insertLine = this.db.prepare(`
        INSERT INTO journal_lines (id, journal_id, owner_id, line_number, account_code, account_name, debit_cents, credit_cents)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      input.lines.forEach((l, idx) => {
        insertLine.run(
          `${journalId}-L${idx + 1}`,
          journalId,
          input.ownerId,
          idx + 1,
          l.accountCode,
          resolvedNames[idx],
          Math.round(l.debitCents || 0),
          Math.round(l.creditCents || 0)
        );
      });
      this.db.exec('COMMIT;');
    } catch (err) {
      this.db.exec('ROLLBACK;');
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'SQLite journal transaction failed.',
      };
    }

    return { ok: true, reused: false, journalId, journalNumber: jNum, debitCents: dr, creditCents: cr };
  }

  reverseLedgerJournalSql(input: {
    ownerId: string;
    journalId: string;
    entryDate: string;
    periodCode: string;
    reason: string;
    makerActorId: string;
    checkerActorId: string;
  }): { ok: boolean; reversalJournalId?: string; reversalJournalNumber?: string; error?: string } {
    if (!input.checkerActorId || input.checkerActorId === input.makerActorId) {
      return { ok: false, error: 'Maker-Checker SoD violation: reversal checker cannot equal maker.' };
    }

    const orig = this.db
      .prepare('SELECT id, journal_number, status, reversed_by_journal_id FROM journal_entries WHERE owner_id = ? AND id = ?')
      .get(input.ownerId, input.journalId) as
      | { id: string; journal_number: string; status: string; reversed_by_journal_id: string | null }
      | undefined;

    if (!orig) {
      return { ok: false, error: `Journal ${input.journalId} not found for owner ${input.ownerId}.` };
    }
    if (orig.status === 'Reversed' || orig.reversed_by_journal_id) {
      return { ok: false, error: `Journal ${orig.journal_number} is already reversed.` };
    }

    const origLines = this.db
      .prepare('SELECT account_code, account_name, debit_cents, credit_cents FROM journal_lines WHERE journal_id = ? ORDER BY line_number ASC')
      .all(orig.id) as Array<{ account_code: string; account_name: string; debit_cents: number; credit_cents: number }>;

    const posted = this.postLedgerJournalSql({
      ownerId: input.ownerId,
      entryDate: input.entryDate,
      periodCode: input.periodCode,
      ruleId: 'PR-25',
      sourceType: 'Reversal',
      sourceId: orig.id,
      idempotencyKey: `REV-SQL-${orig.id}`,
      description: `PR-25 Mirror Reversal of ${orig.journal_number}: ${input.reason}`,
      makerActorId: input.makerActorId,
      checkerActorId: input.checkerActorId,
      lines: origLines.map((l) => ({
        accountCode: l.account_code,
        accountName: l.account_name,
        debitCents: l.credit_cents,
        creditCents: l.debit_cents,
      })),
    });

    if (!posted.ok || !posted.journalId) {
      return { ok: false, error: posted.error || 'Failed to create PR-25 mirror reversal.' };
    }

    this.db
      .prepare('UPDATE journal_entries SET reversal_of_journal_id = ? WHERE id = ?')
      .run(orig.id, posted.journalId);
    this.db
      .prepare("UPDATE journal_entries SET status = 'Reversed', reversed_by_journal_id = ? WHERE id = ?")
      .run(posted.journalId, orig.id);

    return {
      ok: true,
      reversalJournalId: posted.journalId,
      reversalJournalNumber: posted.journalNumber,
    };
  }

  requestPeriodCloseSql(input: {
    ownerId: string;
    periodCode: string;
    closedBy: string;
    makerActorId: string;
    checkerActorId: string;
  }): { ok: boolean; error?: string } {
    if (!input.checkerActorId || input.checkerActorId === input.makerActorId) {
      return { ok: false, error: 'Maker-Checker SoD violation: checker cannot equal maker.' };
    }
    const lineTotals = this.db
      .prepare('SELECT COALESCE(SUM(debit_cents), 0) AS dr, COALESCE(SUM(credit_cents), 0) AS cr FROM journal_lines WHERE owner_id = ?')
      .get(input.ownerId) as { dr: number; cr: number };
    if (Number(lineTotals?.dr || 0) !== Number(lineTotals?.cr || 0)) {
      return { ok: false, error: 'Cannot close period when trial balance is out of balance.' };
    }
    const now = new Date().toISOString();
    this.db
      .prepare(`
        UPDATE accounting_periods
        SET status = 'Closed', closed_at = ?, closed_by = ?, last_trial_balance_cents = ?
        WHERE owner_id = ? AND period_code = ?
      `)
      .run(now, input.closedBy, Number(lineTotals?.dr || 0), input.ownerId, input.periodCode);
    return { ok: true };
  }

  getBackupLedgerManifest(ownerId = 'OWN-ALPHA'): Record<string, unknown> {
    const summary = this.getLedgerSummary(ownerId);
    const closed = this.db
      .prepare("SELECT period_code, last_trial_balance_cents FROM accounting_periods WHERE owner_id = ? AND status = 'Closed' ORDER BY month_index DESC LIMIT 1")
      .get(ownerId) as { period_code: string; last_trial_balance_cents: number } | undefined;

    return {
      ...summary,
      lastClosedPeriodCode: closed?.period_code || 'None',
      lastClosedTrialBalanceCents: Number(closed?.last_trial_balance_cents || 0),
      appendOnlyTriggersActive: true,
      generatedAt: new Date().toISOString(),
    };
  }
}
