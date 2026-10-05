import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button, Card, CardTitle, DataTable, EnumBadge, ErrorState, Field, Input, Modal, Select, formatApiError, reportFormError, useToast, type Column } from '../../components/ui.tsx';
import { apiSendOne } from '../../lib/api-client.ts';
import { useAllocations, useInventory, useReliefItems, useResourceRequests, useShortages } from '../../lib/queries.ts';
import { useQueryClient } from '@tanstack/react-query';
import type { Allocation, InventoryRecord, ResourceRequest } from '../../lib/types.ts';

const stockSchema = z.object({ itemId: z.string().min(1), location: z.string().min(1).max(300), quantityAvailable: z.coerce.number().int().min(0) });
const allocSchema = z.object({ resourceRequestId: z.string().min(1), inventoryId: z.string().min(1), quantity: z.coerce.number().int().min(1) });

const reqCols: Column<ResourceRequest>[] = [
  { key: 'item', header: 'Field need', render: (r) => <span><strong>{r.item.itemName}</strong> × {r.quantityRequired - r.quantityFulfilled}<br /><span className="text-xs text-slate-500">{r.shelter?.name ?? '—'} · {r.priority}</span></span> },
  { key: 'status', header: 'Status', render: (r) => <EnumBadge group="resourceRequestStatuses" value={r.status} /> },
  { key: 'act', header: 'Actions', render: (r) => <ApproveButtons r={r} /> },
];

function ApproveButtons({ r }: { r: ResourceRequest }) {
  const { push } = useToast();
  const qc = useQueryClient();
  async function decide(kind: 'approve' | 'reject') {
    try {
      await apiSendOne('post', `/resource-requests/${r.id}/${kind}`, 'resourceRequest');
      push('success', `Request ${kind}d.`);
      void qc.invalidateQueries({ queryKey: ['resource-requests'] });
    } catch (err) { push('error', formatApiError(err)); }
  }
  if (r.status !== 'PENDING') return <span className="text-xs text-slate-400">fulfilled {r.quantityFulfilled}/{r.quantityRequired}</span>;
  return <span className="flex gap-1.5"><Button size="sm" onClick={() => void decide('approve')}>Approve</Button><Button size="sm" variant="danger" onClick={() => void decide('reject')}>Reject</Button></span>;
}

const invCols: Column<InventoryRecord>[] = [
  { key: 'item', header: 'Stock', render: (r) => <span><strong>{r.item.itemName}</strong> · {r.quantityAvailable} {r.item.unit}<br /><span className="text-xs text-slate-500">{r.location} · {r.organization ?? '—'}</span></span>, sortValue: (r) => r.quantityAvailable },
];
const allocCols: Column<Allocation>[] = [
  { key: 'what', header: 'Allocation', render: (a) => <span><strong>{a.resourceRequest?.item.itemName}</strong> × {a.quantity}<br /><span className="text-xs text-slate-500">→ {a.resourceRequest?.shelter?.name ?? 'field'}</span></span> },
  { key: 'status', header: 'Status', render: (a) => <EnumBadge group="allocationStatuses" value={a.status} /> },
];

export function NgoInventory() {
  const { push } = useToast();
  const qc = useQueryClient();
  const [showStock, setShowStock] = useState(false);
  // F-04: real pagination state (was page={1} dead controls).
  const [page, setPage] = useState(1);
  const inv = useInventory({ page, limit: 15 });
  const items = useReliefItems({ limit: 100 });
  const { register, handleSubmit, reset, setError, formState: { errors, isSubmitting } } = useForm<z.infer<typeof stockSchema>>({ resolver: zodResolver(stockSchema) });

  async function onSubmit(data: z.infer<typeof stockSchema>) {
    try {
      await apiSendOne('post', '/inventory', 'inventory', data);
      push('success', 'Stock registered.');
      reset(); setShowStock(false);
      void qc.invalidateQueries({ queryKey: ['inventory'] });
    } catch (err) { reportFormError(err, { setError: setError as never, push }); }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">📦 Inventory</h1>
        <Button onClick={() => setShowStock(true)}>+ Register stock</Button>
      </div>
      {inv.isError && <ErrorState message="Could not load inventory." onRetry={() => void inv.refetch()} />}
      {inv.data && <DataTable rows={inv.data.items} columns={invCols} meta={inv.data.meta} page={page} onPage={setPage} emptyTitle="No stock registered" />}
      <Modal open={showStock} onClose={() => setShowStock(false)} title="Register stock">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <Field label="Item" error={errors.itemId?.message}>
            <Select {...register('itemId')}>
              <option value="">Pick…</option>
              {(items.data?.items ?? []).map((i) => <option key={i.id} value={i.id}>{i.itemName} ({i.unit})</option>)}
            </Select>
          </Field>
          <Field label="Location" error={errors.location?.message}><Input {...register('location')} /></Field>
          <Field label="Quantity" error={errors.quantityAvailable?.message}><Input type="number" {...register('quantityAvailable')} /></Field>
          <Button type="submit" disabled={isSubmitting} className="w-full">{isSubmitting ? 'Saving…' : 'Save stock'}</Button>
        </form>
      </Modal>
    </div>
  );
}

