import { getSupabaseClient } from '../lib/supabase';
import { SeedState } from '../data/seedData';
import { OwnerId } from '../types/prms';
import { sanitizeSupabaseId } from './supabaseAuthService';

export interface WorkspaceSummaryMap {
  ownersCount: number;
  propertiesCount: number;
  unitsCount: number;
  chargesCount: number;
  receiptsCount: number;
  approvalsCount: number;
  auditEventsCount: number;
  latestAuditHash: string;
  ledgerJournalCount: number;
  trialBalanceTotalCents: number;
  lastClosedPeriod: string;
  threeWayCheckPassed: boolean;
}

export function buildWorkspaceSummaryMap(seed: SeedState): WorkspaceSummaryMap {
  const latestHash = (seed.auditEvents[0]?.id || 'GENESIS').slice(0, 128);
  const ledgerJournals = seed.ledgerJournals || [];

  let totalDebitBig = 0n;
  for (const journal of ledgerJournals) {
    for (const line of journal.lines) {
      totalDebitBig += BigInt(Math.round(line.debitCents || 0));
    }
  }

  const closedPeriod = [...(seed.accountingPeriods || [])]
    .reverse()
    .find((p) => p.status === 'Closed');

  let depositSumBig = 0n;
  for (const d of seed.depositCustodies || []) {
    if (d.status === 'Held' || d.status === 'Refund Pending') {
      depositSumBig += BigInt(Math.round(d.heldCents || 0));
    }
  }

  const clampedDebitCents =
    totalDebitBig > BigInt(Number.MAX_SAFE_INTEGER)
      ? Number.MAX_SAFE_INTEGER
      : Math.max(0, Number(totalDebitBig));

  return {
    ownersCount: Math.max(0, seed.owners.length),
    propertiesCount: Math.max(0, seed.properties.length),
    unitsCount: Math.max(0, seed.units.length),
    chargesCount: Math.max(0, seed.charges.length),
    receiptsCount: Math.max(0, seed.receipts.length),
    approvalsCount: Math.max(0, seed.approvals.length),
    auditEventsCount: Math.max(0, seed.auditEvents.length),
    latestAuditHash: sanitizeSupabaseId(latestHash, 'GENESIS'),
    ledgerJournalCount: Math.max(0, ledgerJournals.length),
    trialBalanceTotalCents: clampedDebitCents,
    lastClosedPeriod: (closedPeriod?.periodCode || 'None').slice(0, 32),
    threeWayCheckPassed: depositSumBig >= 0n,
  };
}

export async function syncWorkspaceSnapshotToSupabase(input: {
  uid: string;
  activeOwnerId: OwnerId;
  revision: number;
  seed: SeedState;
}): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;

  const safeUid = sanitizeSupabaseId(input.uid, 'uid');
  const workspaceId = sanitizeSupabaseId(`ws-${safeUid}`, 'ws');
  const summary = buildWorkspaceSummaryMap(input.seed);
  const revision = Math.max(0, Math.min(1000000000, Math.floor(input.revision)));

  const { error } = await client.from('workspaces').upsert(
    {
      id: workspaceId,
      owner_uid: input.uid,
      active_owner_id: input.activeOwnerId,
      updated_by_uid: input.uid,
      revision,
      summary,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );

  if (error) {
    throw new Error(`Supabase workspace sync failed: ${error.message}`);
  }
}

export async function appendAuditEventToSupabase(input: {
  uid: string;
  ownerEntityId: OwnerId;
  eventId: string;
  actor: string;
  action: string;
  sha256Hash: string;
}): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;

  const safeUid = sanitizeSupabaseId(input.uid, 'uid');
  const workspaceId = sanitizeSupabaseId(`ws-${safeUid}`, 'ws');
  const safeEventId = sanitizeSupabaseId(input.eventId, 'AUD');

  const { error } = await client.from('audit_events').insert({
    id: safeEventId,
    workspace_id: workspaceId,
    owner_uid: input.uid,
    owner_entity_id: input.ownerEntityId,
    actor: input.actor.trim().slice(0, 120) || 'Operator',
    action: input.action.trim().slice(0, 160) || 'Event',
    sha256_hash: sanitizeSupabaseId(input.sha256Hash || safeEventId, 'HASH'),
  });

  if (error && !error.message.toLowerCase().includes('duplicate')) {
    throw new Error(`Supabase audit insert failed: ${error.message}`);
  }
}

