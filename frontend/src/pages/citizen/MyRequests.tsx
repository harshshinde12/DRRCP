import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Card, EmptyState, EnumBadge, ErrorState, Skeleton, formatApiError, useToast } from '../../components/ui.tsx';
import { useMeta } from '../../lib/meta.tsx';
import { STR } from '../../lib/strings.ts';
import { useRequestAction, useRequests } from '../../lib/queries.ts';

function Filters({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { options } = useMeta();
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by status">
      {['', ...options('requestStatuses').map((o) => o.value)].map((s) => (
        <button
          key={s || 'ALL'}
          onClick={() => onChange(s)}
          aria-pressed={value === s}
          className={`rounded-full px-3 py-1 text-xs font-semibold ${value === s ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'}`}
        >
          {s || 'All'}
        </button>
      ))}
    </div>
  );
}

export default function MyRequests() {
  const { push } = useToast();
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const q = useRequests({ status: status || undefined, page, limit: 10 }, {});
  const action = useRequestAction();

  async function cancel(id: string) {
    if (!confirm(STR.cancelConfirm)) return;
    try {
      await action.mutateAsync({ id, kind: 'cancel' });
      push('success', STR.requestCancelled);
    } catch (err) {
      push('error', formatApiError(err));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">📋 My requests</h1>
        <Link to="/request-help"><Button>🆘 New request</Button></Link>
      </div>
      <Filters value={status} onChange={(v) => { setStatus(v); setPage(1); }} />
      {q.isLoading && <><Skeleton className="h-32" /><Skeleton className="h-32" /></>}
      {q.isError && <ErrorState message="Could not load your requests." onRetry={() => void q.refetch()} />}
      {q.data && q.data.items.length === 0 && (
        <EmptyState title="No requests yet" hint="When disaster strikes, raise a request here and track rescue progress live." action={<Link to="/request-help"><Button>Request help</Button></Link>} />
      )}
      <div className="space-y-3">
        {(q.data?.items ?? []).map((r) => (
          <Card key={r.id}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <Link to={`/my-requests/${r.id}`} className="link font-bold">{r.emergencyType} · {r.peopleAffected} {r.peopleAffected === 1 ? 'person' : 'people'}</Link>
                <p className="truncate text-sm text-slate-500">📍 {r.location}</p>
              </div>
              <div className="flex flex-wrap gap-1.5"><EnumBadge group="priorities" value={r.priority} /><EnumBadge group="requestStatuses" value={r.status} /></div>
            </div>
            <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">{r.displayStatus}</div>
            {(r.assignments ?? []).length > 1 && (
              <p className="mt-1 text-xs font-semibold text-violet-600 dark:text-violet-300">· {STR.supportAdditional} dispatched ({r.assignments.length} teams)</p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <Link to={`/my-requests/${r.id}`}><Button variant="secondary" size="sm">Track →</Button></Link>
              {['SUBMITTED', 'VERIFIED'].includes(r.status) && (
                <Button variant="danger" size="sm" disabled={action.isPending} onClick={() => void cancel(r.id)}>{STR.cancelRequest}</Button>
              )}
            </div>
          </Card>
        ))}
      </div>
      {q.data?.meta && q.data.meta.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-slate-500">Page {q.data.meta.page} of {q.data.meta.totalPages}</p>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>← Prev</Button>
            <Button variant="secondary" size="sm" disabled={page >= q.data.meta.totalPages} onClick={() => setPage((p) => p + 1)}>Next →</Button>
          </div>
        </div>
      )}
    </div>
  );
}
