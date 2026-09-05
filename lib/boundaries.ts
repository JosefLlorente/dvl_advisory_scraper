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
