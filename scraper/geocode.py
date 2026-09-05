from __future__ import annotations

import csv
import re
from functools import lru_cache
from typing import Any

import httpx

from .config import BARANGAY_CSV, GOOGLE_MAPS_API_KEY

JP_LAUREL = re.compile(r"j\.?\s*p\.?\s*laurel", re.IGNORECASE)
JP_LAUREL_QUERY = "J.P. Laurel Avenue"
JP_LAUREL_POINT = {
    "lat": 7.0942,
    "lng": 125.6178,
    "display_name": "J.P. Laurel Avenue",
    "confidence": "exact",
}
MATINA_CROSSING = re.compile(r"\bMatina Crossing\b", re.IGNORECASE)
CROSSING_WORD = re.compile(r"\bcrossing\b", re.IGNORECASE)
ALLOWED_CITIES = ("davao city", "panabo city")
SEARCH_CITIES = ("Davao City", "Panabo City")
# left, top, right, bottom — Davao City through Panabo City
VIEWBOX = "125.30,7.42,125.85,6.88"
QUERY_STOP = {
    "a",
    "an",
    "the",
    "of",
    "and",
    "or",
    "in",
    "at",
    "on",
    "to",
    "from",
    "along",
    "near",
    "opposite",
    "including",
    "portion",
    "areas",
    "area",
    "customers",
    "going",
    "up",
    "plant",
    "road",
    "street",
    "avenue",
    "barangay",
    "brgy",
    "purok",
    "sitio",
    "village",
    "subdivision",
    "highway",
    "station",
}
GOOGLE_GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json"
GOOGLE_PLACES_URL = "https://places.googleapis.com/v1/places:searchText"
GOOGLE_BOUNDS = "6.88,125.30|7.42,125.85"


