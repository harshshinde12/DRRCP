import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button, Card, CardTitle, DataTable, EmptyState, EnumBadge, ErrorState, Field, Input, Modal, Select, Textarea, formatApiError, useToast, type Column } from '../../components/ui.tsx';
import { useMeta } from '../../lib/meta.tsx';
import { apiSend } from '../../lib/api-client.ts';
import { useAuditLogs, useDisasters, useUsers } from '../../lib/queries.ts';
import { useQueryClient } from '@tanstack/react-query';
import type { AuditEntry, Disaster, User } from '../../lib/types.ts';

/* ---------- Broadcast ---------- */
const alertSchema = z.object({ message: z.string().min(5, 'At least 5 characters').max(1000), type: z.string().optional(), roles: z.array(z.string()).optional() });

export function BroadcastCard() {
  const { push } = useToast();
  const { options } = useMeta();
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<z.infer<typeof alertSchema>>({
    resolver: zodResolver(alertSchema), defaultValues: { message: '', type: 'PUBLIC_ALERT' },
  });
  async function onSubmit(data: z.infer<typeof alertSchema>) {
    setServerError(null);
    try {
      await apiSend('post', '/alerts/broadcast', { message: data.message, type: data.type ?? 'PUBLIC_ALERT' });
      push('success', 'Alert published to all users.');
      reset();
    } catch (err) { setServerError(formatApiError(err)); }
  }
  return (
    <Card>
      <CardTitle>📢 Publish public alert</CardTitle>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        <Field label="Message" error={errors.message?.message}><Textarea rows={3} placeholder="Heavy rainfall warning for Zone 1 tonight…" {...register('message')} /></Field>
        <Field label="Type">
          <Select {...register('type')}>{options('notificationTypes').map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</Select>
        </Field>
        {serverError && <p role="alert" className="text-sm text-red-600">{serverError}</p>}
        <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Publishing…' : 'Publish alert'}</Button>
      </form>
    </Card>
  );
}

export default function Alerts() {
  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">📢 Alerts</h1>
      <BroadcastCard />
      <Card><p className="text-sm text-slate-500">Broadcasts land in every selected user's notification inbox instantly (in-app, Release 1.0).</p></Card>
    </div>
  );
}

/* ---------- Users ---------- */
const userCols: Column<User>[] = [
  { key: 'name', header: 'User', render: (u) => <span><strong>{u.name}</strong><br /><span className="text-xs text-slate-500">{u.email}</span></span>, sortValue: (u) => u.name },
  { key: 'role', header: 'Role', render: (u) => <EnumBadge group="roles" value={u.role} /> },
  { key: 'phone', header: 'Phone', render: (u) => <span className="text-xs">{u.phone ?? '—'}</span> },
];

const provisionSchema = z.object({
  name: z.string().min(2).max(100), email: z.string().email(), password: z.string().min(8).max(128),
  role: z.string().min(1),
  teamName: z.string().optional(), teamType: z.string().optional(), memberCount: z.coerce.number().int().min(1).optional(),
  capability: z.string().optional(), currentLocation: z.string().optional(),
});

