from __future__ import annotations

import json
import time
from datetime import datetime
from typing import Any

import httpx

from . import PARSER_VERSION
from .config import GEMINI_API_KEY, GEMINI_ENABLED, GEMINI_MODEL
from .parse import (
    TZ,
    detect_cancelled,
    detect_type,
    parse_advisory,
    sanitize_area_list,
)

GEMINI_URL = (
    "https://generativelanguage.googleapis.com/v1beta/models/"
    "{model}:generateContent"
)
AREA_RULES = """Extract only facts from the advisory text. Do not invent streets, dates, or places.

Area rules:
- Split distinct places on commas, "including", and "up to".
- Drop "nearby areas" and any trailing fluff after it unless a new sentence starts.
- Do not treat the word "crossing" as a place unless the exact name is "Matina Crossing".
- Keep "J. P. Laurel" together. Do not split on the periods in that name.
- Omit generic phrases like "some parts of Davao City" or "customers".

Windows:
- Use Asia/Manila ISO 8601 datetimes with offset +08:00.
- Overnight ranges may cross midnight.
- If a date has no time, use 00:00:00+08:00 to the next midnight.
- Create one window per distinct time range.
- Attach each place only to the window whose sentence or paragraph names that time.
- Every window must have its own areas array. Do not leave it empty if the text names places for that time.
- Do not copy the full street list onto every window.

Types: scheduled, emergency, switching, or unspecified.
"""

RESPONSE_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "type": {
            "type": "STRING",
            "enum": ["scheduled", "emergency", "switching", "unspecified"],
        },
        "is_cancelled": {"type": "BOOLEAN"},
        "reason": {"type": "STRING"},
        "windows": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "start_at": {"type": "STRING"},
                    "end_at": {"type": "STRING"},
                    "raw_date_text": {"type": "STRING"},
                    "areas": {"type": "ARRAY", "items": {"type": "STRING"}},
                },
                "required": ["start_at", "end_at", "raw_date_text", "areas"],
            },
        },
    },
    "required": ["type", "is_cancelled", "windows"],
}


def _normalize_iso(value: str) -> str | None:
    if not value or not isinstance(value, str):
        return None
    cleaned = value.strip().replace("Z", "+00:00")
    try:
        parsed = datetime.fromisoformat(cleaned)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=TZ)
    return parsed.astimezone(TZ).isoformat()


def _windows_from_gemini(items: list[Any]) -> list[dict[str, Any]]:
    windows: list[dict[str, Any]] = []
    seen: set[tuple[str, str, str]] = set()
    for item in items:
        if not isinstance(item, dict):
            continue
        start = _normalize_iso(str(item.get("start_at") or ""))
        end = _normalize_iso(str(item.get("end_at") or ""))
        raw = " ".join(str(item.get("raw_date_text") or "").split())
        if not start or not end:
            continue
        key = (start, end, raw)
        if key in seen:
            continue
        seen.add(key)
        areas = sanitize_area_list(
            [str(item) for item in (item.get("areas") or [])]
        )
        windows.append(
            {
                "start_at": start,
                "end_at": end,
                "raw_date_text": raw or start,
                "areas": areas,
            }
        )
    return windows


