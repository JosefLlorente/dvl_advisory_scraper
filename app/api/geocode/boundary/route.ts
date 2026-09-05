import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

type GoogleGeocodeHit = {
  formatted_address?: string;
  geometry?: {
    location?: { lat: number; lng: number };
    location_type?: string;
  };
  address_components?: { long_name?: string; types?: string[] }[];
};

type CacheEntry = {
  label: string;
  geojson: null;
  lat: number | null;
  lng: number | null;
};

const cache = new Map<string, CacheEntry>();

const JP_LAUREL = /j\.?\s*p\.?\s*laurel/i;
const JP_LAUREL_QUERY = "J.P. Laurel Avenue";
const JP_LAUREL_POINT = { lat: 7.0942, lng: 125.6178 };
const SEARCH_CITIES = ["Davao City", "Panabo City"] as const;

function simplify(query: string): string {
  if (JP_LAUREL.test(query)) {
    return JP_LAUREL_QUERY;
  }
  const withoutCrossing = query.replace(/\bMatina Crossing\b/gi, "MATINA_CROSSING");
  return withoutCrossing
    .replace(/\balong\b.*$/i, "")
    .replace(/\bgoing to\b.*$/i, "")
    .replace(/\bfrom\b.*?\bto\b/i, "")
    .replace(/\bto\b.*$/i, "")
    .replace(/\bnearby areas\b.*$/i, "")
    .replace(/\bcrossing\b/gi, " ")
    .replace(/MATINA_CROSSING/g, "Matina Crossing")
    .replace(/\s+/g, " ")
    .trim();
}

function inViewbox(lat: number, lon: number) {
  return lat >= 6.88 && lat <= 7.42 && lon >= 125.3 && lon <= 125.85;
}

function inAllowedCity(hit: GoogleGeocodeHit, lat: number, lon: number): boolean {
  if (!inViewbox(lat, lon)) {
    return false;
  }
  const city =
    hit.address_components?.find((component) =>
      component.types?.includes("locality"),
    )?.long_name?.toLowerCase() ?? "";
  const display = hit.formatted_address?.toLowerCase() ?? "";
  const blob = `${city} ${display}`;
  return (
    /davao city|panabo city/.test(blob) ||
    city === "davao" ||
    city === "panabo" ||
    /\bpanabo\b|\bsamal\b|\btalicud\b|\bigacos\b/.test(blob) ||
    /davao del sur|davao del norte|davao region/.test(display)
  );
}

async function googleGeocode(query: string): Promise<CacheEntry | null> {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) {
    return null;
  }
  const cacheKey = query.toLowerCase();
  const cached = cache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const addresses = [
    ...SEARCH_CITIES.map((city) => `${query}, ${city}, Philippines`),
    `${query}, Philippines`,
  ];

  for (const address of addresses) {
    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    url.searchParams.set("address", address);
    url.searchParams.set("key", key);
    url.searchParams.set("region", "ph");
    url.searchParams.set("bounds", "6.88,125.30|7.42,125.85");
    url.searchParams.set("components", "country:PH");

    const response = await fetch(url);
    if (!response.ok) {
      continue;
    }
    const payload = (await response.json()) as {
      status?: string;
      results?: GoogleGeocodeHit[];
    };
    if (payload.status && !["OK", "ZERO_RESULTS"].includes(payload.status)) {
      break;
    }
    const hit = (payload.results ?? []).find((candidate) => {
      const lat = candidate.geometry?.location?.lat;
      const lng = candidate.geometry?.location?.lng;
      return (
        lat != null &&
        lng != null &&
        inAllowedCity(candidate, lat, lng)
      );
    });
    if (!hit?.geometry?.location) {
      continue;
    }
    const entry: CacheEntry = {
      label: hit.formatted_address ?? query,
      geojson: null,
      lat: hit.geometry.location.lat,
      lng: hit.geometry.location.lng,
    };
    cache.set(cacheKey, entry);
    return entry;
  }

  const empty: CacheEntry = {
    label: query,
    geojson: null,
    lat: null,
    lng: null,
  };
  cache.set(cacheKey, empty);
  return empty;
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

  function payload(nextLat: number | null, nextLng: number | null) {
    return {
      id,
      label: q,
      geojson: null,
      lat: nextLat ?? fallbackLat,
      lng: nextLng ?? fallbackLng,
    };
  }

  if (/^davao( city)?$/i.test(simplified)) {
    return Response.json(payload(fallbackLat, fallbackLng));
  }

  try {
    const result = await googleGeocode(simplified);
    if (result) {
      return Response.json(
        payload(
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
    return Response.json(payload(JP_LAUREL_POINT.lat, JP_LAUREL_POINT.lng));
  }

  return Response.json(payload(fallbackLat, fallbackLng));
}
