import { useState } from 'react';
import { Button, Card, DataTable, EmptyState, EnumBadge, ErrorState, formatApiError, useToast, type Column } from '../../components/ui.tsx';
import { useTaskAction, useVolunteerTasks } from '../../lib/queries.ts';
import type { VolunteerTask } from '../../lib/types.ts';

const columns: Column<VolunteerTask>[] = [
  { key: 'title', header: 'Task', render: (t) => <span><strong>{t.title}</strong><br /><span className="text-xs text-slate-500">📍 {t.location} · assigned {new Date(t.assignedAt).toLocaleDateString()}</span></span>, sortValue: (t) => t.title },
  { key: 'type', header: 'Type', render: (t) => <EnumBadge group="volunteerTaskTypes" value={t.taskType} /> },
  { key: 'status', header: 'Status', render: (t) => <EnumBadge group="volunteerTaskStatuses" value={t.status} />, sortValue: (t) => t.status },
];

export default function Tasks() {
  const { push } = useToast();
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const q = useVolunteerTasks({ status: status || undefined, page, limit: 15 });
  const act = useTaskAction();

  async function run(id: string, kind: 'accept' | 'decline' | 'status', body?: unknown, label?: string) {
    try {
      await act.mutateAsync({ id, kind, body });
      push('success', label ?? 'Task updated.');
    } catch (err) {
      push('error', formatApiError(err));
    }
  }

  const actionCol: Column<VolunteerTask> = {
    key: 'act', header: 'Actions',
    render: (t) => (
      <span className="flex flex-wrap gap-1.5">
        {t.status === 'ASSIGNED' && (<>
          <Button size="sm" onClick={() => void run(t.id, 'accept', undefined, 'Task accepted — thank you!')}>✓ Accept</Button>
          <Button size="sm" variant="secondary" onClick={() => void run(t.id, 'decline', undefined, 'Task declined.')}>Decline</Button>
        </>)}
        {t.status === 'ACCEPTED' && <Button size="sm" onClick={() => void run(t.id, 'status', { status: 'IN_PROGRESS' }, 'Marked in progress.')}>▶ Start</Button>}
        {t.status === 'IN_PROGRESS' && <Button size="sm" variant="success" onClick={() => void run(t.id, 'status', { status: 'COMPLETED' }, 'Task completed. 🎉')}>✓ Complete</Button>}
        {['COMPLETED', 'DECLINED', 'CANCELLED'].includes(t.status) && <span className="text-xs text-slate-400">—</span>}
      </span>
    ),
  };

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">🤝 My tasks</h1>
      <Card>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter tasks">
          {['', 'ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED'].map((s) => (
            <button key={s || 'ALL'} onClick={() => { setStatus(s); setPage(1); }} aria-pressed={status === s}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${status === s ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'}`}>
              {s || 'All'}
            </button>
          ))}
        </div>
      </Card>
      {q.isError && <ErrorState message="Could not load tasks." onRetry={() => void q.refetch()} />}
      {q.data && (q.data.items.length === 0
        ? <EmptyState title="No tasks yet" hint="When coordinators need hands for low-risk work, assignments land here." />
        : <DataTable rows={q.data.items} columns={[...columns, actionCol]} meta={q.data.meta} page={page} onPage={setPage} emptyTitle="No tasks" />)}
    </div>
  );
}