def _area_rows_from_payload(
    windows: list[dict[str, Any]],
    shared: list[Any],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    area_rows: list[dict[str, Any]] = []
    clean_windows: list[dict[str, Any]] = []
    seen_pair: set[tuple[int, str]] = set()
    on_a_window: set[str] = set()
    nested = False
    for index, window in enumerate(windows):
        window_areas = window.pop("areas", [])
        clean_windows.append(window)
        for area in window_areas:
            nested = True
            key = area["raw_text"].lower()
            pair = (index, key)
            if pair in seen_pair:
                continue
            seen_pair.add(pair)
            on_a_window.add(key)
            area_rows.append({**area, "window_index": index})
    extras = sanitize_area_list([str(item) for item in shared])
    if not extras:
        return clean_windows, area_rows
    if nested:
        for area in extras:
            key = area["raw_text"].lower()
            if key in on_a_window:
                continue
            on_a_window.add(key)
            area_rows.append({**area, "window_index": None})
        return clean_windows, area_rows
    fallback_index = 0 if len(clean_windows) == 1 else None
    for area in extras:
        key = area["raw_text"].lower()
        if key in on_a_window:
            continue
        on_a_window.add(key)
        area_rows.append({**area, "window_index": fallback_index})
    return clean_windows, area_rows


def advisory_from_gemini(
    title: str,
    raw_text: str,
    source_url: str,
    payload: dict[str, Any],
) -> dict[str, Any]:
    windows, area_rows = _area_rows_from_payload(
        _windows_from_gemini(payload.get("windows") or []),
        payload.get("areas") or [],
    )
    cancelled = bool(payload.get("is_cancelled")) or detect_cancelled(title, raw_text)
    reason = str(payload.get("reason") or "").strip() or None
    kind = payload.get("type")
    if kind not in {"scheduled", "emergency", "switching", "unspecified"}:
        kind = detect_type(title, raw_text)
    if windows and area_rows:
        confidence = "high"
    elif windows or area_rows:
        confidence = "low"
    else:
        confidence = "failed"
    parsed = {
        "title": title,
        "type": kind,
        "status": "cancelled" if cancelled else "upcoming",
        "dates": windows,
        "areas": [area["raw_text"] for area in area_rows],
        "reason": reason,
        "source_url": source_url,
        "is_cancelled_by_source": cancelled,
        "parse_confidence": confidence,
        "parser_version": PARSER_VERSION,
    }
    return {**parsed, "windows": windows, "area_rows": area_rows}


def _extract_json(data: dict[str, Any]) -> dict[str, Any]:
    parts = (
        data.get("candidates")
        or [{}]
    )[0].get("content", {}).get("parts") or []
    text = "".join(part.get("text") or "" for part in parts if isinstance(part, dict))
    if not text:
        raise ValueError("Gemini returned no text")
    parsed = json.loads(text)
    if not isinstance(parsed, dict):
        raise ValueError("Gemini JSON was not an object")
    return parsed


def call_gemini(client: httpx.Client, title: str, raw_text: str) -> dict[str, Any]:
    prompt = (
        f"{AREA_RULES}\n\nTITLE:\n{title}\n\nADVISORY:\n{raw_text}\n"
    )
    url = GEMINI_URL.format(model=GEMINI_MODEL)
    body = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.1,
            "responseMimeType": "application/json",
            "responseSchema": RESPONSE_SCHEMA,
            "thinkingConfig": {"thinkingBudget": 1024},
        },
    }
    headers = {"x-goog-api-key": GEMINI_API_KEY}
    response = client.post(url, headers=headers, json=body, timeout=60.0)
    if response.status_code >= 400:
        body["generationConfig"].pop("thinkingConfig", None)
        response = client.post(url, headers=headers, json=body, timeout=60.0)
    for attempt in range(4):
        if response.status_code != 429:
            break
        time.sleep(12 * (attempt + 1))
        response = client.post(url, headers=headers, json=body, timeout=60.0)
    response.raise_for_status()
    return _extract_json(response.json())


def parse_with_gemini_or_fallback(
    client: httpx.Client,
    title: str,
    raw_text: str,
    source_url: str,
    published_at: str | None = None,
) -> dict[str, Any]:
    if GEMINI_ENABLED and GEMINI_API_KEY:
        try:
            payload = call_gemini(client, title, raw_text)
            parsed = advisory_from_gemini(title, raw_text, source_url, payload)
            if parsed["parse_confidence"] != "failed":
                return parsed
        except (httpx.HTTPError, ValueError, json.JSONDecodeError, KeyError, TypeError) as exc:
            status = getattr(getattr(exc, "response", None), "status_code", None)
            detail = f"{type(exc).__name__}" + (f" {status}" if status else "")
            print(f"Gemini parse failed ({detail}); using regex fallback.")
    return parse_advisory(title, raw_text, source_url, published_at)
