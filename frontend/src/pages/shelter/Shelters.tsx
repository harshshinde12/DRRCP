import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button, Card, CardTitle, DataTable, EmptyState, EnumBadge, ErrorState, Field, Input, Modal, Select, formatApiError, useToast, type Column } from '../../components/ui.tsx';
import { useAuth } from '../../lib/auth.tsx';
import { useMeta } from '../../lib/meta.tsx';
import { apiSend } from '../../lib/api-client.ts';
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
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ReqInput>({ resolver: zodResolver(reqSchema), defaultValues: { shelterId: shelters[0]?.id ?? '', priority: 'MEDIUM' } });
  const mut = useMutation({
    mutationFn: (body: ReqInput) => apiSend<ResourceRequest>('post', '/resource-requests', body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['resource-requests'] }),
  });
  async function onSubmit(data: ReqInput) {
    setServerError(null);
    try { await mut.mutateAsync(data); push('success', 'Resource request raised.'); onDone(); }
    catch (err) { setServerError(formatApiError(err)); }
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

export function ShelterManagerHome() {
  const { user } = useAuth();
  const [editing, setEditing] = useState<Shelter | null>(null);
  const [occ, setOcc] = useState(0);
  const [raise, setRaise] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const qc = useQueryClient();
  const { push } = useToast();
  const q = useShelters({ limit: 50 });
  const mine = (q.data?.items ?? []).filter((s) => s.managerId === user?.id);

  async function saveOccupancy() {
    if (!editing) return;
    setError(null);
    try {
      await apiSend('patch', `/shelters/${editing.id}`, { currentOccupancy: occ });
      push('success', 'Occupancy updated.');
      setEditing(null);
      void qc.invalidateQueries({ queryKey: ['shelters'] });
    } catch (err) { setError(formatApiError(err)); }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">🏠 My shelters</h1>
        <Button onClick={() => setRaise(true)}>+ Raise resource request</Button>
      </div>
      {q.isError && <ErrorState message="Could not load shelters." onRetry={() => void q.refetch()} />}
      {q.data && mine.length === 0 && <EmptyState title="No shelters assigned yet" hint="Ask an administrator to register a shelter under your account." />}
      <div className="grid gap-3 md:grid-cols-2">
        {mine.map((s) => (
          <Card key={s.id}>
            <div className="flex items-start justify-between gap-2">
              <div><p className="font-bold text-slate-900 dark:text-white">{s.name}</p><p className="text-xs text-slate-500">📍 {s.location} · {s.facilities.split(',').join(' · ')}</p></div>
              <EnumBadge group="shelterStatuses" value={s.operatingStatus} />
            </div>
            <Gauge shelter={s} />
            <div className="mt-3 flex items-center gap-2">
              <Button variant="secondary" size="sm" disabled={s.currentOccupancy <= 0} onClick={() => { setEditing(s); setOcc(s.currentOccupancy - 1); setError(null); }}>− Checkout</Button>
              <Button variant="secondary" size="sm" onClick={() => { setEditing(s); setOcc(s.currentOccupancy + 1); setError(null); }}>+ Check-in</Button>
              <span className="text-xs text-slate-400">Quick adjust, then save</span>
            </div>
            {editing?.id === s.id && (
              <div className="mt-2 rounded-lg bg-slate-50 p-2.5 dark:bg-slate-800">
                <p className="text-sm">New occupancy: <strong>{occ}</strong>{occ > s.totalCapacity && <span className="text-red-600"> — exceeds capacity, needs emergency override (contact admin)</span>}</p>
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
    </div>
  );
}

export function ShelterRequests() {
  const q = useResourceRequests({ limit: 50 });
  return (
    <div className="space-y-3">
      <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">📦 My resource requests</h1>
      {q.isError && <ErrorState message="Could not load requests." onRetry={() => void q.refetch()} />}
      {q.data && (q.data.items.length === 0
        ? <EmptyState title="No requests raised" hint="Raise one from My shelters when supplies run low." />
        : <DataTable rows={q.data.items} columns={reqCols} meta={q.data.meta} page={1} onPage={() => undefined} emptyTitle="No requests" />)}
    </div>
  );
}
