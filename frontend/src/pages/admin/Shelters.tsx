import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Button, Card, CardTitle, DataTable, EnumBadge, ErrorState, Field, Input, Modal, Select, Skeleton, formatApiError, useToast, type Column } from '../../components/ui.tsx';
import { useMeta } from '../../lib/meta.tsx';
import { apiSendOne } from '../../lib/api-client.ts';
import { useShelters } from '../../lib/queries.ts';
import type { Shelter } from '../../lib/types.ts';

const columns: Column<Shelter>[] = [
  { key: 'name', header: 'Shelter', render: (s) => <span><strong>{s.name}</strong><br /><span className="text-xs text-slate-500">{s.location}</span></span>, sortValue: (s) => s.name },
  { key: 'occ', header: 'Occupancy', render: (s) => <span className="text-xs font-semibold">{s.currentOccupancy} / {s.totalCapacity} ({s.availableCapacity} free)</span>, sortValue: (s) => s.currentOccupancy / Math.max(1, s.totalCapacity) },
  { key: 'status', header: 'Status', render: (s) => <EnumBadge group="shelterStatuses" value={s.operatingStatus} /> },
  { key: 'mgr', header: 'Manager', render: (s) => <span className="text-xs">{s.manager?.name ?? '—'}</span> },
];

function OccupancyForm({ shelter, onDone }: { shelter: Shelter; onDone: () => void }) {
  const { push } = useToast();
  const qc = useQueryClient();
  const [occupancy, setOccupancy] = useState(shelter.currentOccupancy);
  const [capacity, setCapacity] = useState(shelter.totalCapacity);
  const [status, setStatus] = useState(shelter.operatingStatus);
  const [facilities, setFacilities] = useState(shelter.facilities);
  const [override, setOverride] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideError, setOverrideError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { options } = useMeta();
  const mut = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiSendOne<Shelter>('patch', `/shelters/${shelter.id}`, 'shelter', body),
    // F-08: occupancy moves dashboard counts and the audit trail.
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['shelters'] }); qc.invalidateQueries({ queryKey: ['shelter'] }); qc.invalidateQueries({ queryKey: ['dashboard'] }); qc.invalidateQueries({ queryKey: ['audit-logs'] }); },
  });
  async function save() {
    setError(null); setOverrideError(null);
    const beds = Math.floor(Number(capacity) || 0);
    if (beds < 1) { setError('Total capacity must be at least 1 bed.'); return; }
    const overCapacity = occupancy > beds;
    if (overCapacity && !override) {
      setError('Occupancy exceeds capacity — tick the emergency override and give a reason.');
      return;
    }
    if (overCapacity && overrideReason.trim().length < 5) {
      setOverrideError('A reason of at least 5 characters is required — it goes into the audit trail.');
      return;
    }
    try {
      await mut.mutateAsync({
        currentOccupancy: occupancy,
        totalCapacity: beds,
        operatingStatus: status,
        facilities: facilities.trim(),
        ...(overCapacity ? { emergencyOverride: true, overrideReason: overrideReason.trim() } : { emergencyOverride: override || undefined }),
      });
      push('success', overCapacity ? 'Shelter updated (override logged).' : 'Shelter updated.');
      onDone();
    }
    catch (err) { setError(formatApiError(err)); }
  }
  const bedsNow = Math.floor(Number(capacity) || 0);
  const pct = bedsNow ? Math.round((occupancy / bedsNow) * 100) : 0;
  return (
    <div className="space-y-3">
      <div>
        <div className="flex justify-between text-sm"><span>Occupancy</span><strong>{occupancy} / {bedsNow}</strong></div>
        <input type="range" min={0} max={Math.max(bedsNow, occupancy + 50)} value={occupancy} onChange={(e) => setOccupancy(+e.target.value)} className="w-full accent-brand-600" aria-label="Current occupancy" />
        <div className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
          <div className={`h-full ${pct > 100 ? 'bg-red-600' : pct >= 95 ? 'bg-red-500' : pct >= 75 ? 'bg-amber-500' : 'bg-green-500'}`} style={{ width: `${Math.min(100, pct)}%` }} />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Total beds (capacity)"><Input type="number" min={1} value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} aria-label="Total capacity" /></Field>
        <Field label="Operating status"><Select value={status} onChange={(e) => setStatus(e.target.value)}>{options('shelterStatuses').map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</Select></Field>
      </div>
      <Field label="Facilities (comma separated)"><Input value={facilities} onChange={(e) => setFacilities(e.target.value)} /></Field>
      {occupancy > bedsNow && (
        <div className="space-y-2 rounded-lg bg-red-50 p-2.5 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
          <label className="flex items-start gap-2">
            <input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} className="mt-0.5" aria-label="Emergency override" />
            Emergency override — occupancy exceeds capacity. This is audited.
          </label>
          <Field label="Override reason (mandatory)" error={overrideError ?? undefined} htmlFor="admin-ovr">
            <Input id="admin-ovr" value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} placeholder="e.g. Flood surge, no alternate beds" />
          </Field>
        </div>
      )}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <Button onClick={() => void save()} disabled={mut.isPending} className="w-full">{mut.isPending ? 'Saving…' : 'Save'}</Button>
    </div>
  );
}

export default function AdminShelters() {
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<Shelter | null>(null);
  const { options } = useMeta();
  const q = useShelters({ operatingStatus: status || undefined, search: search || undefined, page, limit: 15 });

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">🏠 Shelters</h1>
      <Card>
        <div className="flex flex-wrap gap-2">
          <Select aria-label="Status filter" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="w-auto">
            <option value="">All statuses</option>
            {options('shelterStatuses').map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
          <Input placeholder="Search name / location…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="min-w-40 flex-1" aria-label="Search shelters" />
        </div>
      </Card>
      {q.isLoading && <Skeleton className="h-48" />}
      {q.isError && <ErrorState message="Could not load shelters." onRetry={() => void q.refetch()} />}
      {q.data && (
        <DataTable
          rows={q.data.items.map((s) => ({ ...s }))}
          columns={[
            ...columns,
            { key: 'act', header: 'Actions', render: (s) => <Button variant="secondary" size="sm" onClick={() => setEditing(s)}>Manage</Button> },
          ]}
          meta={q.data.meta} page={page} onPage={setPage} emptyTitle="No shelters found"
        />
      )}
      <Modal open={editing != null} onClose={() => setEditing(null)} title={editing ? `Manage · ${editing.name}` : 'Manage'}>
        {editing && <OccupancyForm shelter={editing} onDone={() => setEditing(null)} />}
      </Modal>
      <Card><CardTitle>Capacity rule</CardTitle><p className="text-sm text-slate-500">Occupancy can never exceed capacity unless the emergency-override flag is set (audited, SRS Shelter.Capacity.Block).</p></Card>
    </div>
  );
}
