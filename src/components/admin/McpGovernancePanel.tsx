import React, { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, RefreshCw, ShieldAlert, ShieldCheck, ShieldOff, UserPlus } from 'lucide-react';
import { DEMO_PERSONAS } from '../../data/seedData';
import { biText } from '../../data/i18n';
import { usePrms } from '../../context/PrmsContext';

interface McpBindingDto {
  id: string;
  supabaseUid: string;
  oauthClientId: string;
  actorId: string;
  role: string;
  allowedOwners: string[];
  defaultOwnerId: string | null;
  allowedTools: string[];
  grantStatus: 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'REVOKED';
  provisionedBy: string;
  approvedBy: string | null;
  approvedAt: string | null;
  revokedBy: string | null;
  revocationReason: string | null;
  tokenNotBefore: number;
}

interface McpAuditEventDto {
  id: string;
  seq: number;
  timestamp: string;
  channel: string;
  transport: string;
  authMode: string;
  actorId: string | null;
  role: string | null;
  ownerId: string | null;
  toolName: string;
  decision: 'ALLOWED' | 'DENIED';
  httpStatus: number;
  denialReason: string | null;
}

const ALL_TOOLS = [
  'get_system_status',
  'get_property_summary',
  'list_buildings',
  'get_unit_occupancy',
  'get_lease_summary',
  'get_rent_collection_summary',
  'get_overdue_rent_summary',
  'get_audit_summary',
];

