from __future__ import annotations

import csv
import re
import time
from functools import lru_cache
from typing import Any

import httpx

from . import USER_AGENT
from .config import BARANGAY_CSV

JP_LAUREL = re.compile(r"j\.?\s*p\.?\s*laurel", re.IGNORECASE)
JP_LAUREL_QUERY = "J.P. Laurel Avenue"
JP_LAUREL_POINT = {
    "lat": 7.0942,
    "lng": 125.6178,
    "display_name": "J.P. Laurel Avenue",
    "confidence": "exact",
}


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


def match_barangay(raw_text: str) -> dict[str, Any] | None:
    haystack = _normalize(raw_text)
    best = None
    for row in load_barangays():
        if row["key"] and row["key"] in haystack:
            if best is None or len(row["key"]) > len(best["key"]):
                best = row
    return best


def simplify_query(raw_text: str) -> str:
    if JP_LAUREL.search(raw_text):
        return JP_LAUREL_QUERY
    text = re.sub(r"\balong\b.*$", "", raw_text, flags=re.IGNORECASE)
    text = re.sub(r"\bgoing to\b.*$", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\bfrom\b.*?\bto\b", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\bnearby areas\b", "", text, flags=re.IGNORECASE)
    cleaned = re.sub(r"\s+", " ", text).strip()
    return cleaned or raw_text


def nominatim_search(client: httpx.Client, query: str) -> dict[str, Any] | None:
    response = client.get(
        "https://nominatim.openstreetmap.org/search",
        params={
            "q": f"{query}, Davao City, Philippines",
            "format": "json",
            "limit": 1,
            "countrycodes": "ph",
        },
        headers={"User-Agent": USER_AGENT, "Referer": "https://www.davaolight.com"},
    )
    response.raise_for_status()
    time.sleep(1)
    results = response.json()
    if not results:
        return None
    first = results[0]
    return {
        "lat": float(first["lat"]),
        "lng": float(first["lon"]),
        "display_name": first.get("display_name"),
        "confidence": "exact" if first.get("class") == "place" else "approximate",
    }


def geocode_area(
    client: httpx.Client,
    raw_text: str,
    cache: dict[str, dict[str, Any]],
    enabled: bool,
) -> dict[str, Any]:
    query = simplify_query(raw_text)
    if query in cache:
        hit = cache[query]
        return {
            "normalized_name": hit.get("display_name") or query,
            "barangay": None,
            "lat": hit.get("lat"),
            "lng": hit.get("lng"),
            "geocode_confidence": hit.get("confidence") or "failed",
            "cache_query": query,
        }

    barangay = match_barangay(raw_text)
    result: dict[str, Any] | None = None
    if enabled:
        try:
            result = nominatim_search(client, query)
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
