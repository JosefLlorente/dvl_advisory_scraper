from __future__ import annotations

import json
import time

from .config import GEOCODE_ENABLED
from .fetch import build_client
from .gemini_parse import parse_with_gemini_or_fallback
from .run import _geocode_parsed
from .store import get_client, load_geocode_cache, upsert_advisory, upsert_geocode_cache


def reparse_stored_advisories() -> dict[str, int]:
    db = get_client()
    rows = (
        db.table("advisories")
        .select("source_url, title, raw_text, raw_html, published_at")
        .execute()
        .data
        or []
    )
    cache = load_geocode_cache(db)

    http_client = build_client()
    stats = {"advisories": len(rows), "updated": 0, "parse_failures": 0, "geocode_failures": 0}
    try:
        for row in rows:
            parsed = parse_with_gemini_or_fallback(
                http_client,
                row["title"],
                row["raw_text"],
                row["source_url"],
                row.get("published_at"),
            )
            parsed, geo_fail = _geocode_parsed(
                http_client, parsed, cache, GEOCODE_ENABLED
            )
            stats["geocode_failures"] += geo_fail
            if parsed["parse_confidence"] == "failed":
                stats["parse_failures"] += 1
            upsert_advisory(
                db,
                {
                    "source_url": row["source_url"],
                    "title": row["title"],
                    "raw_html": row.get("raw_html"),
                    "raw_text": row["raw_text"],
                    "published_at": row.get("published_at"),
                },
                parsed,
            )
            for area in parsed.get("geocoded_areas") or []:
                if area.get("cache_row"):
                    upsert_geocode_cache(db, area["cache_query"], area["cache_row"])
            stats["updated"] += 1
            time.sleep(4.0)
    finally:
        http_client.close()
    return stats


def main() -> int:
    print(json.dumps(reparse_stored_advisories(), indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
