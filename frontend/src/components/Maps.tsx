import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Circle, MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { Link } from 'react-router-dom';
import { hexFor, useMeta } from '../lib/meta.tsx';

export const MUMBAI: [number, number] = [19.076, 72.8777];

function dot(color: string, size = 18): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<span style="display:block;width:${size}px;height:${size}px;border-radius:9999px;background:${color};border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function FitToPoints({ points }: { points: Array<[number, number]> }) {
  const map = useMap();
  // U-04: the point SET is the dependency — identical polls (same rounded
  // coords, any order) must not re-fit the map (jitter). A genuinely new set
  // still re-fits once.
  const key = useMemo(
    () => points.map(([a, b]) => `${a.toFixed(4)},${b.toFixed(4)}`).sort().join('|'),
    [points],
  );
  const appliedKey = useRef<string | null>(null);
  useEffect(() => {
    if (key === appliedKey.current) return;
    appliedKey.current = key;
    if (points.length > 1) map.fitBounds(L.latLngBounds(points).pad(0.2));
    else if (points.length === 1) map.setView(points[0], 12);
  }, [map, key, points]);
  return null;
}

export interface MapRequest { id: string; latitude: number | null; longitude: number | null; location: string; priority: string; displayStatus: string; }

/** Admin live map: requests color-coded by priority. */
export function RequestsMap({ requests, height = 'min(420px, 72vw)' }: { requests: MapRequest[]; height?: number | string }) {
  const { dotColor } = useMeta();
  const pts = requests.filter((r) => r.latitude != null && r.longitude != null).map((r) => [r.latitude as number, r.longitude as number] as [number, number]);
  return (
    <MapContainer center={MUMBAI} zoom={11} style={{ height, width: '100%' }} scrollWheelZoom={false}>
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <FitToPoints points={pts} />
      {requests.filter((r) => r.latitude != null && r.longitude != null).map((r) => (
        <Marker keyboard={false} key={r.id} position={[r.latitude as number, r.longitude as number]} icon={dot(dotColor('priorities', r.priority))}>
          <Popup>
            <strong>{r.location}</strong><br />{r.displayStatus}<br />
            <Link to={`/admin/requests?focus=${r.id}`}>Open in queue</Link>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}

export interface MapShelter { id: string; name: string; latitude: number | null; longitude: number | null; availableCapacity: number; }

/** Shelter map: green beds-available markers + user position. */
export function SheltersMap({ shelters, userPos, height = 'min(380px, 66vw)' }: { shelters: MapShelter[]; userPos?: [number, number] | null; height?: number | string }) {
  const pts = shelters.filter((s) => s.latitude != null && s.longitude != null).map((s) => [s.latitude as number, s.longitude as number] as [number, number]);
  return (
    <MapContainer center={userPos ?? MUMBAI} zoom={11} style={{ height, width: '100%' }}>
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <FitToPoints points={userPos ? [...pts, userPos] : pts} />
      {userPos && <Circle center={userPos} radius={600} pathOptions={{ color: hexFor('blue'), fillOpacity: 0.15 }} />}
      {userPos && <Marker keyboard={false} position={userPos} icon={dot(hexFor('blue'), 16)}><Popup>You are here</Popup></Marker>}
      {shelters.filter((s) => s.latitude != null && s.longitude != null).map((s) => (
        <Marker keyboard={false} key={s.id} position={[s.latitude as number, s.longitude as number]} icon={dot(s.availableCapacity > 0 ? hexFor('green') : hexFor('red'))}>
          <Popup><strong>{s.name}</strong><br />{s.availableCapacity} beds free</Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}

/** Click-to-pick coordinates for the emergency form + shelter/team forms. */
export function LocationPicker({ value, onChange, height = 'min(300px, 62vw)' }: { value: { latitude: number | null; longitude: number | null }; onChange: (v: { latitude: number; longitude: number }) => void; height?: number | string }) {
  const [geoError, setGeoError] = useState<string | null>(null);

  function Clicker() {
    useMapEvents({ click: (e) => onChange({ latitude: +e.latlng.lat.toFixed(6), longitude: +e.latlng.lng.toFixed(6) }) });
    return null;
  }

  function useMyLocation() {
    setGeoError(null);
    if (!navigator.geolocation) { setGeoError('Geolocation is not supported on this device.'); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => onChange({ latitude: +pos.coords.latitude.toFixed(6), longitude: +pos.coords.longitude.toFixed(6) }),
      () => setGeoError('Could not get your location. Tap the map instead.'),
      { timeout: 8000 },
    );
  }

  const pos: [number, number] | null = value.latitude != null && value.longitude != null ? [value.latitude, value.longitude] : null;
  // F-10: keyboard/text fallback so the picker never needs a mouse.
  const uid = useId();
  const [latText, setLatText] = useState(value.latitude?.toString() ?? '');
  const [lngText, setLngText] = useState(value.longitude?.toString() ?? '');
  useEffect(() => {
    setLatText(value.latitude?.toString() ?? '');
    setLngText(value.longitude?.toString() ?? '');
  }, [value.latitude, value.longitude]);
  function commitTyped() {
    const la = Number(latText);
    const ln = Number(lngText);
    if (Number.isFinite(la) && Number.isFinite(ln) && la >= -90 && la <= 90 && ln >= -180 && ln <= 180) {
      onChange({ latitude: la, longitude: ln });
    } else {
      setGeoError('Enter a valid latitude (-90…90) and longitude (-180…180).');
    }
  }
  return (
    <div>
      <MapContainer center={pos ?? MUMBAI} zoom={pos ? 14 : 11} style={{ height, width: '100%' }}>
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Clicker />
        {pos && <Marker keyboard={false} position={pos} icon={dot(hexFor('red'), 20)}><Popup>Incident location</Popup></Marker>}
      </MapContainer>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
        <button type="button" onClick={useMyLocation} className="rounded-lg bg-brand-600 px-3 py-1.5 font-semibold text-white hover:bg-brand-700">📍 Use my location</button>
        <span className="text-slate-500 dark:text-slate-400">
          {pos ? `Lat ${pos[0]}, Lng ${pos[1]}` : 'Tap the map to drop a pin'} · or type an address below
        </span>
      </div>
      <div className="mt-2 grid grid-cols-[1fr_1fr_auto] items-end gap-2">
        <div>
          <label htmlFor={`${uid}-lat`} className="label">Latitude</label>
          <input id={`${uid}-lat`} inputMode="decimal" placeholder="19.076" value={latText} onChange={(e) => setLatText(e.target.value)} className="input" />
        </div>
        <div>
          <label htmlFor={`${uid}-lng`} className="label">Longitude</label>
          <input id={`${uid}-lng`} inputMode="decimal" placeholder="72.878" value={lngText} onChange={(e) => setLngText(e.target.value)} className="input" />
        </div>
        <button type="button" onClick={commitTyped} className="rounded-lg bg-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">Set pin</button>
      </div>
      {geoError && <p role="alert" className="mt-1 text-xs text-red-600">{geoError}</p>}
    </div>
  );
}
