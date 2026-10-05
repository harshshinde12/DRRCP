import { Link, useParams } from 'react-router-dom';
import { AssignmentChip, StatusTimeline } from '../../components/StatusBits.tsx';
import { Button, Card, CardTitle, EmptyState, EnumBadge, ErrorState, Skeleton, formatApiError, useToast } from '../../components/ui.tsx';
import { useMeta } from '../../lib/meta.tsx';
import { useRequest, useRequestAction, useRequestHistory } from '../../lib/queries.ts';

/** F-05: audit metadata carries duplicate-link / override / dispatch context — render it instead of dropping it. */
function renderMetadata(metadata?: string | null) {
  if (!metadata) return null;
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(metadata) as Record<string, unknown>;
  } catch {
    return <span className="text-slate-500">{metadata}</span>;
  }
  const bits: string[] = [];
  const pick = (v: unknown) => (typeof v === 'string' || typeof v === 'number' ? String(v) : null);
  const dup = pick(parsed.duplicateOfId);
  if (dup) bits.push(`duplicate of ${dup.slice(0, 8)}…`);
  const team = pick(parsed.team) ?? pick(parsed.teamId);
  if (team) bits.push(`team ${team}`);
  const reason = pick(parsed.overrideReason) ?? pick(parsed.reason);
  if (reason) bits.push(`reason: ${reason}`);
  const asg = pick(parsed.assignmentId);
  if (asg) bits.push(`assignment ${asg.slice(0, 8)}…`);
  const prio = pick(parsed.priority);
  if (prio) bits.push(`priority ${prio}`);
  if (bits.length === 0) return null;
  return <span className="text-slate-500">({bits.join(' · ')})</span>;
}

export default function RequestDetail() {
  const { id } = useParams();
  const { push } = useToast();
  const { label } = useMeta();
  const q = useRequest(id);
  const hist = useRequestHistory(id);
  const action = useRequestAction();
  const r = q.data;

  async function cancel() {
    if (!id || !confirm('Cancel this request? This cannot be undone.')) return;
    try {
      await action.mutateAsync({ id, kind: 'cancel' });
      push('success', 'Request cancelled.');
    } catch (err) {
      push('error', formatApiError(err));
    }
  }

  if (q.isLoading) return <><Skeleton className="h-48" /><Skeleton className="h-32" /></>;
  if (q.isError || !r) return <ErrorState message="Could not load this request." onRetry={() => void q.refetch()} />;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link to="/my-requests" className="link text-sm">← Back to my requests</Link>
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h1 className="text-lg font-extrabold text-slate-900 dark:text-white">{label('emergencyTypes', r.emergencyType)} · {r.peopleAffected} {r.peopleAffected === 1 ? 'person' : 'people'}</h1>
            <p className="text-sm text-slate-500">📍 {r.location}</p>
          </div>
          <div className="flex gap-1.5"><EnumBadge group="priorities" value={r.priority} /><EnumBadge group="requestStatuses" value={r.status} /></div>
        </div>
        <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">{r.description}</p>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
          <span>Filed {new Date(r.createdAt).toLocaleString()}</span>
          {r.injuryPresent && <span>🩹 Injuries: {label('injurySeverities', r.injurySeverity ?? 'UNKNOWN')}</span>}
          {r.disaster && <span>🌊 {r.disaster.name}</span>}
        </div>
        {['SUBMITTED', 'VERIFIED'].includes(r.status) && (
          <div className="mt-3"><Button variant="danger" size="sm" disabled={action.isPending} onClick={() => void cancel()}>Cancel request</Button></div>
        )}
      </Card>

      <Card>
        <CardTitle>Live status</CardTitle>
        <StatusTimeline status={r.status} missionStatus={r.missionStatus} displayStatus={r.displayStatus} />
      </Card>

      {r.assignments.length > 0 && (
        <Card>
          <CardTitle>Rescue teams on this request</CardTitle>
          <ul className="space-y-2">
            {r.assignments.map((a, i) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 p-2.5 text-sm dark:bg-slate-800">
                <AssignmentChip assignment={a} additional={i > 0} />
                {a.report && <span className="text-xs text-slate-500">✓ {a.report.peopleRescued} rescued{a.report.notes ? ` — ${a.report.notes}` : ''}</span>}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card>
        <CardTitle>History</CardTitle>
        {hist.isLoading && <Skeleton />}
        {hist.isError && <ErrorState message="Could not load the event history." onRetry={() => void hist.refetch()} />}
        {!hist.isLoading && !hist.isError && hist.data && hist.data.length === 0 && <EmptyState title="No events yet" />}
        {!hist.isError && (
        <ol className="space-y-2">
          {(hist.data ?? []).map((h) => (
            <li key={h.id} className="flex flex-wrap gap-2 text-sm">
              <span className="font-mono text-xs text-slate-400">{new Date(h.timestamp).toLocaleString()}</span>
              <span className="font-semibold">{h.action.replace(/_/g, ' ')}</span>
              {h.actor && <span className="text-slate-500">by {h.actor.name}</span>}
              {renderMetadata(h.metadata)}
            </li>
          ))}
        </ol>
        )}
      </Card>
    </div>
  );
}