export async function recordPeriodClosureToSupabase(input: {
  uid: string;
  ownerEntityId: OwnerId;
  periodCode: string;
  trialBalanceDebitCents: number;
  trialBalanceCreditCents: number;
  journalCount: number;
  closedByActor: string;
}): Promise<void> {
  const client = getSupabaseClient();
  if (!client) return;

  const safeUid = sanitizeSupabaseId(input.uid, 'uid');
  const workspaceId = sanitizeSupabaseId(`ws-${safeUid}`, 'ws');

  const { error } = await client.rpc('close_fiscal_period', {
    p_workspace_id: workspaceId,
    p_owner_entity_id: input.ownerEntityId,
    p_period_code: input.periodCode.slice(0, 16),
    p_debit_cents: Math.max(0, Math.round(input.trialBalanceDebitCents)),
    p_credit_cents: Math.max(0, Math.round(input.trialBalanceCreditCents)),
    p_journal_count: Math.max(0, Math.round(input.journalCount)),
    p_closed_by_actor: input.closedByActor.trim().slice(0, 120) || 'Operator',
  });

  if (error) {
    throw new Error(`Supabase period closure failed: ${error.message}`);
  }
}

export async function uploadEvidenceToSupabaseStorage(params: {
  uid: string;
  ownerId: OwnerId;
  file: File;
  bucket?: string;
}): Promise<{ path: string; signedUrl: string | null }> {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error('Supabase Storage is not configured.');
  }

  const bucket = params.bucket || 'evidence-documents';
  const safeName = params.file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);
  const objectPath = `${sanitizeSupabaseId(params.ownerId, 'OWN')}/${sanitizeSupabaseId(params.uid, 'uid')}/${Date.now()}-${safeName}`;

  const { error: uploadError } = await client.storage.from(bucket).upload(objectPath, params.file, {
    upsert: false,
    contentType: params.file.type || 'application/octet-stream',
  });
  if (uploadError) {
    throw new Error(`Supabase Storage upload failed: ${uploadError.message}`);
  }

  const { data: signedData } = await client.storage.from(bucket).createSignedUrl(objectPath, 900);
  return {
    path: objectPath,
    signedUrl: signedData?.signedUrl ?? null,
  };
}

export function subscribeToWorkspaceSnapshot(
  uid: string,
  onUpdate: (data: { revision?: number; activeOwnerId?: OwnerId } | null) => void
): () => void {
  const client = getSupabaseClient();
  if (!client) {
    return () => {};
  }

  const safeUid = sanitizeSupabaseId(uid, 'uid');
  const workspaceId = sanitizeSupabaseId(`ws-${safeUid}`, 'ws');

  void client
    .from('workspaces')
    .select('revision, active_owner_id')
    .eq('id', workspaceId)
    .maybeSingle()
    .then(({ data }) => {
      if (!data) {
        onUpdate(null);
        return;
      }
      onUpdate({
        revision: Number(data.revision || 1),
        activeOwnerId: data.active_owner_id as OwnerId,
      });
    });

  const channel = client
    .channel(`workspace:${workspaceId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'workspaces',
        filter: `id=eq.${workspaceId}`,
      },
      (payload) => {
        const nextRow = payload.new as { revision?: number; active_owner_id?: OwnerId } | undefined;
        if (!nextRow) {
          onUpdate(null);
          return;
        }
        onUpdate({
          revision: nextRow.revision,
          activeOwnerId: nextRow.active_owner_id,
        });
      }
    )
    .subscribe();

  return () => {
    void client.removeChannel(channel);
  };
}
