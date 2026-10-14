import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button, Card, CardTitle, DataTable, EmptyState, EnumBadge, ErrorState, Field, Input, Modal, Select, Skeleton, formatApiError, reportFormError, useToast, type Column } from '../../components/ui.tsx';
import { useAuth } from '../../lib/auth.tsx';
import { useMeta } from '../../lib/meta.tsx';
import { apiSendOne } from '../../lib/api-client.ts';
import { useReliefItems, useResourceRequests, useShelters } from '../../lib/queries.ts';
import type { ResourceRequest, Shelter } from '../../lib/types.ts';

function Gauge({ shelter }: { shelter: Shelter }) {
  const pct = shelter.totalCapacity ? Math.round((shelter.currentOccupancy / shelter.totalCapacity) * 100) : 0;
  const color = pct > 100 ? 'bg-red-600' : pct >= 95 ? 'bg-red-500' : pct >= 75 ? 'bg-amber-500' : 'bg-green-500';
  return (
    <div className="mt-2">
      <div className="flex items-baseline justify-between">
        <p className="text-3xl font-extrabold text-slate-900 dark:text-white">{shelter.currentOccupancy}<span className="text-base font-medium text-slate-400"> / {shelter.totalCapacity}</span></p>
        <p className="text-sm font-semibold text-slate-500">{shelter.availableCapacity} free · {pct}%</p>
      </div>
      <div className="mt-1 h-3 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${shelter.name} occupancy gauge`}>
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
    </div>
  );
}

const reqSchema = z.object({
  shelterId: z.string().min(1, 'Pick a shelter'),
  itemId: z.string().min(1, 'Pick an item'),
  quantityRequired: z.coerce.number().int().min(1, 'At least 1'),
  priority: z.string().optional(),
});
type ReqInput = z.infer<typeof reqSchema>;

function RaiseRequestForm({ shelters, onDone }: { shelters: Shelter[]; onDone: () => void }) {
  const { push } = useToast();
  const { options } = useMeta();
  const qc = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const items = useReliefItems({ limit: 100 });
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<ReqInput>({ resolver: zodResolver(reqSchema), defaultValues: { shelterId: shelters[0]?.id ?? '', priority: 'MEDIUM' } });
  const mut = useMutation({
    mutationFn: (body: ReqInput) => apiSendOne<ResourceRequest>('post', '/resource-requests', 'resourceRequest', body),
    // F-08: a new need moves shortages, dashboard and audit.
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['resource-requests'] }); qc.invalidateQueries({ queryKey: ['shortages'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); qc.invalidateQueries({ queryKey: ['audit-logs'] }); },
  });
  async function onSubmit(data: ReqInput) {
    setServerError(null);
    try { await mut.mutateAsync(data); push('success', 'Resource request raised.'); onDone(); }
    catch (err) { reportFormError(err, { setError: setError as never, setServerError, push }); }
  }
  // I-05: no shelters → the form is unusable; explain instead of a dead submit.
  if (shelters.length === 0) {
    return (
      <div className="space-y-3">
        <EmptyState title="No shelters assigned yet" hint="Ask an administrator to register a shelter under your account before raising a resource request." />
        <Button variant="secondary" onClick={onDone} className="w-full">Close</Button>
      </div>
    );
  }
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Shelter" error={errors.shelterId?.message}>
          <Select {...register('shelterId')}>{shelters.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</Select>
        </Field>
        <Field label="Priority"><Select {...register('priority')}>{options('priorities').map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</Select></Field>
        <Field label="Item" error={errors.itemId?.message}>
          <Select {...register('itemId')}>
            <option value="">Pick…</option>
            {(items.data?.items ?? []).map((i) => <option key={i.id} value={i.id}>{i.itemName} ({i.unit})</option>)}
          </Select>
        </Field>
        <Field label="Quantity needed" error={errors.quantityRequired?.message}><Input type="number" {...register('quantityRequired')} /></Field>
      </div>
      {serverError && <p role="alert" className="text-sm text-red-600">{serverError}</p>}
      <Button type="submit" disabled={isSubmitting} className="w-full">{isSubmitting ? 'Raising…' : 'Raise request'}</Button>
    </form>
  );
}

const reqCols: Column<ResourceRequest>[] = [
  { key: 'item', header: 'Need', render: (r) => <span><strong>{r.item.itemName}</strong> × {r.quantityRequired - r.quantityFulfilled} <span className="text-xs text-slate-500">(fulfilled {r.quantityFulfilled}/{r.quantityRequired})</span></span> },
  { key: 'status', header: 'Status', render: (r) => <EnumBadge group="resourceRequestStatuses" value={r.status} /> },
  { key: 'pri', header: 'Priority', render: (r) => <EnumBadge group="priorities" value={r.priority} /> },
];

