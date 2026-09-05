from __future__ import annotations

import re
from datetime import datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from dateutil import parser as date_parser

from . import PARSER_VERSION

TZ = ZoneInfo("Asia/Manila")
CONFIDENCE_RANK = {"failed": 0, "low": 1, "high": 2, "manual": 3}

MONTH = r"January|February|March|April|May|June|July|August|September|October|November|December"
TIME = r"\d{1,2}(?::\d{2})?\s*(?:a\.m\.|p\.m\.|am|pm|noon|midnight)"
WEEKDAY = r"Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday"

DATE_PHRASE = rf"(?:(?:{WEEKDAY}),?\s+)?(?:{MONTH})\s+\d{{1,2}}(?:st|nd|rd|th)?(?:,?\s+20\d{{2}})?"

RANGE_FROM_TO = re.compile(
    rf"from\s+(?P<start>{TIME})\s+to\s+(?P<end>{TIME})(?:\s+on\s+(?P<date>{DATE_PHRASE}))?",
    re.IGNORECASE,
)
RANGE_BETWEEN = re.compile(
    rf"(?:at any time\s+)?between\s+(?P<start>{TIME})\s+and\s+(?P<end>{TIME})(?:\s+on\s+(?P<date>{DATE_PHRASE}))?",
    re.IGNORECASE,
)
OVERNIGHT = re.compile(
    rf"from\s+(?P<start>{TIME})\s+on\s+(?P<start_date>{DATE_PHRASE}),?\s+to\s+(?P<end>{TIME})\s+on\s+(?P<end_date>{DATE_PHRASE})",
    re.IGNORECASE,
)
MULTI_DAY = re.compile(
    rf"(?:on\s+)?(?:{WEEKDAY}s?\s+and\s+{WEEKDAY}s?,?\s+)?(?P<month>{MONTH})\s+(?P<d1>\d{{1,2}})\s+and\s+(?P<d2>\d{{1,2}})(?:,?\s+(?P<year>20\d{{2}}))?",
    re.IGNORECASE,
)
RANGE_DAYS = re.compile(
    rf"(?P<month>{MONTH})\s+(?P<d1>\d{{1,2}}),?\s+(?:to|until|through)\s+(?:(?:{WEEKDAY}),\s+)?(?:(?P<month2>{MONTH})\s+)?(?P<d2>\d{{1,2}})(?:,?\s+(?P<year>20\d{{2}}))?",
    re.IGNORECASE,
)
SINGLE_DATE = re.compile(
    rf"(?:on\s+)?(?P<date>{DATE_PHRASE})",
    re.IGNORECASE,
)
YEAR = re.compile(r"20\d{2}")
DURATION_HOURS = re.compile(
    r"(?:an?\s+)?(?P<words>one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|\d+)[-\s]hour",
    re.IGNORECASE,
)
STARTING_BETWEEN = re.compile(
    rf"(?P<hours>\d+)\s+hours?\s+starting at any time between\s+(?P<start>{TIME})\s+and\s+(?P<end>{TIME})",
    re.IGNORECASE,
)
REASON = re.compile(
    r"(?:to facilitate|necessary to(?: facilitate)?|due to|for )\s+([^.]{8,180})",
    re.IGNORECASE,
)
AREA_LEADIN = re.compile(
    r"(?:specifically affected are(?: customers)?(?: from| in)?|"
    r"also affected are(?: those)?(?: from| in)?|"
    r"affecting customers(?: from| in)?|"
    r"affecting a portion of|"
    r"affecting portions of|"
    r"customers from|customers in)\s+",
    re.IGNORECASE,
)
CLAUSE_SPLIT = re.compile(r"\s*;\s*")
INCLUDING_SPLIT = re.compile(r"\s+including\s+", re.IGNORECASE)
UP_TO_SPLIT = re.compile(r"\s+up to\s+", re.IGNORECASE)
NEARBY_AREAS = re.compile(r"\bnearby areas\b", re.IGNORECASE)
MATINA_CROSSING = re.compile(r"\bMatina Crossing\b", re.IGNORECASE)
CROSSING_WORD = re.compile(r"\bcrossing\b", re.IGNORECASE)
LEADING_AREA_JUNK = re.compile(
    r"^(?:and|those|from|in|to|of)\s+",
    re.IGNORECASE,
)
TRAILING_AREA_JUNK = re.compile(r"\s+(?:and|those)$", re.IGNORECASE)

