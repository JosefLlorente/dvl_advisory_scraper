from __future__ import annotations

import json
from collections import defaultdict

import httpx

from .config import GEOCODE_ENABLED
from .fetch import build_client
from .geocode import geocode_area
from .store import get_client, upsert_geocode_cache


def regeocode_stored_areas(http_client: httpx.Client) -> dict[str, int]:
    db = get_client()
    rows = (
        db.table("affected_areas")
        .select("id, advisory_id, raw_text, created_at")
        .order("created_at")
        .execute()
        .data
        or []
    )
    grouped: dict[str, list[dict]] = defaultdict(list)
    for row in rows:
        grouped[row["advisory_id"]].append(row)

    cache: dict = {}
    updated = 0
    failed = 0
    looked_up = 0

    for areas in grouped.values():
        last_located = None
        for area in areas:
            before = len(cache)
            result = geocode_area(http_client, area["raw_text"], cache, True)
            if len(cache) > before:
                looked_up += 1
            if result.get("cache_row"):
                upsert_geocode_cache(db, result["cache_query"], result["cache_row"])
            if result["geocode_confidence"] in {"failed", "pending"}:
                failed += 1
                if result.get("lat") is None and last_located:
                    result = {
                        **result,
                        "lat": last_located["lat"],
                        "lng": last_located["lng"],
                    }
            db.table("affected_areas").update(
                {
                    "normalized_name": result.get("normalized_name"),
                    "barangay": result.get("barangay"),
                    "lat": result.get("lat"),
                    "lng": result.get("lng"),
                    "geocode_confidence": result.get("geocode_confidence") or "failed",
                }
            ).eq("id", area["id"]).execute()
            updated += 1
            if result.get("lat") is not None and result.get("lng") is not None:
                last_located = result

    return {
        "areas": len(rows),
        "updated": updated,
        "looked_up": looked_up,
        "geocode_failures": failed,
    }


def main() -> int:
    if not GEOCODE_ENABLED:
        print("GEOCODE_ENABLED is false; nothing to do.")
        return 1
    http_client = build_client()
    try:
        stats = regeocode_stored_areas(http_client)
    finally:
        http_client.close()
    print(json.dumps(stats, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
