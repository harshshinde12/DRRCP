import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useState } from 'react';
import { Circle, MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { PRIORITY_DOT } from '../lib/meta.tsx';

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
  useEffect(() => {
    if (points.length > 1) map.fitBounds(L.latLngBounds(points).pad(0.2));
    else if (points.length === 1) map.setView(points[0], 12);
  }, [map, points.join('|')]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

export interface MapRequest { id: string; latitude: number | null; longitude: number | null; location: string; priority: string; displayStatus: string; }

/** Admin live map: requests color-coded by priority. */
export function RequestsMap({ requests, height = 420 }: { requests: MapRequest[]; height?: number }) {
  const pts = requests.filter((r) => r.latitude != null && r.longitude != null).map((r) => [r.latitude as number, r.longitude as number] as [number, number]);
  return (
    <MapContainer center={MUMBAI} zoom={11} style={{ height, width: '100%' }} scrollWheelZoom={false}>
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <FitToPoints points={pts} />
      {requests.filter((r) => r.latitude != null && r.longitude != null).map((r) => (
        <Marker keyboard={false} key={r.id} position={[r.latitude as number, r.longitude as number]} icon={dot(PRIORITY_DOT[r.priority] ?? '#64748b')}>
          <Popup>
            <strong>{r.location}</strong><br />{r.displayStatus}<br />
            <a href={`/admin/requests?focus=${r.id}`}>Open in queue</a>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}

export interface MapShelter { id: string; name: string; latitude: number | null; longitude: number | null; availableCapacity: number; }

/** Shelter map: green beds-available markers + user position. */
export function SheltersMap({ shelters, userPos, height = 380 }: { shelters: MapShelter[]; userPos?: [number, number] | null; height?: number }) {
  const pts = shelters.filter((s) => s.latitude != null && s.longitude != null).map((s) => [s.latitude as number, s.longitude as number] as [number, number]);
  return (
    <MapContainer center={userPos ?? MUMBAI} zoom={11} style={{ height, width: '100%' }}>
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <FitToPoints points={userPos ? [...pts, userPos] : pts} />
      {userPos && <Circle center={userPos} radius={600} pathOptions={{ color: '#1c5ff5', fillOpacity: 0.15 }} />}
      {userPos && <Marker keyboard={false} position={userPos} icon={dot('#1c5ff5', 16)}><Popup>You are here</Popup></Marker>}
      {shelters.filter((s) => s.latitude != null && s.longitude != null).map((s) => (
        <Marker keyboard={false} key={s.id} position={[s.latitude as number, s.longitude as number]} icon={dot(s.availableCapacity > 0 ? '#16a34a' : '#dc2626')}>
          <Popup><strong>{s.name}</strong><br />{s.availableCapacity} beds free</Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}

/** Click-to-pick coordinates for the emergency form + shelter/team forms. */
export function LocationPicker({ value, onChange, height = 300 }: { value: { latitude: number | null; longitude: number | null }; onChange: (v: { latitude: number; longitude: number }) => void; height?: number }) {
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
  return (
    <div>
      <MapContainer center={pos ?? MUMBAI} zoom={pos ? 14 : 11} style={{ height, width: '100%' }}>
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Clicker />
        {pos && <Marker keyboard={false} position={pos} icon={dot('#dc2626', 20)}><Popup>Incident location</Popup></Marker>}
      </MapContainer>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
        <button type="button" onClick={useMyLocation} className="rounded-lg bg-brand-600 px-3 py-1.5 font-semibold text-white hover:bg-brand-700">📍 Use my location</button>
        <span className="text-slate-500 dark:text-slate-400">
          {pos ? `Lat ${pos[0]}, Lng ${pos[1]}` : 'Tap the map to drop a pin'} · or type an address below
        </span>
      </div>
      {geoError && <p role="alert" className="mt-1 text-xs text-red-600">{geoError}</p>}
    </div>
  );
}
