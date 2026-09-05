import type { AffectedArea } from "@/lib/types";

export type AreaGeometry = {
  type: string;
  coordinates: unknown;
};

export type AreaBoundary = {
  id: string;
  label: string;
  geojson: AreaGeometry | null;
  lat: number | null;
  lng: number | null;
};

export const FALLBACK_RADIUS_M = 350;
export const INCLUDING_EXPAND_M = 350;
const STACK_OFFSET_DEG = 0.0016;

export type MapArea = {
  id: string;
  label: string;
  lat: number;
  lng: number;
  radius: number;
};

export function radiusForAreas(
  areas: { lat: number | null; lng: number | null }[],
): number[] {
  const radii = areas.map((area) =>
    area.lat != null && area.lng != null ? FALLBACK_RADIUS_M : 0,
  );
  for (let index = 0; index < areas.length; index += 1) {
    const area = areas[index];
    if (area.lat != null && area.lng != null) {
      continue;
    }
    for (let previous = index - 1; previous >= 0; previous -= 1) {
      if (areas[previous].lat != null && areas[previous].lng != null) {
        radii[previous] += INCLUDING_EXPAND_M;
        break;
      }
    }
  }
  return radii;
}

export function resolveMapAreas(
  areas: { id: string; rawText: string; lat: number | null; lng: number | null }[],
): MapArea[] {
  const filled = areas.map((area) => ({
    id: area.id,
    label: area.rawText,
    lat: area.lat,
    lng: area.lng,
    inferred: false,
  }));

  let last: { lat: number; lng: number } | null = null;
  for (const item of filled) {
    if (item.lat != null && item.lng != null) {
      last = { lat: item.lat, lng: item.lng };
    } else if (last) {
      item.lat = last.lat;
      item.lng = last.lng;
      item.inferred = true;
    }
  }

  let next: { lat: number; lng: number } | null = null;
  for (let index = filled.length - 1; index >= 0; index -= 1) {
    const item = filled[index];
    if (item.lat != null && item.lng != null && !item.inferred) {
      next = { lat: item.lat, lng: item.lng };
    } else if (item.lat == null && next) {
      item.lat = next.lat;
      item.lng = next.lng;
      item.inferred = true;
    }
  }

  const radii = radiusForAreas(
    filled.map((item) => ({
      lat: item.inferred ? null : item.lat,
      lng: item.inferred ? null : item.lng,
    })),
  );

  const groups = new Map<string, typeof filled>();
  for (const item of filled) {
    if (item.lat == null || item.lng == null) {
      continue;
    }
    const key = `${item.lat.toFixed(5)},${item.lng.toFixed(5)}`;
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }
  for (const group of groups.values()) {
    if (group.length < 2) {
      continue;
    }
    group.forEach((item, index) => {
      const angle = (2 * Math.PI * index) / group.length;
      item.lat = (item.lat as number) + Math.cos(angle) * STACK_OFFSET_DEG;
      item.lng = (item.lng as number) + Math.sin(angle) * STACK_OFFSET_DEG;
    });
  }

  return filled.flatMap((item, index) =>
    item.lat != null && item.lng != null
      ? [
          {
            id: item.id,
            label: item.label,
            lat: item.lat,
            lng: item.lng,
            radius: radii[index] || FALLBACK_RADIUS_M,
          },
        ]
      : [],
  );
}

export function hasOsmPolygon(geojson: AreaGeometry | null) {
  if (!geojson || geojson.type === "Point") {
    return false;
  }
  if (geojson.type !== "Polygon") {
    return true;
  }
  const ring = (geojson.coordinates as number[][][])[0];
  return Array.isArray(ring) && ring.length > 5;
}

export async function fetchAreaBoundary(
  area: AffectedArea,
  signal?: AbortSignal,
): Promise<AreaBoundary> {
  const params = new URLSearchParams({
    q: area.rawText,
    id: area.id,
  });
  if (area.lat != null && area.lng != null) {
    params.set("lat", String(area.lat));
    params.set("lng", String(area.lng));
  }

  const response = await fetch(`/api/geocode/boundary?${params}`, { signal });
  if (!response.ok) {
    return {
      id: area.id,
      label: area.rawText,
      geojson: null,
      lat: area.lat,
      lng: area.lng,
    };
  }

  return (await response.json()) as AreaBoundary;
}
