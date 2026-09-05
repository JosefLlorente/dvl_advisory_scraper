import { NextRequest } from "next/server";

import { hasOsmPolygon } from "@/lib/boundaries";

export const dynamic = "force-dynamic";

const USER_AGENT =
  "DavaoLightOutageCrawler/0.1 (+https://github.com/local/dvl_scraper; civic outage indexer)";

const CITY_TYPES = new Set([
  "city",
  "municipality",
  "province",
  "state",
  "region",
  "country",
  "county",
]);

type NominatimHit = {
  lat: string;
  lon: string;
  display_name?: string;
  addresstype?: string;
  class?: string;
  type?: string;
  boundingbox?: [string, string, string, string];
  geojson?: { type: string; coordinates: unknown };
};

type CacheEntry = {
  label: string;
  geojson: { type: string; coordinates: unknown } | null;
  lat: number | null;
  lng: number | null;
};

const cache = new Map<string, CacheEntry>();
let lastNominatimAt = 0;

const JP_LAUREL = /j\.?\s*p\.?\s*laurel/i;
const JP_LAUREL_QUERY = "J.P. Laurel Avenue";
const JP_LAUREL_POINT = { lat: 7.0942, lng: 125.6178 };

function simplify(query: string): string {
  if (JP_LAUREL.test(query)) {
    return JP_LAUREL_QUERY;
  }
  return query
    .replace(/\balong\b.*$/i, "")
    .replace(/\bgoing to\b.*$/i, "")
    .replace(/\bnearby areas\b/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function bboxSpan(bbox?: [string, string, string, string]) {
  if (!bbox) return Number.POSITIVE_INFINITY;
  const south = Number(bbox[0]);
  const north = Number(bbox[1]);
  const west = Number(bbox[2]);
  const east = Number(bbox[3]);
  return Math.max(north - south, east - west);
}

function isLocalHit(hit: NominatimHit): boolean {
  if (hit.addresstype && CITY_TYPES.has(hit.addresstype)) {
    return false;
  }
  if (hit.type && CITY_TYPES.has(hit.type)) {
    return false;
  }
  return bboxSpan(hit.boundingbox) <= 0.06;
}

function geometryFromHit(hit: NominatimHit) {
  if (!isLocalHit(hit)) {
    return null;
  }
  if (hasOsmPolygon(hit.geojson ?? null)) {
    return hit.geojson ?? null;
  }
  return null;
}

async function throttle() {
  const wait = 1100 - (Date.now() - lastNominatimAt);
  if (wait > 0) {
    await new Promise((resolve) => setTimeout(resolve, wait));
  }
  lastNominatimAt = Date.now();
}

async function nominatimSearch(query: string): Promise<CacheEntry | null> {
  const key = query.toLowerCase();
  const cached = cache.get(key);
  if (cached) {
    return cached;
  }

  await throttle();
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "5");
  url.searchParams.set("countrycodes", "ph");
  url.searchParams.set("polygon_geojson", "1");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("viewbox", "125.35,7.28,125.78,6.95");

  const response = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Referer: "https://www.davaolight.com",
    },
  });
  if (!response.ok) {
    return null;
  }

  const hits = (await response.json()) as NominatimHit[];
  const hit = hits.find(isLocalHit);
  if (!hit) {
    const empty: CacheEntry = {
      label: query,
      geojson: null,
      lat: null,
      lng: null,
    };
    cache.set(key, empty);
    return empty;
  }

  const entry: CacheEntry = {
    label: hit.display_name ?? query,
    geojson: geometryFromHit(hit),
    lat: Number(hit.lat),
    lng: Number(hit.lon),
  };
  cache.set(key, entry);
  return entry;
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim();
  const id = request.nextUrl.searchParams.get("id") ?? q ?? "";
  const lat = request.nextUrl.searchParams.get("lat");
  const lng = request.nextUrl.searchParams.get("lng");

  if (!q) {
    return Response.json({ error: "Missing q" }, { status: 400 });
  }

  const fallbackLat = lat ? Number(lat) : null;
  const fallbackLng = lng ? Number(lng) : null;
  const simplified = simplify(q) || q;

  function payload(
    geojson: { type: string; coordinates: unknown } | null,
    nextLat: number | null,
    nextLng: number | null,
  ) {
    const resolvedLat = nextLat ?? fallbackLat;
    const resolvedLng = nextLng ?? fallbackLng;
    return {
      id,
      label: q,
      geojson: hasOsmPolygon(geojson) ? geojson : null,
      lat: resolvedLat,
      lng: resolvedLng,
    };
  }

  if (/^davao( city)?$/i.test(simplified)) {
    return Response.json(payload(null, fallbackLat, fallbackLng));
  }

  try {
    const result = await nominatimSearch(
      `${simplified}, Davao City, Philippines`,
    );
    if (result) {
      return Response.json(
        payload(
          result.geojson,
          result.lat
            ?? (simplified === JP_LAUREL_QUERY ? JP_LAUREL_POINT.lat : null),
          result.lng
            ?? (simplified === JP_LAUREL_QUERY ? JP_LAUREL_POINT.lng : null),
        ),
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Geocode failed";
    return Response.json({ error: message }, { status: 502 });
  }

  if (simplified === JP_LAUREL_QUERY) {
    return Response.json(
      payload(null, JP_LAUREL_POINT.lat, JP_LAUREL_POINT.lng),
    );
  }

  return Response.json(payload(null, fallbackLat, fallbackLng));
}
