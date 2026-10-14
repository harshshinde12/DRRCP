import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button, Card, CardTitle, DataTable, EnumBadge, ErrorState, Field, Input, Modal, Select, formatApiError, reportFormError, useToast, type Column } from '../../components/ui.tsx';
import { useMeta } from '../../lib/meta.tsx';
import { apiSendOne } from '../../lib/api-client.ts';
import { useAssignments, useMarkTeamAvailable, useTeams } from '../../lib/queries.ts';
import type { RescueAssignment, RescueTeamLite } from '../../lib/types.ts';

/** F-06: blank lat/lng inputs are omitted (never 0,0) — mirrors backend optional coords. */
const optionalCoord = (min: number, max: number) =>
  z.preprocess((v) => (v === '' || v == null ? undefined : v), z.coerce.number().min(min).max(max).optional()) as unknown as z.ZodOptional<z.ZodNumber>;

const teamSchema = z.object({
  name: z.string().min(2).max(100),
  teamType: z.string().min(2).max(50),
  memberCount: z.coerce.number().int().min(1).max(1000),
  capability: z.string().min(1).max(500),
  currentLocation: z.string().min(1).max(300),
  latitude: optionalCoord(-90, 90),
  longitude: optionalCoord(-180, 180),
});
type TeamInput = z.infer<typeof teamSchema>;

const columns: Column<RescueTeamLite>[] = [
  { key: 'name', header: 'Team', render: (t) => <span><strong>{t.name}</strong><br /><span className="text-xs text-slate-500">{t.teamType} · {t.memberCount} members</span></span>, sortValue: (t) => t.name },
  { key: 'cap', header: 'Capability', render: (t) => <span className="text-xs">{t.capability.split(',').join(' · ')}</span> },
  { key: 'loc', header: 'Location', render: (t) => <span className="text-xs">{t.currentLocation}</span> },
  { key: 'status', header: 'Availability', render: (t) => <EnumBadge group="teamAvailability" value={t.availabilityStatus} />, sortValue: (t) => t.availabilityStatus },
  { key: 'login', header: 'Login', render: (t) => <span className="text-xs text-slate-500">{t.user?.email ?? '—'}</span> },
];

function TeamForm({ onDone }: { onDone: () => void }) {
  const { push } = useToast();
  const qc = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<TeamInput>({ resolver: zodResolver(teamSchema) });
  const mut = useMutation({
    mutationFn: (body: TeamInput) => apiSendOne<RescueTeamLite>('post', '/teams', 'team', body),
    // F-08: registration moves the board, dashboard and audit.
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['teams'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); qc.invalidateQueries({ queryKey: ['audit-logs'] }); },
  });
  async function onSubmit(data: TeamInput) {
    setServerError(null);
    try { await mut.mutateAsync(data); push('success', 'Rescue team registered.'); onDone(); }
    catch (err) { reportFormError(err, { setError: setError as never, setServerError, push }); }
  }
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Team name" error={errors.name?.message}><Input {...register('name')} /></Field>
        <Field label="Type (e.g. FLOOD_RESCUE)" error={errors.teamType?.message}><Input {...register('teamType')} /></Field>
        <Field label="Members" error={errors.memberCount?.message}><Input type="number" {...register('memberCount')} /></Field>
        <Field label="Base location" error={errors.currentLocation?.message}><Input {...register('currentLocation')} /></Field>
        <Field label="Latitude (opt)" error={errors.latitude?.message}><Input type="number" step="any" placeholder="e.g. 19.076" {...register('latitude')} /></Field>
        <Field label="Longitude (opt)" error={errors.longitude?.message}><Input type="number" step="any" placeholder="e.g. 72.8777" {...register('longitude')} /></Field>
      </div>
      <Field label="Capabilities (comma separated)" error={errors.capability?.message}><Input placeholder="BOAT_RESCUE, FIRST_AID" {...register('capability')} /></Field>
      {serverError && <p role="alert" className="text-sm text-red-600">{serverError}</p>}
      <Button type="submit" disabled={isSubmitting} className="w-full">{isSubmitting ? 'Registering…' : 'Register team'}</Button>
    </form>
  );
}