WORD_HOURS = {
    "one": 1,
    "two": 2,
    "three": 3,
    "four": 4,
    "five": 5,
    "six": 6,
    "seven": 7,
    "eight": 8,
    "nine": 9,
    "ten": 10,
    "eleven": 11,
    "twelve": 12,
}

APOLOGY_START = re.compile(r"Davao Light apologizes", re.IGNORECASE)
JP_LAUREL = re.compile(r"J\.?\s*P\.?\s*Laurel", re.IGNORECASE)
JP_LAUREL_TOKEN = "JP Laurel"


def _clean(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def _year_from_text(text: str, published_at: str | None) -> int:
    years = YEAR.findall(text)
    if years:
        return int(years[0])
    if published_at:
        try:
            return date_parser.isoparse(published_at).year
        except (ValueError, TypeError):
            pass
    return datetime.now(TZ).year


def _parse_time(value: str, day: datetime) -> datetime:
    value = value.strip().lower()
    if value == "noon":
        return day.replace(hour=12, minute=0, second=0, microsecond=0)
    if value == "midnight":
        return day.replace(hour=0, minute=0, second=0, microsecond=0)
    parsed = date_parser.parse(value.replace(".", ""), default=day, fuzzy=True)
    return parsed.replace(tzinfo=TZ)


def _parse_date(value: str, year: int) -> datetime | None:
    cleaned = re.sub(r"(\d+)(?:st|nd|rd|th)\b", r"\1", value, flags=re.IGNORECASE)
    cleaned = re.sub(rf"^(?:{WEEKDAY}),?\s+", "", cleaned, flags=re.IGNORECASE)
    if not YEAR.search(cleaned):
        cleaned = f"{cleaned}, {year}"
    try:
        parsed = date_parser.parse(cleaned, fuzzy=False)
        return datetime(parsed.year, parsed.month, parsed.day, tzinfo=TZ)
    except (ValueError, TypeError, OverflowError):
        return None


def detect_type(title: str, body: str) -> str:
    title_l = title.lower()
    body_l = body.lower()
    if "emergency" in title_l:
        return "emergency"
    if "switching" in title_l or "switching" in body_l:
        return "switching"
    if "emergency" in body_l:
        return "emergency"
    if "scheduled" in title_l or "scheduled" in body_l or "interruption" in f"{title_l} {body_l}":
        return "scheduled"
    return "unspecified"


def detect_cancelled(title: str, body: str) -> bool:
    blob = f"{title} {body}"
    return bool(re.search(r"\bcancell?ed\b", blob, re.IGNORECASE))


def _duration_hours(text: str, default: int | None = None) -> int | None:
    duration = DURATION_HOURS.search(text)
    if not duration:
        return default
    token = duration.group("words").lower()
    if token.isdigit():
        return int(token)
    return WORD_HOURS.get(token, default)


def extract_reason(text: str) -> str | None:
    match = REASON.search(text)
    if not match:
        return None
    return _clean(match.group(1)).rstrip(",")


def _strip_crossing(piece: str) -> str:
    token = "MATINA_CROSSING"
    protected = MATINA_CROSSING.sub(token, piece)
    protected = CROSSING_WORD.sub(" ", protected)
    protected = protected.replace(token, "Matina Crossing")
    protected = re.sub(r"\bthe\s+of\b", " ", protected, flags=re.IGNORECASE)
    return _clean(protected)


def _truncate_nearby_areas(clause: str) -> str:
    match = NEARBY_AREAS.search(clause)
    if not match:
        return clause
    after = clause[match.end() :]
    if re.match(r"\s*\.", after):
        return _clean(clause[: match.start()] + re.sub(r"^\s*\.", " ", after))
    return _clean(clause[: match.start()])


def _normalize_area_piece(part: str) -> str:
    piece = _clean(re.sub(r"^[,.\s]+|[,.\s]+$", "", part))
    piece = LEADING_AREA_JUNK.sub("", piece)
    piece = _strip_crossing(piece)
    piece = LEADING_AREA_JUNK.sub("", piece)
    piece = TRAILING_AREA_JUNK.sub("", piece)
    piece = JP_LAUREL.sub("J. P. Laurel", piece)
    piece = piece.replace(JP_LAUREL_TOKEN, "J. P. Laurel")
    return _clean(piece)


def _is_valid_area(piece: str) -> bool:
    return 4 <= len(piece) <= 220 and piece.lower() not in {
        "nearby areas",
        "this service disruption",
        "customers",
    }


def extract_area_rows(text: str) -> list[dict[str, Any]]:
    body = APOLOGY_START.split(text, maxsplit=1)[0]
    body = JP_LAUREL.sub(JP_LAUREL_TOKEN, body)
    rows: list[dict[str, Any]] = []
    seen: set[str] = set()
    for match in AREA_LEADIN.finditer(body):
        rest = body[match.end() :]
        cutoff = re.split(r"(?:\.|Davao Light apologizes)", rest, maxsplit=1)[0]
        for clause in CLAUSE_SPLIT.split(cutoff):
            clause = _truncate_nearby_areas(clause)
            if not clause:
                continue
            for index, chunk in enumerate(INCLUDING_SPLIT.split(clause)):
                included = index > 0
                for up_to_part in UP_TO_SPLIT.split(chunk):
                    for part in re.split(r",\s*", up_to_part):
                        piece = _normalize_area_piece(part)
                        key = piece.lower()
                        if _is_valid_area(piece) and key not in seen:
                            seen.add(key)
                            rows.append({"raw_text": piece, "included": included})
    return rows


def extract_areas(text: str) -> list[str]:
    return [row["raw_text"] for row in extract_area_rows(text)]


def _windows_from_match(
    start_text: str,
    end_text: str,
    dates: list[datetime],
    raw: str,
) -> list[dict[str, Any]]:
    windows = []
    for day in dates:
        start = _parse_time(start_text, day)
        end = _parse_time(end_text, day)
        if end <= start:
            end = end + timedelta(days=1)
        windows.append(
            {
                "start_at": start.isoformat(),
                "end_at": end.isoformat(),
                "raw_date_text": _clean(raw),
            }
        )
    return windows


def extract_windows(text: str, published_at: str | None = None) -> list[dict[str, Any]]:
    year = _year_from_text(text, published_at)
    windows: list[dict[str, Any]] = []
    used_spans: list[tuple[int, int]] = []

    def mark(span: tuple[int, int]) -> None:
        used_spans.append(span)

    def overlaps(span: tuple[int, int]) -> bool:
        return any(not (span[1] <= start or span[0] >= end) for start, end in used_spans)

    for match in OVERNIGHT.finditer(text):
        start_day = _parse_date(match.group("start_date"), year)
        end_day = _parse_date(match.group("end_date"), year)
        if not start_day or not end_day:
            continue
        start = _parse_time(match.group("start"), start_day)
        end = _parse_time(match.group("end"), end_day)
        if end <= start:
            end = end + timedelta(days=1)
        windows.append(
            {
                "start_at": start.isoformat(),
                "end_at": end.isoformat(),
                "raw_date_text": _clean(match.group(0)),
            }
        )
        mark(match.span())

    for match in STARTING_BETWEEN.finditer(text):
        if overlaps(match.span()):
            continue
        hours = int(match.group("hours"))
        nearby = text[max(0, match.start() - 80) : match.end() + 80]
        date_match = SINGLE_DATE.search(nearby)
        day = _parse_date(date_match.group("date"), year) if date_match else None
        if not day:
            continue
        start = _parse_time(match.group("start"), day)
        latest_start = _parse_time(match.group("end"), day)
        if latest_start <= start:
            latest_start = latest_start + timedelta(days=1)
        end = latest_start + timedelta(hours=hours)
        windows.append(
            {
                "start_at": start.isoformat(),
                "end_at": end.isoformat(),
                "raw_date_text": _clean(match.group(0)),
            }
        )
        mark(match.span())

    for pattern in (RANGE_FROM_TO, RANGE_BETWEEN):
        for match in pattern.finditer(text):
            if overlaps(match.span()):
                continue
            date_text = match.groupdict().get("date")
            dates: list[datetime] = []
            if date_text:
                parsed = _parse_date(date_text, year)
                if parsed:
                    dates = [parsed]
            else:
                nearby = text[max(0, match.start() - 160) : match.end() + 120]
                multi = MULTI_DAY.search(nearby)
                if multi:
                    month = multi.group("month")
                    y = int(multi.group("year") or year)
                    first = _parse_date(f"{month} {multi.group('d1')}, {y}", y)
                    second = _parse_date(f"{month} {multi.group('d2')}, {y}", y)
                    dates = [item for item in (first, second) if item]
                else:
                    single = SINGLE_DATE.search(nearby)
                    if single:
                        parsed = _parse_date(single.group("date"), year)
                        if parsed:
                            dates = [parsed]
            if not dates:
                continue
            windows.extend(
                _windows_from_match(
                    match.group("start"),
                    match.group("end"),
                    dates,
                    match.group(0),
                )
            )
            mark(match.span())

    if not windows:
        multi = MULTI_DAY.search(text)
        if multi:
            month = multi.group("month")
            y = int(multi.group("year") or year)
            first = _parse_date(f"{month} {multi.group('d1')}, {y}", y)
            second = _parse_date(f"{month} {multi.group('d2')}, {y}", y)
            hours = _duration_hours(text, default=8) or 8
            for day in (first, second):
                if not day:
                    continue
                start = day.replace(hour=0, minute=0)
                windows.append(
                    {
                        "start_at": start.isoformat(),
                        "end_at": (start + timedelta(hours=hours)).isoformat(),
                        "raw_date_text": _clean(multi.group(0)),
                    }
                )

    if not windows:
        range_days = RANGE_DAYS.search(text)
        if range_days:
            y = int(range_days.group("year") or year)
            month = range_days.group("month")
            month2 = range_days.group("month2") or month
            first = _parse_date(f"{month} {range_days.group('d1')}, {y}", y)
            second = _parse_date(f"{month2} {range_days.group('d2')}, {y}", y)
            hours = _duration_hours(text, default=4) or 4
            if first and second:
                day = first
                while day <= second:
                    start = day.replace(hour=0, minute=0)
                    windows.append(
                        {
                            "start_at": start.isoformat(),
                            "end_at": (start + timedelta(hours=hours)).isoformat(),
                            "raw_date_text": _clean(range_days.group(0)),
                        }
                    )
                    day = day + timedelta(days=1)

    if not windows:
        single = SINGLE_DATE.search(text)
        if single:
            day = _parse_date(single.group("date"), year)
            if day:
                hours = _duration_hours(text)
                start = day.replace(hour=0, minute=0, second=0, microsecond=0)
                end = (
                    start + timedelta(hours=hours)
                    if hours
                    else start + timedelta(days=1)
                )
                windows.append(
                    {
                        "start_at": start.isoformat(),
                        "end_at": end.isoformat(),
                        "raw_date_text": _clean(single.group(0)),
                    }
                )

    unique: list[dict[str, Any]] = []
    seen: set[tuple[str | None, str | None, str]] = set()
    for window in windows:
        key = (window["start_at"], window["end_at"], window["raw_date_text"])
        if key in seen:
            continue
        seen.add(key)
        unique.append(window)
    return unique


def parse_advisory(
    title: str,
    raw_text: str,
    source_url: str,
    published_at: str | None = None,
    parse_confidence: str | None = None,
) -> dict[str, Any]:
    body = APOLOGY_START.split(raw_text, maxsplit=1)[0]
    windows = extract_windows(body, published_at)
    areas = extract_area_rows(body)
    cancelled = detect_cancelled(title, body)

    if parse_confidence:
        confidence = parse_confidence
    elif windows and areas:
        confidence = "high"
    elif windows or areas:
        confidence = "low"
    else:
        confidence = "failed"

    parsed = {
        "title": title,
        "type": detect_type(title, body),
        "status": "cancelled" if cancelled else "upcoming",
        "dates": windows,
        "areas": [area["raw_text"] for area in areas],
        "reason": extract_reason(body),
        "source_url": source_url,
        "is_cancelled_by_source": cancelled,
        "parse_confidence": confidence,
        "parser_version": PARSER_VERSION,
    }
    return {
        **parsed,
        "windows": windows,
        "area_rows": areas,
    }


def should_replace(existing_confidence: str, new_confidence: str) -> bool:
    return CONFIDENCE_RANK.get(new_confidence, 0) >= CONFIDENCE_RANK.get(existing_confidence, 0)