export function NgoAllocations() {
  const { push } = useToast();
  const qc = useQueryClient();
  const [show, setShow] = useState(false);
  // F-04: real pagination state.
  const [page, setPage] = useState(1);
  const allocs = useAllocations({ page, limit: 15 });
  const reqs = useResourceRequests({ limit: 100 });
  const inv = useInventory({ limit: 100 });
  const { register, handleSubmit, reset, setError, formState: { errors, isSubmitting } } = useForm<z.infer<typeof allocSchema>>({ resolver: zodResolver(allocSchema) });

  async function onSubmit(data: z.infer<typeof allocSchema>) {
    try {
      await apiSendOne('post', '/allocations', 'allocation', data);
      push('success', 'Stock allocated.');
      reset(); setShow(false);
      void qc.invalidateQueries({ queryKey: ['allocations'] });
      void qc.invalidateQueries({ queryKey: ['resource-requests'] });
      void qc.invalidateQueries({ queryKey: ['inventory'] });
    } catch (err) { reportFormError(err, { setError: setError as never, push }); }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">🚚 Allocations</h1>
        <Button onClick={() => setShow(true)}>Allocate →</Button>
      </div>
      {allocs.isError && <ErrorState message="Could not load allocations." onRetry={() => void allocs.refetch()} />}
      {allocs.data && <DataTable rows={allocs.data.items} columns={allocCols} meta={allocs.data.meta} page={page} onPage={setPage} emptyTitle="Nothing allocated yet" />}
      <Modal open={show} onClose={() => setShow(false)} title="Allocate stock">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <Field label="Approved request" error={errors.resourceRequestId?.message}>
            <Select {...register('resourceRequestId')}>
              <option value="">Pick…</option>
              {(reqs.data?.items ?? []).filter((r) => ['APPROVED', 'PARTIALLY_FULFILLED'].includes(r.status)).map((r) => (
                <option key={r.id} value={r.id}>{r.item.itemName} × {r.quantityRequired - r.quantityFulfilled} → {r.shelter?.name ?? 'field'}</option>
              ))}
            </Select>
          </Field>
          <Field label="From inventory" error={errors.inventoryId?.message}>
            <Select {...register('inventoryId')}>
              <option value="">Pick…</option>
              {(inv.data?.items ?? []).map((s) => <option key={s.id} value={s.id}>{s.item.itemName} · {s.quantityAvailable} @ {s.location}</option>)}
            </Select>
          </Field>
          <Field label="Quantity" error={errors.quantity?.message}><Input type="number" {...register('quantity')} /></Field>
          <Button type="submit" disabled={isSubmitting} className="w-full">{isSubmitting ? 'Allocating…' : 'Allocate (atomic)'}</Button>
        </form>
      </Modal>
    </div>
  );
}

export function NgoFieldRequests() {
  // F-04: real pagination state.
  const [page, setPage] = useState(1);
  const reqs = useResourceRequests({ page, limit: 15 });
  const shortages = useShortages();
  return (
    <div className="space-y-3">
      <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">📥 Field requests</h1>
      {(shortages.data ?? []).length > 0 && (
        <Card>
          <CardTitle>⚠️ Shortages</CardTitle>
          <ul className="space-y-1 text-sm">
            {shortages.data!.map((s) => <li key={s.itemId}>🔴 <strong>{s.itemName}</strong>: short by {s.shortage} {s.unit}</li>)}
          </ul>
        </Card>
      )}
      {reqs.data && <DataTable rows={reqs.data.items} columns={reqCols} meta={reqs.data.meta} page={page} onPage={setPage} emptyTitle="No field requests" />}
    </div>
  );
}
