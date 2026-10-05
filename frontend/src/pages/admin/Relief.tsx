import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button, Card, CardTitle, DataTable, EnumBadge, ErrorState, Field, Input, Modal, Select, Skeleton, formatApiError, reportFormError, useToast, type Column } from '../../components/ui.tsx';
import { useMeta } from '../../lib/meta.tsx';
import { apiSendOne } from '../../lib/api-client.ts';
import { useAllocations, useInventory, useReliefItems, useResourceRequests, useShortages } from '../../lib/queries.ts';
import type { Allocation, InventoryRecord, ReliefItem, ResourceRequest } from '../../lib/types.ts';

/** F-06: category mirrors the backend enum (was free text). */
const itemSchema = z.object({
  itemName: z.string().min(2).max(200),
  category: z.enum(['FOOD', 'WATER', 'MEDICINE', 'CLOTHING', 'HYGIENE', 'EQUIPMENT']),
  unit: z.string().min(1).max(30),
});
const stockSchema = z.object({ itemId: z.string().min(1), location: z.string().min(1).max(300), quantityAvailable: z.coerce.number().int().min(0) });
const allocSchema = z.object({ resourceRequestId: z.string().min(1), inventoryId: z.string().min(1), quantity: z.coerce.number().int().min(1) });

const itemCols: Column<ReliefItem>[] = [
  { key: 'name', header: 'Item', render: (i) => <strong>{i.itemName}</strong>, sortValue: (i) => i.itemName },
  { key: 'cat', header: 'Category', render: (i) => <span className="text-xs">{i.category}</span> },
  { key: 'unit', header: 'Unit', render: (i) => <span className="text-xs">{i.unit}</span> },
];
const invCols: Column<InventoryRecord>[] = [
  { key: 'item', header: 'Item', render: (r) => <span><strong>{r.item.itemName}</strong><br /><span className="text-xs text-slate-500">{r.location}</span></span>, sortValue: (r) => r.item.itemName },
  { key: 'qty', header: 'Available', render: (r) => <span className={`font-bold ${r.quantityAvailable <= 50 ? 'text-red-600' : ''}`}>{r.quantityAvailable} {r.item.unit}</span>, sortValue: (r) => r.quantityAvailable },
  { key: 'org', header: 'Organization', render: (r) => <span className="text-xs">{r.organization ?? '—'}</span> },
];
const reqCols: Column<ResourceRequest>[] = [
  { key: 'item', header: 'Need', render: (r) => <span><strong>{r.item.itemName}</strong> × {r.quantityRequired - r.quantityFulfilled} <span className="text-xs text-slate-500">(of {r.quantityRequired})</span><br /><span className="text-xs text-slate-500">{r.shelter?.name ?? '—'}</span></span> },
  { key: 'status', header: 'Status', render: (r) => <EnumBadge group="resourceRequestStatuses" value={r.status} /> },
  { key: 'pri', header: 'Priority', render: (r) => <EnumBadge group="priorities" value={r.priority} /> },
];
const allocCols: Column<Allocation>[] = [
  { key: 'what', header: 'Allocation', render: (a) => <span><strong>{a.resourceRequest?.item.itemName}</strong> × {a.quantity}<br /><span className="text-xs text-slate-500">→ {a.resourceRequest?.shelter?.name ?? 'field request'}</span></span> },
  { key: 'status', header: 'Status', render: (a) => <EnumBadge group="allocationStatuses" value={a.status} /> },
  { key: 'by', header: 'By', render: (a) => <span className="text-xs">{a.allocatedBy?.name ?? '—'}</span> },
];

function useInvalidateAll() {
  const qc = useQueryClient();
  // F-08: stock moves feed dashboard counts, shortage math and the audit trail.
  return () => { void qc.invalidateQueries({ queryKey: ['relief-items'] }); void qc.invalidateQueries({ queryKey: ['inventory'] }); void qc.invalidateQueries({ queryKey: ['resource-requests'] }); void qc.invalidateQueries({ queryKey: ['allocations'] }); void qc.invalidateQueries({ queryKey: ['shortages'] }); void qc.invalidateQueries({ queryKey: ['dashboard'] }); void qc.invalidateQueries({ queryKey: ['audit-logs'] }); };
}

