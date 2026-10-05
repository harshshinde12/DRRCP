import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiGet, getPaged } from '../lib/api-client.ts';
import { useAuth } from '../lib/auth.tsx';
import type { NotificationItem, Shelter } from '../lib/types.ts';
import { Card, CardSkeleton, StatCard } from '../components/ui.tsx';

const HELPLINES = [
  { n: '112', d: 'National emergency' },
  { n: '1078', d: 'Disaster helpline' },
  { n: '102', d: 'Medical / ambulance' },
  { n: '101', d: 'Fire' },
];

export default function Landing() {
  const { isAuthenticated, user } = useAuth();
  const sheltersQ = useQuery({ queryKey: ['public-shelters'], queryFn: () => getPaged<Shelter>('/shelters', { openOnly: true, limit: 100 }) });
  const alertsQ = useQuery({
    queryKey: ['public-alerts'],
    queryFn: () => apiGet<NotificationItem[]>('/notifications', { params: { type: 'PUBLIC_ALERT', limit: 3 } } as never).catch(() => [] as NotificationItem[]),
    enabled: isAuthenticated,
    refetchInterval: 10_000,
  });

  const shelters = sheltersQ.data?.items ?? [];
  const beds = shelters.reduce((a, s) => a + Math.max(0, s.availableCapacity), 0);
  const alerts = (alertsQ.data ?? []).slice(0, 3);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-3 sm:p-5">
      {/* alerts banner */}
      {isAuthenticated && alerts.length > 0 && (
        <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
          <p className="font-bold">📢 Active alerts</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {alerts.map((a) => <li key={a.id}>{a.message}</li>)}
          </ul>
        </div>
      )}

      {/* hero */}
      <section className="overflow-hidden rounded-2xl bg-gradient-to-br from-brand-700 via-brand-600 to-indigo-700 p-6 text-white sm:p-10">
        <p className="text-xs font-bold uppercase tracking-widest text-brand-200">Disaster Relief & Rescue Coordination Platform</p>
        <h1 className="mt-2 max-w-2xl text-3xl font-extrabold leading-tight sm:text-5xl">Help finds you faster when everyone sees the same map.</h1>
        <p className="mt-3 max-w-xl text-brand-100">Citizens raise emergency requests, rescue teams get dispatched with one confirmation, shelters and relief stocks stay visible in real time.</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link to={isAuthenticated ? (user?.role === 'CITIZEN' ? '/request-help' : '/notifications') : '/register'} className="rounded-lg bg-white px-5 py-2.5 font-bold text-brand-700 hover:bg-brand-50">
            🆘 Request Emergency Help
          </Link>
          <Link to="/shelters" className="rounded-lg px-5 py-2.5 font-bold text-white ring-1 ring-white/60 hover:bg-white/10">Find a shelter</Link>
        </div>
        <div className="mt-5 flex flex-wrap gap-x-5 gap-y-1 text-sm text-brand-100">
          {HELPLINES.map((h) => <span key={h.n}>📞 <a className="font-bold underline" href={`tel:${h.n}`}>{h.n}</a> · {h.d}</span>)}
        </div>
      </section>

      {/* live stats (public shelter data) */}
      <section aria-label="Live shelter stats" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {sheltersQ.isLoading ? (<><CardSkeleton /><CardSkeleton /><CardSkeleton /><CardSkeleton /></>) : (
          <>
            <StatCard label="Open shelters" value={shelters.length} icon="🏠" />
            <StatCard label="Beds available" value={beds.toLocaleString()} icon="🛏️" />
            <StatCard label="Total capacity" value={shelters.reduce((a, s) => a + s.totalCapacity, 0).toLocaleString()} icon="👥" />
            <StatCard label="Helplines" value="112" sub="1078 · 102 · 101" icon="📞" />
          </>
        )}
      </section>

      {/* how it works + roles */}
      <section className="grid gap-3 md:grid-cols-3">
        {[
          { t: '1 · Raise a request', d: 'Three quick steps — type, location on the map, details. Track it live with a status timeline.', i: '🆘' },
          { t: '2 · Verified & dispatched', d: 'Authorities verify, set priority and assign the nearest capable rescue team — always human-confirmed.', i: '🚑' },
          { t: '3 · Shelter & relief', d: 'Find beds nearby, watch shelter capacity, and follow relief stocks to the field — all in one view.', i: '🏠' },
        ].map((s) => (
          <Card key={s.t}><p className="text-2xl">{s.i}</p><h2 className="mt-1 font-bold text-slate-900 dark:text-white">{s.t}</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{s.d}</p></Card>
        ))}
      </section>
    </div>
  );
}
