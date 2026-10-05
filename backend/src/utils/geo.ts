const EARTH_KM = 6371;

/** Great-circle distance in km (Haversine). Used for nearby-shelter + team matching. */
export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const s =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.sqrt(s));
}

/** Split comma-separated profile fields (skills, facilities, capability) into tokens. */
export function tokenize(csv: string | null | undefined): string[] {
  return (csv ?? '')
    .split(',')
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean);
}