export default function Relief() {
  const { push } = useToast();
  const { options } = useMeta();
  const invalidateAll = useInvalidateAll();
  const [modal, setModal] = useState<'item' | 'stock' | 'alloc' | null>(null);
  // F-04: real pagination state (was page={1} dead controls).
  const [itemPage, setItemPage] = useState(1);
  const [invPage, setInvPage] = useState(1);
  const [reqPage, setReqPage] = useState(1);
  const [allocPage, setAllocPage] = useState(1);
  const items = useReliefItems({ page: itemPage, limit: 15 });
  const inv = useInventory({ page: invPage, limit: 15 });
  const reqs = useResourceRequests({ page: reqPage, limit: 15 });
  const allocs = useAllocations({ page: allocPage, limit: 15 });
  const shortages = useShortages();

  const itemForm = useForm<z.infer<typeof itemSchema>>({ resolver: zodResolver(itemSchema) });
  const stockForm = useForm<z.infer<typeof stockSchema>>({ resolver: zodResolver(stockSchema) });
  const allocForm = useForm<z.infer<typeof allocSchema>>({ resolver: zodResolver(allocSchema) });

  async function submitItem(data: z.infer<typeof itemSchema>) {
    try { await apiSendOne('post', '/relief-items', 'item', data); push('success', 'Relief item registered.'); invalidateAll(); setModal(null); itemForm.reset(); }
    catch (err) { reportFormError(err, { setError: itemForm.setError as never, push }); }
  }
  async function submitStock(data: z.infer<typeof stockSchema>) {
    try { await apiSendOne('post', '/inventory', 'inventory', data); push('success', 'Stock registered.'); invalidateAll(); setModal(null); stockForm.reset(); }
    catch (err) { reportFormError(err, { setError: stockForm.setError as never, push }); }
  }
  async function submitAlloc(data: z.infer<typeof allocSchema>) {
    try { await apiSendOne('post', '/allocations', 'allocation', data); push('success', 'Stock allocated.'); invalidateAll(); setModal(null); allocForm.reset(); }
    catch (err) { reportFormError(err, { setError: allocForm.setError as never, push }); }
  }
  async function decide(id: string, kind: 'approve' | 'reject') {
    try { await apiSendOne('post', `/resource-requests/${id}/${kind}`, 'resourceRequest'); push('success', `Request ${kind}d.`); invalidateAll(); }
    catch (err) { push('error', formatApiError(err)); }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">📦 Relief & stock</h1>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => setModal('item')}>+ Item</Button>
          <Button variant="secondary" size="sm" onClick={() => setModal('stock')}>+ Stock</Button>
          <Button size="sm" onClick={() => setModal('alloc')}>Allocate →</Button>
        </div>
      </div>

      {(shortages.data ?? []).length > 0 && (
        <Card>
          <CardTitle>⚠️ Shortages (demand above stock)</CardTitle>
          <ul className="space-y-1 text-sm">
            {shortages.data!.map((s) => <li key={s.itemId}>🔴 <strong>{s.itemName}</strong>: short by {s.shortage} {s.unit} (need {s.required - s.fulfilled}, have {s.available})</li>)}
          </ul>
        </Card>
      )}

      <Card>
        <CardTitle right={<span className="text-xs font-normal text-slate-400">approve first, then allocate</span>}>Field resource requests</CardTitle>
        {reqs.isLoading && <Skeleton className="h-32" />}
        {reqs.isError && <ErrorState message="Could not load requests." onRetry={() => void reqs.refetch()} />}
        {reqs.data && (
          <DataTable
            rows={reqs.data.items}
            columns={[...reqCols, { key: 'act', header: 'Actions', render: (r) => r.status === 'PENDING' ? (
              <span className="flex gap-1.5"><Button size="sm" onClick={() => void decide(r.id, 'approve')}>Approve</Button><Button size="sm" variant="danger" onClick={() => void decide(r.id, 'reject')}>Reject</Button></span>
            ) : <span className="text-xs text-slate-400">fulfilled {r.quantityFulfilled}/{r.quantityRequired}</span> }]}
            meta={reqs.data.meta} page={reqPage} onPage={setReqPage} emptyTitle="No field requests"
          />
        )}
      </Card>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardTitle>Inventory</CardTitle>
          {inv.isLoading && <Skeleton className="h-32" />}
          {inv.isError && <ErrorState message="Could not load inventory." onRetry={() => void inv.refetch()} />}
          {inv.data && <DataTable rows={inv.data.items} columns={invCols} meta={inv.data.meta} page={invPage} onPage={setInvPage} emptyTitle="No stock yet" />}
        </Card>
        <Card>
          <CardTitle>Allocation history</CardTitle>
          {allocs.isLoading && <Skeleton className="h-32" />}
          {allocs.isError && <ErrorState message="Could not load allocations." onRetry={() => void allocs.refetch()} />}
          {allocs.data && <DataTable rows={allocs.data.items} columns={allocCols} meta={allocs.data.meta} page={allocPage} onPage={setAllocPage} emptyTitle="Nothing allocated yet" />}
        </Card>
      </div>

      <Card>
        <CardTitle>Catalogue</CardTitle>
        {items.isLoading && <Skeleton className="h-32" />}
        {items.isError && <ErrorState message="Could not load the catalogue." onRetry={() => void items.refetch()} />}
        {items.data && <DataTable rows={items.data.items} columns={itemCols} meta={items.data.meta} page={itemPage} onPage={setItemPage} emptyTitle="No items" />}
      </Card>

      <Modal open={modal === 'item'} onClose={() => setModal(null)} title="Register relief item">
        <form onSubmit={itemForm.handleSubmit(submitItem)} className="space-y-3">
          <Field label="Item name" error={itemForm.formState.errors.itemName?.message}><Input {...itemForm.register('itemName')} /></Field>
          {/* F-07: values from /api/meta (rendered raw to preserve catalogue text). */}
          <Field label="Category" error={itemForm.formState.errors.category?.message}><Select {...itemForm.register('category')}>{options('itemCategories').map((c) => <option key={c.value} value={c.value}>{c.value}</option>)}</Select></Field>
          <Field label="Unit" error={itemForm.formState.errors.unit?.message}><Input placeholder="kg, litres, kits…" {...itemForm.register('unit')} /></Field>
          <Button type="submit" className="w-full">Save item</Button>
        </form>
      </Modal>

      <Modal open={modal === 'stock'} onClose={() => setModal(null)} title="Register stock">
        <form onSubmit={stockForm.handleSubmit(submitStock)} className="space-y-3">
          <Field label="Item" error={stockForm.formState.errors.itemId?.message}>
            <Select {...stockForm.register('itemId')}>
              <option value="">Pick…</option>
              {(items.data?.items ?? []).map((i) => <option key={i.id} value={i.id}>{i.itemName} ({i.unit})</option>)}
            </Select>
          </Field>
          <Field label="Location" error={stockForm.formState.errors.location?.message}><Input {...stockForm.register('location')} /></Field>
          <Field label="Quantity" error={stockForm.formState.errors.quantityAvailable?.message}><Input type="number" {...stockForm.register('quantityAvailable')} /></Field>
          <Button type="submit" className="w-full">Save stock</Button>
        </form>
      </Modal>

      <Modal open={modal === 'alloc'} onClose={() => setModal(null)} title="Allocate stock">
        <form onSubmit={allocForm.handleSubmit(submitAlloc)} className="space-y-3">
          <Field label="Approved request" error={allocForm.formState.errors.resourceRequestId?.message}>
            <Select {...allocForm.register('resourceRequestId')}>
              <option value="">Pick…</option>
              {(reqs.data?.items ?? []).filter((r) => ['APPROVED', 'PARTIALLY_FULFILLED'].includes(r.status)).map((r) => (
                <option key={r.id} value={r.id}>{r.item.itemName} × {r.quantityRequired - r.quantityFulfilled} → {r.shelter?.name ?? 'field'}</option>
              ))}
            </Select>
          </Field>
          <Field label="From inventory" error={allocForm.formState.errors.inventoryId?.message}>
            <Select {...allocForm.register('inventoryId')}>
              <option value="">Pick…</option>
              {(inv.data?.items ?? []).map((s) => <option key={s.id} value={s.id}>{s.item.itemName} · {s.quantityAvailable} @ {s.location}</option>)}
            </Select>
          </Field>
          <Field label="Quantity" error={allocForm.formState.errors.quantity?.message}><Input type="number" {...allocForm.register('quantity')} /></Field>
          <Button type="submit" className="w-full">Allocate (atomic)</Button>
        </form>
      </Modal>
    </div>
  );
}
