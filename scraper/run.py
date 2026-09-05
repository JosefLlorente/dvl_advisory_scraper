from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone

import httpx

from .config import GEOCODE_ENABLED, LISTING_URLS, MANUALS_DIR, SUPABASE_SERVICE_ROLE_KEY
from .discover import discover_posts
from .fetch import build_client, fetch_html, parse_post
from .geocode import geocode_area
from .manual import parse_manual_file
from .parse import parse_advisory
from . import PARSER_VERSION


def _geocode_parsed(
    http_client: httpx.Client,
    parsed: dict,
    cache: dict,
    enabled: bool,
) -> tuple[dict, int]:
    failures = 0
    geocoded = []
    for area in parsed["area_rows"]:
        result = geocode_area(http_client, area["raw_text"], cache, enabled)
        if result["geocode_confidence"] in {"failed", "pending"}:
            failures += 1
        geocoded.append({**area, **result})
    parsed["geocoded_areas"] = geocoded
    return parsed, failures


def run_scrape(write: bool, manuals_only: bool, limit: int | None) -> dict:
    stats = {
        "discovered": 0,
        "inserted": 0,
        "updated": 0,
        "parse_failures": 0,
        "geocode_failures": 0,
        "notes": f"parser_version={PARSER_VERSION}",
        "finished_at": None,
    }

    store = None
    db = None
    cache: dict = {}
    known: set[str] = set()
    stale: set[str] = set()
    if write:
        from . import store as store_mod

        store = store_mod
        db = store.get_client()
        cache = store.load_geocode_cache(db)
        known = store.existing_urls(db)
        stale = store.urls_needing_reparse(db)
        run_id = store.start_run(db)
    else:
        run_id = None

    http_client = build_client()
    try:
        posts: list[dict] = []
        if not manuals_only:
            for url in LISTING_URLS:
                html = fetch_html(http_client, url)
                posts.extend(discover_posts(html))

        unique: dict[str, dict] = {}
        for post in posts:
            unique[post["source_url"]] = post
        posts = list(unique.values())
        if limit:
            posts = posts[:limit]
        stats["discovered"] = len(posts)

        new_posts = [post for post in posts if post["source_url"] not in known]
        if write and not manuals_only and not new_posts and not posts:
            stats["notes"] += "; no keyword-matching titles"
            return stats

        targets = (
            posts
            if not write
            else [
                post
                for post in posts
                if post["source_url"] not in known or post["source_url"] in stale
            ]
        )
        if write and not targets and not manuals_only:
            stats["notes"] += "; no new keyword-matching titles"
        else:
            for post in targets:
                fetched = parse_post(
                    fetch_html(http_client, post["source_url"]),
                    post["source_url"],
                )
                parsed = parse_advisory(
                    fetched["title"],
                    fetched["raw_text"],
                    fetched["source_url"],
                    fetched.get("published_at"),
                )
                parsed, geo_fail = _geocode_parsed(
                    http_client, parsed, cache, GEOCODE_ENABLED and write
                )
                stats["geocode_failures"] += geo_fail
                if parsed["parse_confidence"] == "failed":
                    stats["parse_failures"] += 1
                    if write and db and store:
                        store.log_parse_failure(
                            db,
                            fetched["source_url"],
                            fetched["raw_text"],
                            "date/time or affected-area patterns not found",
                        )
                if write and db and store:
                    action = store.upsert_advisory(db, fetched, parsed)
                    stats[action] += 1
                    if parsed["is_cancelled_by_source"]:
                        related = store.find_related_advisory(db, fetched["title"])
                        if related:
                            store.mark_cancelled(db, related["source_url"])
                    for area in parsed["geocoded_areas"]:
                        if area.get("cache_row"):
                            store.upsert_geocode_cache(
                                db, area["cache_query"], area["cache_row"]
                            )
                else:
                    print(json.dumps(parsed["parsed_json"] if "parsed_json" in parsed else {
                        "title": parsed["title"],
                        "type": parsed["type"],
                        "status": parsed["status"],
                        "dates": parsed["dates"],
                        "areas": parsed["areas"],
                        "reason": parsed["reason"],
                        "source_url": parsed["source_url"],
                        "parse_confidence": parsed["parse_confidence"],
                    }, indent=2))

        if MANUALS_DIR.exists():
            for path in sorted(MANUALS_DIR.glob("*.md")):
                if path.name.lower() == "readme.md":
                    continue
                manual = parse_manual_file(path)
                parsed = manual["parsed"]
                parsed, geo_fail = _geocode_parsed(
                    http_client, parsed, cache, GEOCODE_ENABLED and write
                )
                stats["geocode_failures"] += geo_fail
                if write and db and store:
                    action = store.upsert_advisory(
                        db,
                        {
                            "source_url": manual["source_url"],
                            "title": manual["title"],
                            "raw_html": None,
                            "raw_text": manual["raw_text"],
                            "published_at": manual.get("published_at"),
                        },
                        parsed,
                    )
                    stats[action] += 1
                else:
                    print(json.dumps({
                        "title": parsed["title"],
                        "type": parsed["type"],
                        "dates": parsed["dates"],
                        "areas": parsed["areas"],
                        "parse_confidence": parsed["parse_confidence"],
                        "source_url": parsed["source_url"],
                    }, indent=2))
    finally:
        http_client.close()
        if write and db and store and run_id:
            stats["finished_at"] = datetime.now(timezone.utc).isoformat()
            store.finish_run(db, run_id, stats)

    return stats


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Scrape Davao Light service advisories")
    parser.add_argument("--dry-run", action="store_true", help="Parse and print JSON, do not write")
    parser.add_argument("--manuals-only", action="store_true")
    parser.add_argument("--limit", type=int, default=None)
    args = parser.parse_args(argv)
    write = not args.dry_run
    if write and not SUPABASE_SERVICE_ROLE_KEY:
        print("No SUPABASE_SERVICE_ROLE_KEY; running as dry-run.")
        write = False
    stats = run_scrape(
        write=write,
        manuals_only=args.manuals_only,
        limit=args.limit,
    )
    print(json.dumps(stats, indent=2, default=str))
    return 0
