from __future__ import annotations

from typing import Any

from supabase import Client, create_client

from . import PARSER_VERSION
from .config import SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL
from .parse import should_replace


def get_client() -> Client:
    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise RuntimeError(
            "SUPABASE_URL and SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) are required to write advisories."
        )
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


def existing_urls(client: Client) -> set[str]:
    return set(existing_listings(client))


def existing_listings(client: Client) -> dict[str, dict[str, Any]]:
    result = client.table("advisories").select("id, source_url, title, raw_text").execute()
    return {row["source_url"]: row for row in result.data or []}


def urls_needing_reparse(client: Client) -> set[str]:
    result = client.table("advisories").select("source_url, parser_version").execute()
    return {
        row["source_url"]
        for row in result.data or []
        if (row.get("parser_version") or 0) < PARSER_VERSION
    }


def load_geocode_cache(client: Client) -> dict[str, dict[str, Any]]:
    result = client.table("geocode_cache").select("*").execute()
    return {row["query"]: row for row in result.data or []}


def upsert_geocode_cache(client: Client, query: str, row: dict[str, Any]) -> None:
    client.table("geocode_cache").upsert(
        {
            "query": query,
            "lat": row.get("lat"),
            "lng": row.get("lng"),
            "display_name": row.get("display_name"),
            "confidence": row.get("confidence") or "failed",
        }
    ).execute()


def log_parse_failure(client: Client, source_url: str, raw_text: str, error: str) -> None:
    client.table("parse_failures").insert(
        {"source_url": source_url, "raw_text": raw_text, "error": error}
    ).execute()


def start_run(client: Client) -> str:
    result = client.table("scrape_runs").insert({}).execute()
    return result.data[0]["id"]


def finish_run(client: Client, run_id: str, stats: dict[str, Any]) -> None:
    client.table("scrape_runs").update(stats).eq("id", run_id).execute()


def mark_cancelled(client: Client, source_url: str) -> None:
    client.table("advisories").update({"is_cancelled_by_source": True}).eq(
        "source_url", source_url
    ).execute()


def find_related_advisory(client: Client, title: str) -> dict[str, Any] | None:
    needle = title.lower()
    for prefix in ("cancelled:", "canceled:", "[updated]", "updated:"):
        needle = needle.replace(prefix, "")
    needle = " ".join(needle.split())
    result = client.table("advisories").select("id, source_url, title").execute()
    for row in result.data or []:
        other = row["title"].lower()
        for prefix in ("cancelled:", "canceled:", "[updated]", "updated:"):
            other = other.replace(prefix, "")
        other = " ".join(other.split())
        if other and other == needle and "cancell" not in row["title"].lower():
            return row
    return None


def match_window_rows(
    parsed_windows: list[dict[str, Any]],
    fetched: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    remaining = list(fetched)
    matched: list[dict[str, Any]] = []
    for window in parsed_windows:
        hit = next(
            (
                row
                for row in remaining
                if row.get("start_at") == window["start_at"]
                and row.get("end_at") == window["end_at"]
            ),
            None,
        )
        if hit:
            remaining.remove(hit)
            matched.append(hit)
        elif remaining:
            matched.append(remaining.pop(0))
    return matched


def window_id_for_area(
    area: dict[str, Any],
    window_rows: list[dict[str, Any]],
) -> str | None:
    index = area.get("window_index")
    if isinstance(index, int) and 0 <= index < len(window_rows):
        return window_rows[index]["id"]
    return None


def upsert_advisory(client: Client, fetched: dict[str, Any], parsed: dict[str, Any]) -> str:
    existing = (
        client.table("advisories")
        .select("id, raw_text, parse_confidence, parser_version, revision")
        .eq("source_url", fetched["source_url"])
        .limit(1)
        .execute()
    )
    row = existing.data[0] if existing.data else None
    payload = {
        "source_url": fetched["source_url"],
        "title": fetched["title"],
        "raw_html": fetched.get("raw_html"),
        "raw_text": fetched["raw_text"],
        "parsed_json": {
            "title": parsed["title"],
            "type": parsed["type"],
            "status": parsed["status"],
            "dates": parsed["dates"],
            "areas": parsed["areas"],
            "reason": parsed["reason"],
            "source_url": parsed["source_url"],
        },
        "advisory_type": parsed["type"],
        "status": parsed["status"],
        "is_cancelled_by_source": parsed["is_cancelled_by_source"],
        "reason": parsed["reason"],
        "published_at": fetched.get("published_at"),
        "parse_confidence": parsed["parse_confidence"],
        "parser_version": PARSER_VERSION,
    }

    replace_children = True
    if row:
        payload["revision"] = row["revision"] + (
            1 if row["raw_text"] != fetched["raw_text"] else 0
        )
        replace_children = should_replace(
            row["parse_confidence"], parsed["parse_confidence"]
        ) or (row.get("parser_version") or 0) < PARSER_VERSION
        if not replace_children:
            payload.pop("parse_confidence")
            payload.pop("parsed_json")
            payload.pop("advisory_type")
            payload.pop("status")
            payload.pop("reason")
        result = (
            client.table("advisories").update(payload).eq("id", row["id"]).execute()
        )
        advisory_id = row["id"]
        action = "updated"
    else:
        result = client.table("advisories").insert(payload).execute()
        advisory_id = result.data[0]["id"]
        action = "inserted"

    if replace_children:
        client.table("affected_areas").delete().eq("advisory_id", advisory_id).execute()
        client.table("outage_windows").delete().eq("advisory_id", advisory_id).execute()
        window_rows: list[dict[str, Any]] = []
        if parsed["windows"]:
            inserted = client.table("outage_windows").insert(
                [
                    {
                        "advisory_id": advisory_id,
                        "start_at": window["start_at"],
                        "end_at": window["end_at"],
                        "raw_date_text": window["raw_date_text"],
                    }
                    for window in parsed["windows"]
                ]
            ).execute()
            window_rows = inserted.data or []
            if len(window_rows) != len(parsed["windows"]):
                fetched = (
                    client.table("outage_windows")
                    .select("id, start_at, end_at, raw_date_text")
                    .eq("advisory_id", advisory_id)
                    .execute()
                    .data
                    or []
                )
                window_rows = match_window_rows(parsed["windows"], fetched)
        if parsed.get("geocoded_areas"):
            area_rows = [
                {
                    "advisory_id": advisory_id,
                    "window_id": window_id_for_area(area, window_rows),
                    "raw_text": area["raw_text"],
                    "normalized_name": area.get("normalized_name"),
                    "barangay": area.get("barangay"),
                    "lat": area.get("lat"),
                    "lng": area.get("lng"),
                    "geocode_confidence": area.get("geocode_confidence") or "pending",
                }
                for area in parsed["geocoded_areas"]
            ]
            try:
                client.table("affected_areas").insert(area_rows).execute()
            except Exception as exc:
                if "window_id" not in str(exc).lower():
                    raise
                for row in area_rows:
                    row.pop("window_id", None)
                client.table("affected_areas").insert(area_rows).execute()

    return action