const registerSchema = z.object({
  name: z.string().min(2).max(200),
  location: z.string().min(2).max(500),
  totalCapacity: z.coerce.number().int().min(1, 'At least 1 bed').max(100000),
  facilities: z.string().min(1, 'List at least one facility').max(500),
  operatingStatus: z.string().optional(),
});
type RegisterInput = z.infer<typeof registerSchema>;

function RegisterShelterForm({ onDone }: { onDone: () => void }) {
  const { push } = useToast();
  const { options } = useMeta();
  const qc = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema), defaultValues: { operatingStatus: 'OPEN' },
  });
  async function onSubmit(data: RegisterInput) {
    setServerError(null);
    try {
      // Backend assigns the logged-in manager as owner (SHELTER_REGISTER, audited).
      await apiSendOne<Shelter>('post', '/shelters', 'shelter', data);
      push('success', 'Shelter registered — it is now visible to citizens and admins.');
      onDone();
      void qc.invalidateQueries({ queryKey: ['shelters'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
      void qc.invalidateQueries({ queryKey: ['audit-logs'] });
    } catch (err) { reportFormError(err, { setError: setError as never, setServerError, push }); }
  }
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Shelter name" error={errors.name?.message}><Input {...register('name')} placeholder="e.g. Dadar School Shelter" /></Field>
        <Field label="Location" error={errors.location?.message}><Input {...register('location')} placeholder="Area, landmark" /></Field>
        <Field label="Total beds (capacity)" error={errors.totalCapacity?.message}><Input type="number" min={1} {...register('totalCapacity')} /></Field>
        <Field label="Operating status"><Select {...register('operatingStatus')}>{options('shelterStatuses').map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select></Field>
      </div>
      <Field label="Facilities (comma separated)" error={errors.facilities?.message}><Input {...register('facilities')} placeholder="Beds, Water, Medical" /></Field>
      {serverError && <p role="alert" className="text-sm text-red-600">{serverError}</p>}
      <Button type="submit" disabled={isSubmitting} className="w-full">{isSubmitting ? 'Registering…' : 'Register shelter'}</Button>
    </form>
  );
}

export function ShelterManagerHome() {
  const { user } = useAuth();
  const [editing, setEditing] = useState<Shelter | null>(null);
  const [occ, setOcc] = useState(0);
  // I-04: in-flow emergency override (mirrors the team-override modal).
  const [override, setOverride] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideError, setOverrideError] = useState<string | null>(null);
  const [raise, setRaise] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [managing, setManaging] = useState<Shelter | null>(null);
  const [error, setError] = useState<string | null>(null);
  const qc = useQueryClient();
  const { push } = useToast();
  // I-05: server-side manager filter — no 50-row client cap.
  const q = useShelters(user?.id ? { managerId: user.id, limit: 50 } : { limit: 50 });
  const mine = q.data?.items ?? [];

  function beginEdit(s: Shelter, next: number) {
    setEditing(s); setOcc(next); setError(null);
    setOverride(false); setOverrideReason(''); setOverrideError(null);
  }

  async function saveOccupancy() {
    if (!editing) return;
    setError(null); setOverrideError(null);
    const overCapacity = occ > editing.totalCapacity;
    // I-04: over-capacity needs the flag AND a recorded reason (backend audits it).
    if (overCapacity && !override) {
      setError('Occupancy exceeds capacity — tick the emergency override and give a reason.');
      return;
    }
    if (overCapacity && overrideReason.trim().length < 5) {
      setOverrideError('A reason of at least 5 characters is required — it goes into the audit trail.');
      return;
    }
    try {
      await apiSendOne('patch', `/shelters/${editing.id}`, 'shelter', {
        currentOccupancy: occ,
        ...(overCapacity ? { emergencyOverride: true, overrideReason: overrideReason.trim() } : {}),
      });
      push('success', overCapacity ? 'Occupancy updated (override logged).' : 'Occupancy updated.');
      setEditing(null);
      void qc.invalidateQueries({ queryKey: ['shelters'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
      void qc.invalidateQueries({ queryKey: ['audit-logs'] });
    } catch (err) { setError(formatApiError(err)); }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">🏠 My shelters</h1>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setShowRegister(true)}>+ Register shelter</Button>
          <Button variant="secondary" onClick={() => setRaise(true)} disabled={mine.length === 0} title={mine.length === 0 ? 'No shelters assigned yet' : undefined}>+ Raise resource request</Button>
        </div>
      </div>
      {q.isLoading && <><Skeleton className="h-40" /><Skeleton className="h-40" /></>}
      {q.isError && <ErrorState message="Could not load shelters." onRetry={() => void q.refetch()} />}
      {q.data && mine.length === 0 && <EmptyState title="No shelters assigned yet" hint="Ask an administrator to register a shelter under your account. The resource-request form stays disabled until then." />}
      <div className="grid gap-3 md:grid-cols-2">
        {mine.map((s) => (
          <Card key={s.id}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0"><p className="truncate font-bold text-slate-900 dark:text-white">{s.name}</p><p className="truncate text-xs text-slate-500">📍 {s.location} · {s.facilities.split(',').join(' · ')}</p></div>
              <EnumBadge group="shelterStatuses" value={s.operatingStatus} />
            </div>
            <Gauge shelter={s} />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button variant="secondary" size="sm" disabled={s.currentOccupancy <= 0} onClick={() => beginEdit(s, s.currentOccupancy - 1)}>− Checkout</Button>
              <Button variant="secondary" size="sm" onClick={() => beginEdit(s, s.currentOccupancy + 1)}>+ Check-in</Button>
              <Button variant="ghost" size="sm" onClick={() => setManaging(s)} title="Set total beds, status and facilities">⚙ Capacity &amp; details</Button>
              <span className="text-xs text-slate-400">Quick adjust, then save</span>
            </div>
            {editing?.id === s.id && (
              <div className="mt-2 rounded-lg bg-slate-50 p-2.5 dark:bg-slate-800">
                <p className="text-sm">New occupancy: <strong>{occ}</strong>{occ > s.totalCapacity && <span className="text-red-600"> — exceeds capacity ({s.totalCapacity}), emergency override required</span>}</p>
                {/* Bulk adjust: ±1/±5/±10 steps plus an exact-value field — one Save covers the whole batch. */}
                <div className="mt-2 flex flex-wrap items-center gap-1.5" role="group" aria-label="Bulk adjust occupancy">
                  {[10, 5, 1].map((n) => (
                    <Button key={`out-${n}`} variant="secondary" size="sm" disabled={occ <= 0} onClick={() => setOcc((v) => Math.max(0, v - n))} title={`Check out ${n}`}>−{n}</Button>
                  ))}
                  <Input
                    type="number" min={0} value={occ} aria-label="Exact occupancy"
                    onChange={(e) => setOcc(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                    className="w-20 text-center" title="Type the exact occupancy"
                  />
                  {[1, 5, 10].map((n) => (
                    <Button key={`in-${n}`} variant="secondary" size="sm" onClick={() => setOcc((v) => v + n)} title={`Check in ${n}`}>+{n}</Button>
                  ))}
                </div>
                {occ > s.totalCapacity && (
                  <div className="mt-2 space-y-2 rounded-lg bg-red-50 p-2.5 dark:bg-red-950">
                    <label className="flex items-start gap-2 text-sm text-red-800 dark:text-red-200">
                      <input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} className="mt-0.5" aria-label="Emergency override" />
                      Emergency override — occupancy exceeds capacity. This is audited.
                    </label>
                    <Field label="Override reason (mandatory)" error={overrideError ?? undefined} htmlFor={`ovr-${s.id}`}>
                      <Input id={`ovr-${s.id}`} value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} placeholder="e.g. Flood surge at midnight, no alternate beds" />
                    </Field>
                  </div>
                )}
                {error && <p role="alert" className="mt-1 text-xs text-red-600">{error}</p>}
                <div className="mt-2 flex gap-2">
                  <Button size="sm" onClick={() => void saveOccupancy()}>Save</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Discard</Button>
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>
      <Modal open={raise} onClose={() => setRaise(false)} title="Raise resource request">
        <RaiseRequestForm shelters={mine} onDone={() => setRaise(false)} />
      </Modal>
      <Modal open={showRegister} onClose={() => setShowRegister(false)} title="Register shelter">
        <RegisterShelterForm onDone={() => setShowRegister(false)} />
      </Modal>
      <Modal open={managing != null} onClose={() => setManaging(null)} title={managing ? `Capacity & details · ${managing.name}` : 'Capacity & details'}>
        {managing && <CapacityDetailsForm shelter={managing} onDone={() => setManaging(null)} />}
      </Modal>
    </div>
  );
}

/**
 * Shelter-manager-owned capacity editing (primary writer per SRS FR-11):
 * total beds, operating status and facilities. PATCH is audited server-side
 * and alerts admins when the shelter turns critically full — the same endpoint
 * admins use, so either side can correct the numbers.
 */
function CapacityDetailsForm({ shelter, onDone }: { shelter: Shelter; onDone: () => void }) {
  const { push } = useToast();
  const { options } = useMeta();
  const qc = useQueryClient();
  const [capacity, setCapacity] = useState(shelter.totalCapacity);
  const [status, setStatus] = useState(shelter.operatingStatus);
  const [facilities, setFacilities] = useState(shelter.facilities);
  const [override, setOverride] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideError, setOverrideError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    setError(null); setOverrideError(null);
    const beds = Math.floor(Number(capacity) || 0);
    if (beds < 1) { setError('Total capacity must be at least 1 bed.'); return; }
    // Lowering beds below current heads trips the same capacity block as over-occupancy.
    const overCapacity = shelter.currentOccupancy > beds;
    if (overCapacity && !override) {
      setError(`That leaves ${shelter.currentOccupancy} people in ${beds} beds — tick the emergency override and give a reason.`);
      return;
    }
    if (overCapacity && overrideReason.trim().length < 5) {
      setOverrideError('A reason of at least 5 characters is required — it goes into the audit trail.');
      return;
    }
    setSaving(true);
    try {
      await apiSendOne('patch', `/shelters/${shelter.id}`, 'shelter', {
        totalCapacity: beds,
        operatingStatus: status,
        facilities: facilities.trim(),
        ...(overCapacity ? { emergencyOverride: true, overrideReason: overrideReason.trim() } : {}),
      });
      push('success', overCapacity ? 'Capacity updated (override logged, admins alerted).' : 'Shelter details updated.');
      onDone();
      void qc.invalidateQueries({ queryKey: ['shelters'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
      void qc.invalidateQueries({ queryKey: ['audit-logs'] });
    } catch (err) { setError(formatApiError(err)); }
    finally { setSaving(false); }
  }

  const overCapacity = shelter.currentOccupancy > Math.floor(Number(capacity) || 0);
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Total beds (capacity)" error={undefined}>
          <Input type="number" min={1} value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} aria-label="Total capacity" />
        </Field>
        <Field label="Operating status">
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>{options('shelterStatuses').map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select>
        </Field>
      </div>
      <Field label="Facilities (comma separated)">
        <Input value={facilities} onChange={(e) => setFacilities(e.target.value)} placeholder="Beds, Water, Medical" />
      </Field>
      <p className="text-xs text-slate-500">Heads now: <strong>{shelter.currentOccupancy}</strong> · free after save: <strong>{Math.max(0, Math.floor(Number(capacity) || 0) - shelter.currentOccupancy)}</strong>. Admins see the change instantly and are alerted if the shelter turns critically full.</p>
      {overCapacity && (
        <div className="space-y-2 rounded-lg bg-red-50 p-2.5 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
          <label className="flex items-start gap-2">
            <input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} className="mt-0.5" aria-label="Emergency override" />
            Emergency override — capacity below current occupancy. This is audited.
          </label>
          <Field label="Override reason (mandatory)" error={overrideError ?? undefined} htmlFor="mgr-cap-ovr">
            <Input id="mgr-cap-ovr" value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} placeholder="e.g. Hall B closed for repairs, floor space in use" />
          </Field>
        </div>
      )}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <Button onClick={() => void save()} disabled={saving} className="w-full">{saving ? 'Saving…' : 'Save capacity & details'}</Button>
    </div>
  );
}

export function ShelterRequests() {
  // F-04: real pagination state (was page={1} dead controls).
  const [page, setPage] = useState(1);
  const q = useResourceRequests({ page, limit: 15 });
  return (
    <div className="space-y-3">
      <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">📦 My resource requests</h1>
      {q.isLoading && <Skeleton className="h-32" />}
      {q.isError && <ErrorState message="Could not load requests." onRetry={() => void q.refetch()} />}
      {q.data && (q.data.items.length === 0
        ? <EmptyState title="No requests raised" hint="Raise one from My shelters when supplies run low." />
        : <DataTable rows={q.data.items} columns={reqCols} meta={q.data.meta} page={page} onPage={setPage} emptyTitle="No requests" />)}
    </div>
  );
}