export default function Teams() {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const { options } = useMeta();
  const { push } = useToast();
  const q = useTeams({ availabilityStatus: status || undefined, page, limit: 15 });
  const markAvailable = useMarkTeamAvailable();

  async function doMarkAvailable(id: string, name: string) {
    try {
      await markAvailable.mutateAsync(id);
      push('success', `${name} is AVAILABLE again.`);
    } catch (err) {
      // 409 when the team still holds active assignments — surfaced verbatim.
      push('error', formatApiError(err));
    }
  }

  const cols: Column<RescueTeamLite>[] = [
    ...columns,
    {
      key: 'act', header: 'Actions', render: (t) => t.availabilityStatus === 'AVAILABLE'
        ? <span className="text-xs text-slate-400">Ready</span>
        : <Button variant="secondary" size="sm" disabled={markAvailable.isPending} onClick={() => void doMarkAvailable(t.id, t.name)}>Mark available</Button>,
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">🚑 Rescue teams</h1>
        <Button onClick={() => setShowForm(true)}>+ Register team</Button>
      </div>
      <Card>
        <Select aria-label="Availability filter" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="w-auto">
          <option value="">All availability states</option>
          {options('teamAvailability').map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
      </Card>
      {q.isLoading && <p className="text-sm text-slate-400">Loading…</p>}
      {q.isError && <ErrorState message="Could not load teams." onRetry={() => void q.refetch()} />}
      {q.data && <DataTable rows={q.data.items} columns={cols} meta={q.data.meta} page={page} onPage={setPage} emptyTitle="No rescue teams registered" />}
      <Modal open={showForm} onClose={() => setShowForm(false)} title="Register rescue team">
        <TeamForm onDone={() => setShowForm(false)} />
      </Modal>
      <ReportsInbox />
    </div>
  );
}

/**
 * Mission reports inbox — every filed rescue report, generated from the
 * team's submission, in one place for admin review & record. Filing a report
 * also raises an ASSIGNMENT notification (bell + /notifications). Reports open
 * inline in a viewer modal, so reviewing never navigates away from this page.
 */
function ReportsInbox() {
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<RescueAssignment | null>(null);
  const q = useAssignments({ status: 'COMPLETED', page, limit: 10 });

  const reportColumns: Column<RescueAssignment>[] = [
    {
      key: 'mission', header: 'Mission',
      render: (a) => <span><strong>{a.team.name}</strong><br /><span className="text-xs text-slate-500">📍 {a.request.location}</span></span>,
      sortValue: (a) => a.team.name,
    },
    {
      key: 'result', header: 'Result',
      render: (a) => <span className="text-xs">{a.report ? `✓ ${a.report.peopleRescued} rescued · ${a.report.injuredPeople} injured` : <span className="text-slate-400">—</span>}</span>,
    },
    {
      key: 'notes', header: 'Report notes',
      render: (a) => <span className="text-xs text-slate-600 dark:text-slate-300">{a.report?.notes || <span className="text-slate-400">No notes filed</span>}</span>,
    },
    {
      key: 'done', header: 'Completed',
      render: (a) => <span className="whitespace-nowrap text-xs text-slate-500">{a.completedAt ? new Date(a.completedAt).toLocaleString() : '—'}</span>,
      sortValue: (a) => a.completedAt ?? '',
    },
    {
      key: 'review', header: 'Review',
      render: (a) => <Button variant="secondary" size="sm" className="whitespace-nowrap" onClick={() => setSelected(a)}>View report</Button>,
    },
  ];

  return (
    <Card>
      <CardTitle right={<span className="text-xs font-normal text-slate-400">New reports arrive via the 🔔 bell too</span>}>
        📋 Mission reports — review &amp; record
      </CardTitle>
      {q.isLoading && <p className="text-sm text-slate-400">Loading reports…</p>}
      {q.isError && <ErrorState message="Could not load mission reports." onRetry={() => void q.refetch()} />}
      {q.data && (
        <DataTable
          rows={q.data.items}
          columns={reportColumns}
          meta={q.data.meta}
          page={page}
          onPage={setPage}
          emptyTitle="No mission reports filed yet"
        />
      )}
      <Modal open={selected != null} onClose={() => setSelected(null)} title={`📋 Mission report — ${selected?.team.name ?? ''}`}>
        {selected && (
          <div className="space-y-2 text-sm">
            <p><strong>{selected.request.emergencyType}</strong> · {selected.request.peopleAffected} people</p>
            <p className="text-slate-500">📍 {selected.request.location}</p>
            <div className="flex flex-wrap gap-1.5"><EnumBadge group="assignmentStatuses" value={selected.status} /></div>
            {selected.report ? (
              <>
                <p>✓ {selected.report.peopleRescued} rescued · {selected.report.injuredPeople} injured · {new Date(selected.report.completedAt).toLocaleString()}</p>
                {selected.report.notes
                  ? <p className="rounded-lg bg-slate-50 p-2 text-slate-700 dark:bg-slate-800 dark:text-slate-300">“{selected.report.notes}”</p>
                  : <p className="text-slate-400">No notes filed.</p>}
              </>
            ) : (
              <p className="text-slate-500">No report filed yet.</p>
            )}
            <p className="text-xs text-slate-400">Request {selected.requestId} · assignment {selected.id}</p>
            <div className="flex justify-end gap-2 pt-1">
              <Link to={`/admin/requests?focus=${selected.requestId}`} className="link text-xs font-semibold">Open in request queue →</Link>
              <Button variant="secondary" size="sm" onClick={() => setSelected(null)}>Close</Button>
            </div>
          </div>
        )}
      </Modal>
    </Card>
  );
}
