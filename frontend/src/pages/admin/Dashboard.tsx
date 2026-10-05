import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { RequestsMap } from '../../components/Maps.tsx';
import { Card, CardTitle, CardSkeleton, EnumBadge, ErrorState, Skeleton, StatCard } from '../../components/ui.tsx';
import { useMeta } from '../../lib/meta.tsx';
import { STR } from '../../lib/strings.ts';
import { useDashboard, useRequests, useShortages, useTimeseries } from '../../lib/queries.ts';

export default function AdminDashboard() {
  const { label, dotColor, meta } = useMeta();
  const dash = useDashboard();
  const ts = useTimeseries(14);
  const shortages = useShortages();
  const mapReqs = useRequests({ limit: 100 });

  const byStatus = useMemo(() => Object.entries(dash.data?.requests.byStatus ?? {}).map(([k, v]) => ({ name: label('requestStatuses', k), value: v })), [dash.data, label]);
  const byPriority = useMemo(() => Object.entries(dash.data?.requests.byPriority ?? {}).map(([k, v]) => ({ name: label('priorities', k), value: v, fill: dotColor('priorities', k) })), [dash.data, dotColor, label]);
  const byType = useMemo(() => Object.entries(dash.data?.requests.byType ?? {}).map(([k, v]) => ({ name: label('emergencyTypes', k), value: v })), [dash.data, label]);
  // F-07: live = lifecycle steps before RESOLVED (canonical order ends with RESOLVED) — same set as before, from meta.
  const liveStatuses = (meta?.requestLifecycle ?? []).slice(0, -1);
  const liveReqs = (mapReqs.data?.items ?? []).filter((r) => liveStatuses.length === 0 || liveStatuses.includes(r.status));

  if (dash.isLoading) return <><CardSkeleton /><CardSkeleton /></>;
  if (dash.isError || !dash.data) return <ErrorState message="Could not load the operational picture." onRetry={() => void dash.refetch()} />;
  const d = dash.data;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">🛰️ Command center <span className="ml-1 rounded-full bg-green-100 px-2 py-0.5 align-middle text-xs font-bold text-green-700 dark:bg-green-950 dark:text-green-300">● LIVE</span></h1>
        <Link to="/admin/requests" className="rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-brand-700">Open request queue →</Link>
      </div>

      <section aria-label="Key figures" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Active requests" value={d.requests.active} sub={`${d.requests.pending} awaiting verification`} icon="🚨" accent="text-red-500" />
        <StatCard label="Critical open" value={d.requests.critical} icon="🔥" accent="text-orange-500" />
        <StatCard label="Beds free" value={d.shelters.availableCapacity.toLocaleString()} sub={`${Math.round(d.shelters.occupancyRate * 100)}% occupied`} icon="🛏️" accent="text-green-500" />
        <StatCard label="Response time" value={d.performance.avgResponseHours != null ? `${d.performance.avgResponseHours.toFixed(1)}h` : '—'} sub={`${d.performance.resolvedCount} resolved`} icon="⏱️" accent="text-brand-500" />
      </section>

      <Card>
        <CardTitle right={<span className="text-xs font-normal text-slate-400">Priority color-coded · updates every 10s</span>}>Live incident map</CardTitle>
        {mapReqs.isLoading && <Skeleton className="h-64" />}
        {mapReqs.isError && <ErrorState message="Could not load the incident map." onRetry={() => void mapReqs.refetch()} />}
        {!mapReqs.isLoading && !mapReqs.isError && (
          <RequestsMap requests={liveReqs} />
        )}
      </Card>

      <section className="grid gap-3 lg:grid-cols-2">
        <Card>
          <CardTitle>Requests by status</CardTitle>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byStatus} layout="vertical" margin={{ left: 24 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#1c5ff5" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <CardTitle>Requests by priority</CardTitle>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byPriority}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {byPriority.map((p) => <Cell key={p.name} fill={p.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <CardTitle>14-day trend</CardTitle>
          <div className="h-56">
            {ts.isLoading ? <Skeleton className="h-56" /> : ts.isError ? (
              <ErrorState message="Could not load the trend chart." onRetry={() => void ts.refetch()} />
            ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={ts.data ?? []}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v: string) => v.slice(5)} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="total" name="Submitted" stroke="#1c5ff5" fill="#1c5ff5" fillOpacity={0.2} />
                <Area type="monotone" dataKey="resolved" name="Resolved" stroke="#16a34a" fill="#16a34a" fillOpacity={0.2} />
              </AreaChart>
            </ResponsiveContainer>
            )}
          </div>
        </Card>
        <Card>
          <CardTitle>Requests by type</CardTitle>
          <div className="flex flex-wrap gap-1.5">
            {byType.map((t) => <span key={t.name} className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold dark:bg-slate-800">{t.name} · {t.value}</span>)}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
            <div className="rounded-lg bg-slate-50 p-2.5 dark:bg-slate-800"><p className="text-xs text-slate-500">Teams available</p><p className="text-lg font-extrabold">{d.teams.byAvailability.AVAILABLE ?? 0} / {d.teams.total}</p></div>
            <div className="rounded-lg bg-slate-50 p-2.5 dark:bg-slate-800"><p className="text-xs text-slate-500">Open resource needs</p><p className="text-lg font-extrabold">{d.inventory.openResourceRequests}</p></div>
          </div>
          {(shortages.data ?? []).length > 0 && (
            <div className="mt-3 rounded-lg bg-red-50 p-2.5 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
              <p className="font-bold">⚠️ Stock shortages</p>
              <ul className="mt-1 list-disc pl-5">
                {shortages.data!.slice(0, 4).map((s) => <li key={s.itemId}>{s.itemName}: short by {s.shortage} {s.unit}</li>)}
              </ul>
            </div>
          )}
        </Card>
      </section>

      <Card>
        <CardTitle right={<Link to="/admin/requests?status=SUBMITTED" className="link text-sm">View all →</Link>}>Needs verification</CardTitle>
        <RequestQueuePreview />
      </Card>
    </div>
  );
}

function RequestQueuePreview() {
  const q = useRequests({ status: 'SUBMITTED', limit: 5 });
  if (q.isLoading) return <p className="text-sm text-slate-400">Loading…</p>;
  if (q.isError) return <ErrorState message="Could not load the queue preview." onRetry={() => void q.refetch()} />;
  const items = q.data?.items ?? [];
  if (items.length === 0) return <p className="text-sm text-slate-500">{STR.queueClear} — {STR.queueClearHint}</p>;
  return (
    <ul className="divide-y divide-slate-100 dark:divide-slate-800">
      {items.map((r) => (
        <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
          <span className="min-w-0"><strong>{r.emergencyType}</strong> · {r.peopleAffected} people · <span className="text-slate-500">{r.location}</span></span>
          <span className="flex gap-1.5"><EnumBadge group="priorities" value={r.priority} /><Link to={`/admin/requests?focus=${r.id}`} className="link font-semibold">Triage →</Link></span>
        </li>
      ))}
    </ul>
  );
}
