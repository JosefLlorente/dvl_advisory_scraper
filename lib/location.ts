import { FALLBACK_RADIUS_M, resolveMapAreas } from "@/lib/boundaries";
import type { Advisory } from "@/lib/types";

export type AffectedHit = {
  advisoryId: string;
  windowId: string | null;
  areaLabel: string;
  meters: number;
};

const EARTH_M = 6_371_000;

export function haversineMeters(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function findAffectedHits(
  advisories: Advisory[],
  point: { lat: number; lng: number },
): AffectedHit[] {
  const hits: AffectedHit[] = [];
  for (const advisory of advisories) {
    if (advisory.status !== "upcoming" && advisory.status !== "active") {
      continue;
    }
    const mapped = resolveMapAreas(advisory.areas);
    for (const area of mapped) {
      const meters = haversineMeters(point, area);
      const radius = area.radius || FALLBACK_RADIUS_M;
      if (meters <= radius) {
        const source = advisory.areas.find((item) => item.id === area.id);
        hits.push({
          advisoryId: advisory.id,
          windowId: source?.windowId ?? null,
          areaLabel: area.label,
          meters,
        });
      }
    }
  }
  return hits.sort((left, right) => left.meters - right.meters);
}
