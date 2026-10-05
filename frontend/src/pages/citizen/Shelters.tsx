import { useState } from 'react';
import { SheltersMap } from '../../components/Maps.tsx';
import { Button, Card, CardTitle, EmptyState, EnumBadge, ErrorState, Skeleton } from '../../components/ui.tsx';
import { useNearbyShelters, useShelters } from '../../lib/queries.ts';

function ShelterRow({ s }: { s: { id: string; name: string; location: string; totalCapacity: number; currentOccupancy: number; availableCapacity: number; facilities: string; operatingStatus: string; distanceKm?: number } }) {
  const pct = s.totalCapacity ? Math.round((s.currentOccupancy / s.totalCapacity) * 100) : 0;
  return (
    <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-bold text-slate-900 dark:text-white">{s.name}</p>
          <p className="truncate text-sm text-slate-500">📍 {s.location}{s.distanceKm != null && ` · ${s.distanceKm.toFixed(1)} km away`}</p>
        </div>
        <EnumBadge group="shelterStatuses" value={s.operatingStatus} />
      </div>
      <div className="mt-2">
        <div className="flex justify-between text-xs text-slate-500"><span>{s.availableCapacity} beds free of {s.totalCapacity}</span><span>{pct}% full</span></div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${s.name} occupancy`}>
          <div className={`h-full rounded-full ${pct >= 95 ? 'bg-red-500' : pct >= 75 ? 'bg-amber-500' : 'bg-green-500'}`} style={{ width: `${Math.min(100, pct)}%` }} />
        </div>
      </div>
      <p className="mt-1.5 truncate text-xs text-slate-500">Facilities: {s.facilities.split(',').join(' · ')}</p>
    </div>
  );
}

export default function Shelters() {
  const [pos, setPos] = useState<[number, number] | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const nearby = useNearbyShelters(pos?.[0] ?? null, pos?.[1] ?? null);
  const all = useShelters({ openOnly: true, limit: 50 });

  function locate() {
    setGeoError(null);
    if (!navigator.geolocation) { setGeoError('Geolocation not supported.'); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => setPos([+p.coords.latitude.toFixed(5), +p.coords.longitude.toFixed(5)]),
      () => setGeoError('Location unavailable.'),
      { timeout: 8000 },
    );
  }

  const list = pos ? (nearby.data ?? []) : (all.data?.items ?? []);
  const loading = pos ? nearby.isLoading : all.isLoading;
  const error = pos ? nearby.isError : all.isError;
  const retry = () => { void nearby.refetch(); void all.refetch(); };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-extrabold text-slate-900 dark:text-white">🏠 Nearby shelters</h1>
        <Button variant="secondary" onClick={locate}>📍 {pos ? 'Refresh location' : 'Use my location'}</Button>
      </div>
      {geoError && <p role="alert" className="text-sm text-red-600">{geoError}</p>}
      {loading ? <Skeleton className="h-80" /> : error ? <ErrorState message="Could not load shelters." onRetry={retry} /> : (
        <SheltersMap shelters={list} userPos={pos} />
      )}
      {loading ? <Skeleton className="h-24" /> : list.length === 0 ? (
        <EmptyState title={pos ? 'No shelters with free beds within 50 km' : 'No open shelters right now'} hint="Try again later or call the disaster helpline 1078." />
      ) : (
        <Card>
          <CardTitle>{pos ? `Closest shelters (${list.length})` : `Open shelters (${list.length})`}</CardTitle>
          <div className="space-y-2">{list.map((s) => <ShelterRow key={s.id} s={s} />)}</div>
        </Card>
      )}
    </div>
  );
}