export function Users() {
  const { push } = useToast();
  const { options } = useMeta();
  const qc = useQueryClient();
  const [role, setRole] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [show, setShow] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const q = useUsers({ role: role || undefined, search: search || undefined, page, limit: 15 });
  const { register, handleSubmit, watch, reset, formState: { errors, isSubmitting } } = useForm<z.infer<typeof provisionSchema>>({
    resolver: zodResolver(provisionSchema), defaultValues: { name: '', email: '', password: '', role: 'RESCUE_TEAM' },
  });
  const pickedRole = watch('role');

  async function onSubmit(data: z.infer<typeof provisionSchema>) {
    setServerError(null);
    try {
      const body: Record<string, unknown> = { name: data.name, email: data.email, password: data.password, role: data.role };
      if (data.role === 'RESCUE_TEAM') {
        body.team = { name: data.teamName, teamType: data.teamType, memberCount: data.memberCount, capability: data.capability, currentLocation: data.currentLocation };
      }
      await apiSend('post', '/admin/users', body);
      push('success', `${data.email} provisioned as ${data.role}.`);
      reset(); setShow(false);
      void qc.invalidateQueries({ queryKey: ['users'] });
    } catch (err) { setServerError(formatApiError(err)); }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">👥 Users</h1>
        <Button onClick={() => setShow(true)}>+ Provision account</Button>
      </div>
      <Card>
        <div className="flex flex-wrap gap-2">
          <Select aria-label="Role filter" value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }} className="w-auto">
            <option value="">All roles</option>
            {options('roles').map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
          <Input placeholder="Search name / email…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="min-w-40 flex-1" aria-label="Search users" />
        </div>
      </Card>
      {q.isError && <ErrorState message="Could not load users." onRetry={() => void q.refetch()} />}
      {q.data && <DataTable rows={q.data.items} columns={userCols} meta={q.data.meta} page={page} onPage={setPage} emptyTitle="No users found" />}
      <Modal open={show} onClose={() => setShow(false)} title="Provision account (admin)" wide>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name" error={errors.name?.message}><Input {...register('name')} /></Field>
            <Field label="Role" error={errors.role?.message}>
              <Select {...register('role')}>{options('roles').map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select>
            </Field>
            <Field label="Email" error={errors.email?.message}><Input type="email" {...register('email')} /></Field>
            <Field label="Password" error={errors.password?.message}><Input type="password" autoComplete="new-password" {...register('password')} /></Field>
          </div>
          {pickedRole === 'RESCUE_TEAM' && (
            <div className="grid gap-3 rounded-lg bg-slate-50 p-3 dark:bg-slate-800 sm:grid-cols-2">
              <Field label="Team name"><Input {...register('teamName')} /></Field>
              <Field label="Team type"><Input placeholder="FLOOD_RESCUE" {...register('teamType')} /></Field>
              <Field label="Members"><Input type="number" {...register('memberCount')} /></Field>
              <Field label="Base location"><Input {...register('currentLocation')} /></Field>
              <div className="sm:col-span-2"><Field label="Capabilities"><Input placeholder="BOAT_RESCUE, FIRST_AID" {...register('capability')} /></Field></div>
            </div>
          )}
          {serverError && <p role="alert" className="text-sm text-red-600">{serverError}</p>}
          <Button type="submit" disabled={isSubmitting} className="w-full">{isSubmitting ? 'Provisioning…' : 'Provision'}</Button>
        </form>
      </Modal>
    </div>
  );
}

/* ---------- Disasters ---------- */
const disasterSchema = z.object({
  name: z.string().min(2).max(200), type: z.string().min(2).max(50),
  affectedArea: z.string().min(2).max(500),
  severity: z.string().min(1), status: z.string().optional(),
  startDate: z.string().min(1),
});

