import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { StatusTimeline } from '../../components/StatusBits.tsx';
import { Badge, Button, Card, DataTable, EmptyState, EnumBadge, ErrorState, Field, Input, Modal, Select, Textarea, formatApiError, useToast, type Column } from '../../components/ui.tsx';
import { useMeta } from '../../lib/meta.tsx';
import { useAssignTeam, useMatchingTeams, useRequest, useRequestAction, useRequests } from '../../lib/queries.ts';
import type { EmergencyRequest } from '../../lib/types.ts';

/* ---------- Override modal (mandatory reason) ---------- */
function OverrideModal({ open, onClose, teamName, onConfirm, busy }: { open: boolean; onClose: () => void; teamName: string; onConfirm: (reason: string) => void; busy: boolean }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (open) { setReason(''); setError(null); } }, [open ]);
  function confirm() {
    if (reason.trim().length < 5) { setError('A reason of at least 5 characters is required — it goes into the audit trail.'); return; }
    onConfirm(reason.trim());
  }
  return (
    <Modal open={open} onClose={onClose} title="⚠️ Override availability block">
      <p className="text-sm text-slate-600 dark:text-slate-300">
        <strong>{teamName}</strong> is not AVAILABLE. Force-assigning is allowed only with a recorded reason (SRS Team.Assign.Block).
      </p>
      <div className="mt-3">
        <Field label="Override reason (mandatory)" error={error ?? undefined} htmlFor="ovr">
          <Textarea id="ovr" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Nearest boat crew; second incident in same lane" />
        </Field>
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant="danger" disabled={busy} onClick={confirm}>{busy ? 'Assigning…' : 'Override & assign'}</Button>
      </div>
    </Modal>
  );
}