export const McpGovernancePanel: React.FC = () => {
  const { currentPersona, locale, session } = usePrms();
  const [bindings, setBindings] = useState<McpBindingDto[]>([]);
  const [auditEvents, setAuditEvents] = useState<McpAuditEventDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);

  const [form, setForm] = useState({
    supabaseUid: '',
    oauthClientId: '',
    actorId: 'USR-SYNTH-07',
    ownerAlpha: true,
    ownerBeta: false,
    defaultOwnerId: 'OWN-ALPHA',
    selectedTools: [] as string[],
  });

  const isMaker = currentPersona.role === 'System Administrator';
  const isChecker =
    currentPersona.role === 'General Manager' || currentPersona.role === 'Owner / Director';
  const canInspectAudit =
    isMaker || isChecker || currentPersona.role === 'Auditor / Read-only reviewer';

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [bRes, aRes] = await Promise.all([
        fetch('/api/office/mcp/bindings', { credentials: 'include' }),
        fetch('/api/office/mcp/audit?limit=15', { credentials: 'include' }),
      ]);
      if (bRes.ok) {
        const bJson = (await bRes.json()) as { bindings?: McpBindingDto[] };
        setBindings(Array.isArray(bJson.bindings) ? bJson.bindings : []);
      }
      if (aRes.ok) {
        const aJson = (await aRes.json()) as { recentEvents?: McpAuditEventDto[] };
        setAuditEvents(Array.isArray(aJson.recentEvents) ? aJson.recentEvents : []);
      }
    } catch {
      // Non-blocking in offline simulation mode
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleToggleTool = (tool: string) => {
    setForm((prev) => ({
      ...prev,
      selectedTools: prev.selectedTools.includes(tool)
        ? prev.selectedTools.filter((t) => t !== tool)
        : [...prev.selectedTools, tool],
    }));
  };

  const handleSubmitCandidate = async (e: React.FormEvent) => {
    e.preventDefault();
    setBanner(null);
    const allowedOwners: string[] = [];
    if (form.ownerAlpha) allowedOwners.push('OWN-ALPHA');
    if (form.ownerBeta) allowedOwners.push('OWN-BETA');

    const res = await fetch('/api/office/mcp/bindings/requests', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        supabaseUid: form.supabaseUid.trim(),
        oauthClientId: form.oauthClientId.trim(),
        actorId: form.actorId,
        allowedOwners,
        defaultOwnerId: form.defaultOwnerId || null,
        allowedTools: form.selectedTools,
      }),
    });
    const json = (await res.json()) as { ok?: boolean; msg?: string };
    if (!res.ok) {
      setBanner({ tone: 'err', text: json.msg || 'Candidate provisioning failed.' });
      return;
    }
    setBanner({
      tone: 'ok',
      text: 'PENDING MCP binding submitted for independent Checker approval.',
    });
    setForm((prev) => ({ ...prev, supabaseUid: '', oauthClientId: '', selectedTools: [] }));
    await loadData();
  };

  const handleDecision = async (id: string, action: 'approve' | 'reject' | 'revoke') => {
    setBanner(null);
    const res = await fetch(`/api/office/mcp/bindings/${encodeURIComponent(id)}/${action}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: `Admin action: ${action}` }),
    });
    const json = (await res.json()) as { ok?: boolean; msg?: string };
    if (!res.ok) {
      setBanner({ tone: 'err', text: json.msg || `Failed to ${action} binding.` });
      return;
    }
    setBanner({ tone: 'ok', text: `Binding ${id} ${action}d successfully.` });
    await loadData();
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl p-4 space-y-2 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-bold text-sm text-[#0F233A] dark:text-slate-100">
            <ShieldCheck className="w-4 h-4 text-[#166549] dark:text-emerald-400" />
            <span>
              {biText(
                locale,
                'MCP OAuth 2.1 Actor Bindings & Maker-Checker Governance',
                'የMCP OAuth 2.1 ተጠቃሚ ትስስር እና Maker-Checker ቁጥጥር'
              )}
            </span>
          </div>
          <button
            type="button"
            onClick={() => void loadData()}
            disabled={loading}
            className="px-2.5 py-1.5 rounded-lg border border-[#CBD5E1] dark:border-[#2D405B] hover:bg-slate-50 dark:hover:bg-[#152236] inline-flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{biText(locale, 'Refresh', 'አድስ')}</span>
          </button>
        </div>
        <p className="text-slate-600 dark:text-slate-300">
          {biText(
            locale,
            'Deny-by-default explicit tool allowlists ([] default, zero wildcards). System Administrator (Maker) submits PENDING candidates; General Manager or Owner / Director (Checker) activates grants independently.',
            'ነባሪ የመሳሪያ ፈቃድ ባዶ ([]) ነው። የሲስተም አስተዳዳሪ (Maker) እጩ ያቀርባል፤ ዋና ሥራ አስኪያጅ ወይም ባለቤት (Checker) ያጸድቃል።'
          )}
        </p>
        {!canInspectAudit && (
          <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>
              {biText(
                locale,
                'Active role does not have MCP governance administration permissions.',
                'አሁን ያለው ሚና የMCP አስተዳደር ፈቃድ የለውም።'
              )}
            </span>
          </div>
        )}
      </div>

      {banner && (
        <div
          className={`p-3 rounded-xl border text-xs ${
            banner.tone === 'ok'
              ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
              : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 text-red-900 dark:text-red-200'
          }`}
        >
          {banner.text}
        </div>
      )}

      {isMaker && (
        <form
          onSubmit={(e) => void handleSubmitCandidate(e)}
          className="bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl p-4 space-y-4 text-xs"
        >
          <div className="flex items-center gap-2 font-bold text-[#0F233A] dark:text-slate-100">
            <UserPlus className="w-4 h-4 text-[#166549]" />
            <span>Step A (Maker — {session.actorId}): Submit PENDING MCP Binding Candidate</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold mb-1">Supabase UID (sub) *</label>
              <input
                required
                value={form.supabaseUid}
                onChange={(e) => setForm({ ...form, supabaseUid: e.target.value })}
                placeholder="8a1f3b2c-0000-4000-8000-00000000c902"
                className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Registered OAuth Client ID *</label>
              <input
                required
                value={form.oauthClientId}
                onChange={(e) => setForm({ ...form, oauthClientId: e.target.value })}
                placeholder="3f7b9a10-0000-4000-8000-000000000001"
                className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] font-mono"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Target AD-PRMS Actor *</label>
              <select
                value={form.actorId}
                onChange={(e) => setForm({ ...form, actorId: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236]"
              >
                {DEMO_PERSONAS.filter((p) => p.syntheticId !== session.actorId).map((p) => (
                  <option key={p.syntheticId} value={p.syntheticId}>
                    {p.syntheticId} — {p.role}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <span className="font-semibold">Allowed Synthetic Owners:</span>
            <label className="inline-flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={form.ownerAlpha}
                onChange={(e) => setForm({ ...form, ownerAlpha: e.target.checked })}
              />
              <span>OWN-ALPHA</span>
            </label>
            <label className="inline-flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={form.ownerBeta}
                onChange={(e) => setForm({ ...form, ownerBeta: e.target.checked })}
              />
              <span>OWN-BETA</span>
            </label>
            <div className="flex items-center gap-2">
              <span className="font-semibold">Default Owner:</span>
              <select
                value={form.defaultOwnerId}
                onChange={(e) => setForm({ ...form, defaultOwnerId: e.target.value })}
                className="px-2 py-1 rounded border border-[#CBD5E1] dark:border-[#2D405B] bg-white dark:bg-[#152236] font-mono"
              >
                <option value="">None (Require explicit ownerId)</option>
                <option value="OWN-ALPHA">OWN-ALPHA</option>
                <option value="OWN-BETA">OWN-BETA</option>
              </select>
            </div>
          </div>

          <div>
            <p className="font-semibold mb-1.5">Explicitly Granted Read-Only Tools (Default []):</p>
            <div className="flex flex-wrap gap-2">
              {ALL_TOOLS.map((tool) => {
                const active = form.selectedTools.includes(tool);
                return (
                  <button
                    key={tool}
                    type="button"
                    onClick={() => handleToggleTool(tool)}
                    className={`px-2.5 py-1 rounded-md border font-mono text-[11px] cursor-pointer ${
                      active
                        ? 'bg-[#166549] text-white border-[#166549]'
                        : 'bg-slate-50 dark:bg-[#152236] border-slate-300 dark:border-[#2D405B] text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    {tool}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-[#0F233A] hover:bg-[#163150] text-white font-semibold cursor-pointer"
            >
              Submit PENDING Binding Candidate
            </button>
          </div>
        </form>
      )}

      {/* Registered Bindings Table */}
      <section className="bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl overflow-hidden text-xs">
        <div className="px-4 py-3 border-b border-[#DFE5EE] dark:border-[#233349] font-bold text-[#0F233A] dark:text-slate-100">
          MCP Actor Bindings ({bindings.length})
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[#F8FAFC] dark:bg-[#152236] text-slate-600 dark:text-slate-300 border-b border-[#DFE5EE] dark:border-[#233349]">
              <tr>
                <th className="py-2 px-3">Binding / Actor</th>
                <th className="py-2 px-3">Supabase UID / Client</th>
                <th className="py-2 px-3">Owners & Explicit Tools</th>
                <th className="py-2 px-3">Provenance</th>
                <th className="py-2 px-3">Status</th>
                <th className="py-2 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#1D2D42]">
              {bindings.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-500">
                    No MCP actor bindings provisioned yet.
                  </td>
                </tr>
              )}
              {bindings.map((b) => (
                <tr key={b.id}>
                  <td className="py-2.5 px-3">
                    <p className="font-mono font-bold">{b.id}</p>
                    <p>{b.actorId} · {b.role}</p>
                  </td>
                  <td className="py-2.5 px-3 font-mono text-[11px]">
                    <p>sub: {b.supabaseUid}</p>
                    <p>cid: {b.oauthClientId}</p>
                  </td>
                  <td className="py-2.5 px-3 font-mono text-[11px]">
                    <p>owners: {b.allowedOwners.join(', ')}</p>
                    <p>tools ({b.allowedTools.length}): {b.allowedTools.join(', ') || '[] (none)'}</p>
                  </td>
                  <td className="py-2.5 px-3 font-mono text-[11px]">
                    <p>maker: {b.provisionedBy}</p>
                    <p>checker: {b.approvedBy || 'Pending'}</p>
                  </td>
                  <td className="py-2.5 px-3 font-bold">{b.grantStatus}</td>
                  <td className="py-2.5 px-3 text-right space-x-2">
                    {b.grantStatus === 'PENDING' && isChecker && (
                      <>
                        <button
                          type="button"
                          onClick={() => void handleDecision(b.id, 'approve')}
                          className="px-2.5 py-1 rounded bg-[#166549] text-white font-semibold inline-flex items-center gap-1 cursor-pointer"
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Approve</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDecision(b.id, 'reject')}
                          className="px-2.5 py-1 rounded border border-red-300 text-red-700 font-semibold cursor-pointer"
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {b.grantStatus === 'ACTIVE' && (isMaker || isChecker) && (
                      <button
                        type="button"
                        onClick={() => void handleDecision(b.id, 'revoke')}
                        className="px-2.5 py-1 rounded bg-red-600 text-white font-semibold inline-flex items-center gap-1 cursor-pointer"
                      >
                        <ShieldOff className="w-3 h-3" />
                        <span>Revoke</span>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Server-Controlled Audit Events */}
      <section className="bg-white dark:bg-[#111C2C] border border-[#DFE5EE] dark:border-[#233349] rounded-xl overflow-hidden text-xs">
        <div className="px-4 py-3 border-b border-[#DFE5EE] dark:border-[#233349] font-bold text-[#0F233A] dark:text-slate-100">
          Server-Controlled MCP Audit Chain (Latest {auditEvents.length})
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-[#F8FAFC] dark:bg-[#152236] text-slate-600 dark:text-slate-300 border-b border-[#DFE5EE] dark:border-[#233349]">
              <tr>
                <th className="py-2 px-3">Seq / ID</th>
                <th className="py-2 px-3">Channel / Auth</th>
                <th className="py-2 px-3">Actor / Owner</th>
                <th className="py-2 px-3">Tool / Action</th>
                <th className="py-2 px-3">Decision</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-[#1D2D42]">
              {auditEvents.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-slate-500">
                    No server MCP audit events recorded yet.
                  </td>
                </tr>
              )}
              {auditEvents.map((ev) => (
                <tr key={ev.id}>
                  <td className="py-2 px-3 font-mono text-[11px]">
                    #{ev.seq} · {ev.id}
                  </td>
                  <td className="py-2 px-3 font-mono text-[11px]">
                    {ev.channel} · {ev.authMode}
                  </td>
                  <td className="py-2 px-3 font-mono text-[11px]">
                    {ev.actorId || 'NULL'} ({ev.ownerId || 'GLOBAL'})
                  </td>
                  <td className="py-2 px-3 font-mono text-[11px]">{ev.toolName}</td>
                  <td className="py-2 px-3 font-bold">
                    <span className={ev.decision === 'ALLOWED' ? 'text-emerald-600' : 'text-red-600'}>
                      {ev.decision} ({ev.httpStatus})
                    </span>
                    {ev.denialReason && (
                      <span className="block font-mono text-[10px] text-slate-500">
                        {ev.denialReason}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
