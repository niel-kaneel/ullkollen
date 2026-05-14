// Haversine distance in km
export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(x));
}

export type Stop = { id: string; lat: number; lng: number; label: string; kg?: number };

/**
 * Greedy nearest-neighbor TSP-ish: start at `start`, visit every stop in `stops`,
 * end at `end`. Returns ordered stop list and total km.
 */
export function planRoute(start: Stop, stops: Stop[], end: Stop): { ordered: Stop[]; totalKm: number } {
  const remaining = [...stops];
  const ordered: Stop[] = [];
  let current: Stop = start;
  let totalKm = 0;

  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = haversineKm(current, remaining[i]);
      if (d < bestDist) { bestDist = d; bestIdx = i; }
    }
    const next = remaining.splice(bestIdx, 1)[0];
    totalKm += bestDist;
    ordered.push(next);
    current = next;
  }
  totalKm += haversineKm(current, end);
  return { ordered, totalKm };
}