export function Disasters() {
  const { push } = useToast();
  const { options } = useMeta();
  const qc = useQueryClient();
  const [show, setShow] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const q = useDisasters({ limit: 50 });
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<z.infer<typeof disasterSchema>>({
    resolver: zodResolver(disasterSchema), defaultValues: { name: '', type: 'FLOOD', affectedArea: '', severity: 'SEVERE', status: 'ACTIVE', startDate: new Date().toISOString().slice(0, 16) },
  });

  async function onSubmit(data: z.infer<typeof disasterSchema>) {
    setServerError(null);
    try {
      await apiSend('post', '/disasters', { ...data, startDate: new Date(data.startDate).toISOString() });
      push('success', 'Disaster event created.');
      reset(); setShow(false);
      void qc.invalidateQueries({ queryKey: ['disasters'] });
    } catch (err) { setServerError(formatApiError(err)); }
  }
  async function act(id: string, kind: 'activate' | 'close') {
    try {
      await apiSend('post', `/disasters/${id}/${kind}`);
      push('success', kind === 'activate' ? 'Disaster activated (others → monitoring).' : 'Disaster closed.');
      void qc.invalidateQueries({ queryKey: ['disasters'] });
    } catch (err) { push('error', formatApiError(err)); }
  }

  const cols: Column<Disaster>[] = [
    { key: 'name', header: 'Event', render: (d) => <span><strong>{d.name}</strong><br /><span className="text-xs text-slate-500">{d.type} · {d.affectedArea}</span></span>, sortValue: (d) => d.name },
    { key: 'sev', header: 'Severity', render: (d) => <EnumBadge group="severities" value={d.severity} /> },
    { key: 'status', header: 'Status', render: (d) => <EnumBadge group="disasterStatuses" value={d.status} /> },
    {
      key: 'act', header: 'Actions', render: (d) => (
        <span className="flex gap-1.5">
          {d.status !== 'ACTIVE' && <Button size="sm" variant="secondary" onClick={() => void act(d.id, 'activate')}>Activate</Button>}
          {d.status !== 'RESOLVED' && <Button size="sm" variant="secondary" onClick={() => void act(d.id, 'close')}>Close</Button>}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">🌊 Disaster events</h1>
        <Button onClick={() => setShow(true)}>+ New event</Button>
      </div>
      {q.data && <DataTable rows={q.data.items} columns={cols} meta={q.data.meta} page={1} onPage={() => undefined} emptyTitle="No disaster events" />}
      <Modal open={show} onClose={() => setShow(false)} title="New disaster event">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <Field label="Name" error={errors.name?.message}><Input {...register('name')} placeholder="Mumbai Floods 2026" /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Type" error={errors.type?.message}><Input {...register('type')} /></Field>
            <Field label="Severity"><Select {...register('severity')}>{options('severities').map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select></Field>
          </div>
          <Field label="Affected area" error={errors.affectedArea?.message}><Input {...register('affectedArea')} /></Field>
          <Field label="Start" error={errors.startDate?.message}><Input type="datetime-local" {...register('startDate')} /></Field>
          {serverError && <p role="alert" className="text-sm text-red-600">{serverError}</p>}
          <Button type="submit" disabled={isSubmitting} className="w-full">{isSubmitting ? 'Creating…' : 'Create event'}</Button>
        </form>
      </Modal>
    </div>
  );
}

/* ---------- Audit ---------- */
export function Audit() {
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);
  const q = useAuditLogs({ action: action || undefined, page, limit: 20 });
  const cols: Column<AuditEntry>[] = [
    { key: 'ts', header: 'When', render: (a) => <span className="whitespace-nowrap text-xs">{new Date(a.timestamp).toLocaleString()}</span>, sortValue: (a) => a.timestamp },
    { key: 'act', header: 'Action', render: (a) => <span className="font-mono text-xs font-semibold">{a.action}</span> },
    { key: 'actor', header: 'Actor', render: (a) => <span className="text-xs">{a.actor ? `${a.actor.name} (${a.actor.role})` : '—'}</span> },
    { key: 'target', header: 'Target', render: (a) => <span className="font-mono text-xs">{a.target ?? '—'}{a.targetId ? ` · ${a.targetId.slice(0, 8)}…` : ''}</span> },
  ];
  return (
    <div className="space-y-3">
      <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">🧾 Audit log</h1>
      <Card>
        <Input placeholder="Filter by action (e.g. TEAM_ASSIGN)…" value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }} aria-label="Filter audit log" />
      </Card>
      {q.isError && <ErrorState message="Could not load audit log." onRetry={() => void q.refetch()} />}
      {q.data && (q.data.items.length === 0 ? <EmptyState title="No audit entries" /> : <DataTable rows={q.data.items} columns={cols} meta={q.data.meta} page={page} onPage={setPage} emptyTitle="No audit entries" />)}
    </div>
  );
}