def _normalize(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", value.lower()).strip()


@lru_cache(maxsize=1)
def load_barangays() -> list[dict[str, Any]]:
    if not BARANGAY_CSV.exists():
        return []
    rows: list[dict[str, Any]] = []
    with BARANGAY_CSV.open(encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            rows.append(
                {
                    "name": row["name"],
                    "lat": float(row["lat"]),
                    "lng": float(row["lng"]),
                    "key": _normalize(row["name"]),
                }
            )
    return rows


def _contains_tokens(haystack: list[str], needle: list[str]) -> bool:
    if not needle or len(needle) > len(haystack):
        return False
    span = len(needle)
    return any(haystack[index : index + span] == needle for index in range(len(haystack) - span + 1))


def match_barangay(raw_text: str) -> dict[str, Any] | None:
    tokens = _normalize(raw_text).split()
    significant = [token for token in tokens if token not in {"the", "entire", "a", "an", "of", "and"}]
    best = None
    for row in load_barangays():
        key_tokens = row["key"].split()
        if not key_tokens or not _contains_tokens(tokens, key_tokens):
            continue
        if len(key_tokens) == 1 and len(significant) >= 3:
            if key_tokens[0] not in {significant[0], significant[-1]}:
                continue
        if best is None or len(row["key"]) > len(best["key"]):
            best = row
    return best


def simplify_query(raw_text: str) -> str:
    if JP_LAUREL.search(raw_text):
        return JP_LAUREL_QUERY
    text = re.sub(r"\balong\b.*$", "", raw_text, flags=re.IGNORECASE)
    text = re.sub(r"\bgoing to\b.*$", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\bfrom\b.*?\bto\b", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\bto\b.*$", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\bnearby areas\b.*$", "", text, flags=re.IGNORECASE)
    protected = MATINA_CROSSING.sub("MATINA_CROSSING", text)
    protected = CROSSING_WORD.sub(" ", protected)
    text = protected.replace("MATINA_CROSSING", "Matina Crossing")
    cleaned = re.sub(r"\s+", " ", text).strip()
    return cleaned or raw_text


def distinctive_tokens(query: str) -> list[str]:
    return [
        token
        for token in _normalize(query).split()
        if token not in QUERY_STOP and not token.isdigit() and len(token) > 2
    ]


def required_tokens(query: str) -> list[str]:
    tokens = distinctive_tokens(query)
    if not tokens:
        return []
    longest = max(len(token) for token in tokens)
    return [token for token in tokens if len(token) == longest]


def hit_matches_query(query: str, hit: dict[str, Any]) -> bool:
    tokens = required_tokens(query)
    if not tokens:
        return True
    haystack = _normalize(
        " ".join(
            part
            for part in (hit.get("name"), hit.get("display_name"))
            if part
        )
    )
    return all(token in haystack for token in tokens)


def _hit_coords(hit: dict[str, Any]) -> tuple[float, float] | None:
    lat = hit.get("lat")
    lon = hit.get("lon") if hit.get("lon") is not None else hit.get("lng")
    if lat is None or lon is None:
        return None
    try:
        return float(lat), float(lon)
    except (TypeError, ValueError):
        return None


def in_viewbox(lat: float, lon: float) -> bool:
    west, north, east, south = (125.30, 7.42, 125.85, 6.88)
    return south <= lat <= north and west <= lon <= east


def in_allowed_city(hit: dict[str, Any]) -> bool:
    address = hit.get("address") or {}
    city = " ".join(
        value
        for value in (
            address.get("city"),
            address.get("town"),
            address.get("municipality"),
        )
        if value
    ).lower()
    display = (hit.get("display_name") or "").lower()
    blob = f"{city} {display}"
    coords = _hit_coords(hit)
    if coords and not in_viewbox(*coords):
        return False
    if any(name in blob for name in ALLOWED_CITIES) or city in {"davao", "panabo"}:
        return True
    if re.search(r"\bpanabo\b|\bsamal\b|\btalicud\b|\bigacos\b", blob):
        return True
    return bool(
        coords
        and re.search(r"davao del sur|davao del norte|davao region", display)
    )


def cache_hit_usable(query: str, hit: dict[str, Any]) -> bool:
    if not hit.get("lat") or not hit.get("lng"):
        return False
    display = {
        "name": hit.get("name"),
        "display_name": hit.get("display_name") or hit.get("normalized_name") or query,
        "address": hit.get("address"),
    }
    return hit_matches_query(query, display)


def _city_from_components(components: list[dict[str, Any]]) -> str:
    city = ""
    for component in components:
        types = component.get("types") or []
        name = component.get("long_name") or ""
        if "locality" in types:
            return name
        if "administrative_area_level_2" in types and not city:
            city = name
    return city


def result_from_google_geocode(hit: dict[str, Any]) -> dict[str, Any] | None:
    location = (hit.get("geometry") or {}).get("location") or {}
    if location.get("lat") is None or location.get("lng") is None:
        return None
    location_type = (hit.get("geometry") or {}).get("location_type")
    formatted = hit.get("formatted_address") or ""
    return {
        "lat": float(location["lat"]),
        "lng": float(location["lng"]),
        "lon": float(location["lng"]),
        "display_name": formatted,
        "name": formatted,
        "address": {"city": _city_from_components(hit.get("address_components") or [])},
        "confidence": "exact" if location_type == "ROOFTOP" else "approximate",
    }


def result_from_google_place(place: dict[str, Any]) -> dict[str, Any] | None:
    location = place.get("location") or {}
    if location.get("latitude") is None or location.get("longitude") is None:
        return None
    display = (place.get("displayName") or {}).get("text") or ""
    formatted = place.get("formattedAddress") or display
    return {
        "lat": float(location["latitude"]),
        "lng": float(location["longitude"]),
        "lon": float(location["longitude"]),
        "display_name": formatted,
        "name": display or formatted,
        "address": {},
        "confidence": "approximate",
    }


def _usable_result(query: str, result: dict[str, Any] | None) -> dict[str, Any] | None:
    if not result:
        return None
    if not in_allowed_city(result):
        return None
    if not hit_matches_query(query, result):
        return None
    return {
        "lat": result["lat"],
        "lng": result["lng"],
        "display_name": result.get("display_name"),
        "confidence": result.get("confidence") or "approximate",
    }


def google_geocode(client: httpx.Client, query: str) -> dict[str, Any] | None:
    if not GOOGLE_MAPS_API_KEY:
        return None
    addresses = [f"{query}, {city}, Philippines" for city in SEARCH_CITIES]
    addresses.append(f"{query}, Philippines")
    for address in addresses:
        response = client.get(
            GOOGLE_GEOCODE_URL,
            params={
                "address": address,
                "key": GOOGLE_MAPS_API_KEY,
                "region": "ph",
                "bounds": GOOGLE_BOUNDS,
                "components": "country:PH",
            },
        )
        response.raise_for_status()
        payload = response.json()
        status = payload.get("status")
        if status not in {"OK", "ZERO_RESULTS"}:
            message = payload.get("error_message") or status
            raise httpx.HTTPError(f"Google Geocoding API {status}: {message}")
        for hit in payload.get("results") or []:
            usable = _usable_result(query, result_from_google_geocode(hit))
            if usable:
                return usable
    return google_places_search(client, query)


def google_places_search(client: httpx.Client, query: str) -> dict[str, Any] | None:
    if not GOOGLE_MAPS_API_KEY:
        return None
    response = client.post(
        GOOGLE_PLACES_URL,
        headers={
            "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
            "X-Goog-FieldMask": "places.displayName,places.formattedAddress,places.location",
        },
        json={
            "textQuery": f"{query}, Davao City, Philippines",
            "maxResultCount": 5,
            "locationBias": {
                "rectangle": {
                    "low": {"latitude": 6.88, "longitude": 125.30},
                    "high": {"latitude": 7.42, "longitude": 125.85},
                }
            },
        },
    )
    if response.status_code >= 400:
        return None
    for place in response.json().get("places") or []:
        usable = _usable_result(query, result_from_google_place(place))
        if usable:
            return usable
    return None


def geocode_area(
    client: httpx.Client,
    raw_text: str,
    cache: dict[str, dict[str, Any]],
    enabled: bool,
) -> dict[str, Any]:
    query = simplify_query(raw_text)
    if query in cache:
        hit = cache[query]
        confidence = hit.get("confidence") or "failed"
        cached_ok = cache_hit_usable(query, hit) or (
            confidence in {"failed", "pending"} and hit.get("lat") is None
        )
        if cached_ok:
            return {
                "normalized_name": hit.get("display_name") or query,
                "barangay": None,
                "lat": hit.get("lat"),
                "lng": hit.get("lng"),
                "geocode_confidence": confidence,
                "cache_query": query,
            }

    barangay = match_barangay(raw_text)
    result: dict[str, Any] | None = None
    if enabled:
        try:
            result = google_geocode(client, query)
        except httpx.HTTPError:
            result = None

    if result is None and query == JP_LAUREL_QUERY:
        result = dict(JP_LAUREL_POINT)

    if result:
        cache[query] = result
        return {
            "normalized_name": query,
            "barangay": barangay["name"] if barangay else None,
            "lat": result["lat"],
            "lng": result["lng"],
            "geocode_confidence": result["confidence"],
            "cache_query": query,
            "cache_row": result,
        }

    if barangay:
        fallback = {
            "lat": barangay["lat"],
            "lng": barangay["lng"],
            "display_name": barangay["name"],
            "confidence": "barangay_centroid",
        }
        cache[query] = fallback
        return {
            "normalized_name": barangay["name"],
            "barangay": barangay["name"],
            "lat": barangay["lat"],
            "lng": barangay["lng"],
            "geocode_confidence": "barangay_centroid",
            "cache_query": query,
            "cache_row": fallback,
        }

    cache[query] = {"confidence": "failed"}
    return {
        "normalized_name": query,
        "barangay": None,
        "lat": None,
        "lng": None,
        "geocode_confidence": "failed" if enabled else "pending",
        "cache_query": query,
        "cache_row": {"confidence": "failed" if enabled else "pending"},
    }
