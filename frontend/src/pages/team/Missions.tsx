import { Link } from 'react-router-dom';
import { AssignmentChip } from '../../components/StatusBits.tsx';
import { Button, Card, EmptyState, ErrorState, Skeleton } from '../../components/ui.tsx';
import { useAssignments } from '../../lib/queries.ts';

export default function Missions() {
  const q = useAssignments({ limit: 50 });
  return (
    <div className="space-y-3">
      <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">🚑 My missions</h1>
      {q.isLoading && <><Skeleton className="h-28" /><Skeleton className="h-28" /></>}
      {q.isError && <ErrorState message="Could not load missions." onRetry={() => void q.refetch()} />}
      {q.data && q.data.items.length === 0 && <EmptyState title="No missions assigned" hint="New incidents from the command center will appear here instantly." />}
      <div className="space-y-3">
        {(q.data?.items ?? []).map((a) => (
          <Card key={a.id}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-bold">{a.request.emergencyType} · {a.request.peopleAffected} people</p>
                <p className="truncate text-sm text-slate-500">📍 {a.request.location}</p>
                <p className="mt-0.5 text-xs text-slate-400">Assigned {new Date(a.assignedAt).toLocaleString()}</p>
              </div>
              <AssignmentChip assignment={a} />
            </div>
            <div className="mt-3">
              <Link to={`/missions/${a.id}`}><Button size="sm">Open mission →</Button></Link>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