/* ---------- Triage drawer ---------- */
function TriageDrawer({ requestId, onClose }: { requestId: string | null; onClose: () => void }) {
  const { push } = useToast();
  const { options, label } = useMeta();
  const q = useRequest(requestId ?? undefined);
  const act = useRequestAction();
  const assign = useAssignTeam();
  const [verify, setVerify] = useState({ decision: 'VERIFIED', priority: 'HIGH', duplicateOfId: '' });
  const [priority, setPriority] = useState('HIGH');
  const [teamId, setTeamId] = useState('');
  const [overrideTeam, setOverrideTeam] = useState<{ id: string; name: string } | null>(null);
  const match = useMatchingTeams(requestId ?? undefined);
  const r = q.data;

  useEffect(() => { setTeamId(''); setOverrideTeam(null); }, [requestId]);

  async function doVerify() {
    if (!requestId) return;
    try {
      await act.mutateAsync({ id: requestId, kind: 'verify', body: { decision: verify.decision, priority: verify.priority, duplicateOfId: verify.duplicateOfId || undefined } });
      push('success', `Request ${verify.decision.toLowerCase()}.`);
    } catch (err) { push('error', formatApiError(err)); }
  }
  async function doPriority() {
    if (!requestId) return;
    try {
      await act.mutateAsync({ id: requestId, kind: 'priority', body: { priority } });
      push('success', `Priority set to ${priority}.`);
    } catch (err) { push('error', formatApiError(err)); }
  }
  async function doAssign(team: string, override = false, overrideReason?: string) {
    if (!requestId) return;
    try {
      await assign.mutateAsync({ requestId, teamId: team, override, overrideReason });
      push('success', override ? 'Team force-assigned (override logged).' : 'Team assigned.');
      setOverrideTeam(null);
    } catch (err) { push('error', formatApiError(err)); }
  }

  const hasAssignments = (r?.assignments?.length ?? 0) > 0;

  return (
    <>
      <div className={`fixed inset-0 z-40 bg-slate-950/50 transition ${requestId ? '' : 'pointer-events-none opacity-0'}`} onClick={onClose} aria-hidden />
      <aside aria-label="Triage panel" className={`fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-xl transition-transform dark:border-slate-800 dark:bg-slate-900 ${requestId ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex items-center justify-between border-b border-slate-200 p-4 dark:border-slate-800">
          <h2 className="font-extrabold text-slate-900 dark:text-white">Triage</h2>
          <button onClick={onClose} aria-label="Close triage panel" className="rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800">✕</button>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {q.isLoading && <p className="text-sm text-slate-400">Loading…</p>}
          {q.isError && <ErrorState message="Could not load request." onRetry={() => void q.refetch()} />}
          {r && (
            <>
              <div>
                <p className="font-bold">{label('emergencyTypes', r.emergencyType)} · {r.peopleAffected} people</p>
                <p className="text-sm text-slate-500">📍 {r.location} · by {r.requester.name}{r.requester.phone ? ` (${r.requester.phone})` : ''}</p>
                <p className="mt-1 text-sm">{r.description}</p>
                <div className="mt-2 flex flex-wrap gap-1.5"><EnumBadge group="priorities" value={r.priority} /><EnumBadge group="requestStatuses" value={r.status} /></div>
                <div className="mt-3"><StatusTimeline status={r.status} missionStatus={r.missionStatus} displayStatus={r.displayStatus} /></div>
              </div>

              {r.status === 'SUBMITTED' && (
                <section aria-label="Verify" className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
                  <h3 className="text-sm font-bold">1 · Verify</h3>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <Field label="Decision"><Select value={verify.decision} onChange={(e) => setVerify({ ...verify, decision: e.target.value })}>{['VERIFIED', 'DUPLICATE', 'REJECTED'].map((d) => <option key={d} value={d}>{d}</option>)}</Select></Field>
                    <Field label="Priority"><Select value={verify.priority} onChange={(e) => setVerify({ ...verify, priority: e.target.value })}>{options('priorities').map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</Select></Field>
                  </div>
                  {verify.decision === 'DUPLICATE' && (
                    <div className="mt-2"><Field label="Original request ID"><Input value={verify.duplicateOfId} onChange={(e) => setVerify({ ...verify, duplicateOfId: e.target.value })} placeholder="Paste the original request ID" /></Field></div>
                  )}
                  <Button size="sm" className="mt-2" disabled={act.isPending} onClick={() => void doVerify()}>Apply decision</Button>
                </section>
              )}

              <section aria-label="Priority" className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
                <h3 className="text-sm font-bold">2 · Priority</h3>
                <div className="mt-2 flex gap-2">
                  <Select value={priority} onChange={(e) => setPriority(e.target.value)} aria-label="Priority">{options('priorities').map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</Select>
                  <Button size="sm" disabled={act.isPending} onClick={() => void doPriority()}>Set</Button>
                </div>
              </section>

              {['VERIFIED', 'ASSIGNED', 'RESCUE_IN_PROGRESS'].includes(r.status) && (
                <section aria-label="Assign team" className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
                  <h3 className="text-sm font-bold">3 · {hasAssignments ? 'Assign additional support' : 'Assign rescue team'}</h3>
                  {hasAssignments && <p className="mt-1 text-xs text-slate-500">Already dispatched: {r.assignments.map((a) => a.team.name).join(', ')}. A repeat dispatch is logged as additional support.</p>}
                  {match.isLoading && <p className="mt-2 text-xs text-slate-400">Ranking available teams…</p>}
                  <ul className="mt-2 space-y-1.5">
                    {(match.data?.teams ?? []).map((t) => (
                      <li key={t.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white p-2 text-xs dark:border-slate-700 dark:bg-slate-900">
                        <span className="min-w-0">
                          <strong>{t.name}</strong> <EnumBadge group="teamAvailability" value={t.availabilityStatus} /><br />
                          <span className="text-slate-500">{t.teamType} · {t.distanceKm != null ? `${t.distanceKm.toFixed(1)} km` : 'no coords'}{t.capabilityMatch ? ' · ✓ capability match' : ''}</span>
                        </span>
                        <Button size="sm" disabled={assign.isPending} onClick={() => t.availabilityStatus === 'AVAILABLE' ? void doAssign(t.id) : setOverrideTeam({ id: t.id, name: t.name })}>
                          {hasAssignments ? 'Add support' : 'Assign'}
                        </Button>
                      </li>
                    ))}
                  </ul>
                  {(match.data?.teams.length ?? 0) === 0 && <p className="mt-2 text-xs text-slate-500">No AVAILABLE teams right now — pick any team above via override, or wait.</p>}
                  <div className="mt-2 flex gap-2">
                    <Input placeholder="Or paste any team ID…" value={teamId} onChange={(e) => setTeamId(e.target.value)} aria-label="Team ID" />
                    <Button size="sm" variant="secondary" disabled={!teamId || assign.isPending} onClick={() => setOverrideTeam({ id: teamId, name: teamId })}>Force…</Button>
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </aside>
      <OverrideModal
        open={overrideTeam != null}
        onClose={() => setOverrideTeam(null)}
        teamName={overrideTeam?.name ?? ''}
        busy={assign.isPending}
        onConfirm={(reason) => { if (overrideTeam) void doAssign(overrideTeam.id, true, reason); }}
      />
    </>
  );
}

/* ---------- Queue page ---------- */
const columns: Column<EmergencyRequest>[] = [
  { key: 'type', header: 'Type', render: (r) => <span className="font-semibold">{r.emergencyType}</span>, sortValue: (r) => r.emergencyType },
  { key: 'loc', header: 'Location', render: (r) => <span className="text-slate-600 dark:text-slate-300">{r.location}</span> },
  { key: 'people', header: 'People', render: (r) => <span>{r.peopleAffected}</span>, sortValue: (r) => r.peopleAffected },
  { key: 'priority', header: 'Priority', render: (r) => <EnumBadge group="priorities" value={r.priority} />, sortValue: (r) => r.priority },
  { key: 'status', header: 'Status', render: (r) => <span className="flex flex-col gap-1"><EnumBadge group="requestStatuses" value={r.status} /><span className="text-xs text-slate-500">{r.displayStatus}</span></span>, sortValue: (r) => r.status },
  { key: 'teams', header: 'Teams', render: (r) => <span>{(r.assignments?.length ?? r._count?.assignments ?? 0) > 0 ? <Badge>{r.assignments?.length ?? r._count?.assignments} dispatched</Badge> : <span className="text-slate-400">—</span>}</span> },
  { key: 'age', header: 'Filed', render: (r) => <span className="whitespace-nowrap text-xs text-slate-500">{new Date(r.createdAt).toLocaleString()}</span>, sortValue: (r) => r.createdAt },
];

export default function RequestQueue() {
  const [params, setParams] = useSearchParams();
  const [status, setStatus] = useState(params.get('status') ?? '');
  const [priority, setPriority] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [focus, setFocus] = useState<string | null>(params.get('focus'));
  const { options } = useMeta();

  const q = useRequests({ status: status || undefined, priority: priority || undefined, search: search || undefined, page, limit: 15 });

  useEffect(() => {
    const f = params.get('focus');
    if (f) setFocus(f);
  }, [params]);

  const rows = (q.data?.items ?? []).map((r) => ({ ...r, id: r.id }));

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">📥 Request queue</h1>
      <Card>
        <div className="flex flex-wrap gap-2">
          <Select aria-label="Status filter" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="w-auto">
            <option value="">All statuses</option>
            {options('requestStatuses').map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
          <Select aria-label="Priority filter" value={priority} onChange={(e) => { setPriority(e.target.value); setPage(1); }} className="w-auto">
            <option value="">All priorities</option>
            {options('priorities').map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
          <Input placeholder="Search location / description…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="min-w-40 flex-1" aria-label="Search requests" />
        </div>
      </Card>
      {q.isLoading && <p className="text-sm text-slate-400">Loading queue…</p>}
      {q.isError && <ErrorState message="Could not load the queue." onRetry={() => void q.refetch()} />}
      {q.data && (
        <DataTable
          rows={rows}
          columns={columns}
          meta={q.data.meta}
          page={page}
          onPage={setPage}
          emptyTitle="Queue is clear 🎉"
          onRowClick={(row) => { setFocus(row.id); setParams((p) => { p.set('focus', row.id); return p; }, { replace: true }); }}
        />
      )}
      <TriageDrawer requestId={focus} onClose={() => { setFocus(null); setParams((p) => { p.delete('focus'); return p; }, { replace: true }); }} />
    </div>
  );
}
