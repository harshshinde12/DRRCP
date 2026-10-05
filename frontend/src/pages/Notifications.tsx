import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button, Card, EmptyState, EnumBadge, ErrorState, Skeleton, formatApiError, useToast } from '../components/ui.tsx';
import { useMeta } from '../lib/meta.tsx';
import { apiSend, apiSendOne } from '../lib/api-client.ts';
import { useNotifications } from '../lib/queries.ts';

export default function Notifications() {
  const { push } = useToast();
  const { options } = useMeta();
  const qc = useQueryClient();
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);
  const q = useNotifications({ type: type || undefined, page, limit: 15 });

  async function markAll() {
    try {
      await apiSend('patch', '/notifications/read-all');
      push('success', 'All notifications marked as read.');
      void qc.invalidateQueries({ queryKey: ['notifications'] });
      void qc.invalidateQueries({ queryKey: ['unread-count'] });
    } catch (err) {
      push('error', formatApiError(err));
    }
  }

  async function markOne(id: string) {
    try {
      await apiSendOne('patch', `/notifications/${id}/read`, 'notification');
      void qc.invalidateQueries({ queryKey: ['notifications'] });
      void qc.invalidateQueries({ queryKey: ['unread-count'] });
    } catch (err) {
      push('error', formatApiError(err));
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">🔔 Notifications</h1>
        <Button variant="secondary" size="sm" onClick={() => void markAll()}>Mark all read</Button>
      </div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by type">
        {['', ...options('notificationTypes').map((o) => o.value)].map((t) => (
          <button key={t || 'ALL'} onClick={() => { setType(t); setPage(1); }} aria-pressed={type === t}
            className={`rounded-full px-3 py-1 text-xs font-semibold ${type === t ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'}`}>
            {t || 'All'}
          </button>
        ))}
      </div>
      {q.isLoading && <><Skeleton className="h-16" /><Skeleton className="h-16" /></>}
      {q.isError && <ErrorState message="Could not load notifications." onRetry={() => void q.refetch()} />}
      {q.data && q.data.items.length === 0 && <EmptyState title="You're all caught up" hint="Request updates, assignments and public alerts will appear here." />}
      <Card>
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {(q.data?.items ?? []).map((n) => (
            <li key={n.id} className={`flex items-start gap-3 py-3 ${n.isRead ? 'opacity-70' : ''}`}>
              <span aria-hidden className="mt-0.5">{n.isRead ? '○' : '●'}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-slate-800 dark:text-slate-200">{n.message}</p>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                  <EnumBadge group="notificationTypes" value={n.type} />
                  {new Date(n.createdAt).toLocaleString()}
                </p>
              </div>
              {!n.isRead && <Button variant="ghost" size="sm" onClick={() => void markOne(n.id)}>Mark read</Button>}
            </li>
          ))}
        </ul>
      </Card>
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
