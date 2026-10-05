import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { Link, useParams } from 'react-router-dom';
import { z } from 'zod';
import { AssignmentChip } from '../../components/StatusBits.tsx';
import { Button, Card, CardTitle, EnumBadge, ErrorState, Field, Input, Skeleton, Textarea, formatApiError, useToast } from '../../components/ui.tsx';
import { useMeta } from '../../lib/meta.tsx';
import { useAssignment, useMissionAction, useRequest } from '../../lib/queries.ts';

const reportSchema = z.object({
  peopleRescued: z.coerce.number().int().min(0).max(100000),
  injuredPeople: z.coerce.number().int().min(0).max(100000),
  notes: z.string().max(2000).optional().or(z.literal('')),
});
type ReportInput = z.infer<typeof reportSchema>;

const NEXT: Record<string, Array<{ to: string; label: string; icon: string }>> = {
  ASSIGNED: [],
  ACKNOWLEDGED: [{ to: 'ON_THE_WAY', label: 'On the way', icon: '🚗' }],
  ON_THE_WAY: [{ to: 'RESCUE_IN_PROGRESS', label: 'Start rescue', icon: '🛟' }],
  RESCUE_IN_PROGRESS: [],
};

export default function MissionDetail() {
  const { id } = useParams();
  const { push } = useToast();
  const { label } = useMeta();
  const q = useAssignment(id);
  const act = useMissionAction();
  const reqDetail = useRequest(q.data?.requestId);
  const [supportOpen, setSupportOpen] = useState(false);
  const [supportNotes, setSupportNotes] = useState('');
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ReportInput>({ resolver: zodResolver(reportSchema), defaultValues: { peopleRescued: 0, injuredPeople: 0, notes: '' } });
  const a = q.data;

  async function run(kind: 'acknowledge' | 'status' | 'support', body?: unknown) {
    if (!id) return;
    setServerError(null);
    try {
      await act.mutateAsync({ id, kind, body });
      push('success', kind === 'support' ? 'Support request sent to command.' : 'Mission updated.');
      setSupportOpen(false); setSupportNotes('');
    } catch (err) { setServerError(formatApiError(err)); }
  }

  async function report(data: ReportInput) {
    if (!id) return;
    setServerError(null);
    try {
      await act.mutateAsync({ id, kind: 'report', body: data });
      push('success', 'Report filed — mission complete, request resolved.');
    } catch (err) { setServerError(formatApiError(err)); }
  }

  if (q.isLoading) return <Skeleton className="h-64" />;
  if (q.isError || !a) return <ErrorState message="Could not load this mission." onRetry={() => void q.refetch()} />;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link to="/missions" className="link text-sm">← Back to missions</Link>
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h1 className="text-lg font-extrabold">{a.request.emergencyType} · {a.request.peopleAffected} people</h1>
            <p className="text-sm text-slate-500">📍 {a.request.location}</p>
            <p className="mt-1 text-sm">{a.request.description}</p>
            {reqDetail.data?.requester && <p className="mt-1 text-xs text-slate-500">Contact: {reqDetail.data.requester.name}{reqDetail.data.requester.phone ? ` · ${reqDetail.data.requester.phone}` : ''}</p>}
          </div>
          <AssignmentChip assignment={a} />
        </div>

        {serverError && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{serverError}</p>}

        {/* one-tap actions */}
        <div className="mt-4 flex flex-wrap gap-2">
          {a.status === 'ASSIGNED' && (
            <Button disabled={act.isPending} onClick={() => void run('acknowledge')}>✓ Acknowledge mission</Button>
          )}
          {(NEXT[a.status] ?? []).map((n) => (
            <Button key={n.to} disabled={act.isPending} onClick={() => void run('status', { status: n.to })}>{n.icon} {n.label}</Button>
          ))}
          {['ASSIGNED', 'ACKNOWLEDGED', 'ON_THE_WAY', 'RESCUE_IN_PROGRESS'].includes(a.status) && (
            <Button variant="secondary" disabled={act.isPending} onClick={() => setSupportOpen((v) => !v)}>📣 Request support</Button>
          )}
        </div>

        {supportOpen && (
          <div className="mt-3 rounded-xl bg-amber-50 p-3 dark:bg-amber-950">
            <Field label="What do you need? (alerts all admins, mission stays open)" htmlFor="sup">
              <Textarea id="sup" rows={2} value={supportNotes} onChange={(e) => setSupportNotes(e.target.value)} placeholder="Need a second boat, water rising…" />
            </Field>
            <Button size="sm" className="mt-2" disabled={supportNotes.trim().length < 5 || act.isPending} onClick={() => void run('support', { notes: supportNotes.trim() })}>Send support request</Button>
          </div>
        )}
      </Card>

      {a.status === 'RESCUE_IN_PROGRESS' && !a.report && (
        <Card>
          <CardTitle>📝 Rescue report (completes the mission)</CardTitle>
          <form onSubmit={handleSubmit(report)} className="grid gap-3 sm:grid-cols-2">
            <Field label="People rescued" error={errors.peopleRescued?.message} htmlFor="rescued"><Input id="rescued" type="number" {...register('peopleRescued')} /></Field>
            <Field label="Injured encountered" error={errors.injuredPeople?.message} htmlFor="injured"><Input id="injured" type="number" {...register('injuredPeople')} /></Field>
            <div className="sm:col-span-2"><Field label="Mission notes" htmlFor="report-notes"><Textarea id="report-notes" rows={3} {...register('notes')} /></Field></div>
            <div className="sm:col-span-2"><Button type="submit" disabled={isSubmitting} className="w-full">{isSubmitting ? 'Filing…' : '✓ File report & resolve'}</Button></div>
          </form>
        </Card>
      )}

      {a.report && (
        <Card>
          <CardTitle>Filed report</CardTitle>
          <p className="text-sm">✓ {a.report.peopleRescued} rescued · {a.report.injuredPeople} injured · {new Date(a.report.completedAt).toLocaleString()}</p>
          {a.report.notes && <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{a.report.notes}</p>}
          <p className="mt-2 text-sm">Request status: <EnumBadge group="requestStatuses" value={a.request.status} /> <span className="text-slate-500">{label('requestStatuses', a.request.status)}</span></p>
        </Card>
      )}
    </div>
  );
}
