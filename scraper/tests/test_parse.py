import re
from pathlib import Path

from scraper.parse import parse_advisory, should_replace

FIXTURES = Path(__file__).resolve().parent.parent / "fixtures"


def load_fixture(name: str) -> tuple[str, str, str, str | None]:
    text = (FIXTURES / name).read_text(encoding="utf-8")
    header, body = text.split("\n\n", 1)
    meta = {}
    for line in header.splitlines():
        key, value = line.split(": ", 1)
        meta[key] = value
    return meta["TITLE"], body.strip(), meta["URL"], meta.get("PUBLISHED")


def parse_fixture(name: str):
    title, body, url, published = load_fixture(name)
    return parse_advisory(title, body, url, published)


def test_single_date_window_and_areas():
    parsed = parse_fixture("sept8_simple.txt")
    assert parsed["type"] == "switching"
    assert parsed["parse_confidence"] == "high"
    assert len(parsed["windows"]) == 1
    assert parsed["windows"][0]["start_at"].startswith("2026-09-08T05:00:00+08:00")
    assert parsed["windows"][0]["end_at"].startswith("2026-09-08T15:00:00+08:00")
    assert any("Samulco" in area for area in parsed["areas"])
    assert any("Villa Constancia" in area for area in parsed["areas"])
    assert parsed["reason"]


def test_multi_date_and_between_window():
    parsed = parse_fixture("sept6_7_multi.txt")
    assert parsed["type"] == "switching"
    assert parsed["windows"]
    starts = {window["start_at"] for window in parsed["windows"]}
    assert any(item.startswith("2026-09-06T05:00:00+08:00") for item in starts)
    assert parsed["areas"]
    assert any("J. P. Laurel" in area for area in parsed["areas"])
    assert any("Bajada" in area for area in parsed["areas"])
    assert any("SPMC" in area or "DOH" in area for area in parsed["areas"])
    assert not any(re.search(r"portion of J$", area) for area in parsed["areas"])


def test_cancelled_keeps_windows():
    parsed = parse_fixture("sept5_cancelled.txt")
    assert parsed["is_cancelled_by_source"] is True
    assert parsed["status"] == "cancelled"
    assert parsed["windows"]
    assert parsed["windows"][0]["start_at"].startswith("2026-09-05T23:00:00+08:00")
    assert parsed["windows"][0]["end_at"].startswith("2026-09-06T07:00:00+08:00")


def test_date_only_without_time_range():
    parsed = parse_fixture("aug23_date_only.txt")
    assert parsed["type"] == "switching"
    assert parsed["windows"]
    assert parsed["windows"][0]["start_at"].startswith("2026-08-23T00:00:00+08:00")
    assert parsed["windows"][0]["end_at"].startswith("2026-08-24T00:00:00+08:00")
    assert parsed["reason"]
    assert parsed["parse_confidence"] == "low"


def test_eight_hour_duration_phrasing():
    parsed = parse_fixture("aug23_catigan.txt")
    assert parsed["type"] == "scheduled"
    assert parsed["windows"][0]["start_at"].startswith("2026-08-23T07:00:00+08:00")
    assert parsed["windows"][0]["end_at"].startswith("2026-08-23T15:00:00+08:00")
    assert any("Catigan" in area for area in parsed["areas"])


def test_six_hour_simple():
    parsed = parse_fixture("aug5_malagamot.txt")
    assert parsed["windows"][0]["start_at"].startswith("2026-08-05T08:00:00+08:00")
    assert parsed["windows"][0]["end_at"].startswith("2026-08-05T14:00:00+08:00")
    assert any("Malagamot" in area for area in parsed["areas"])


def test_emergency_and_range_days():
    parsed = parse_fixture("aug27_emergency.txt")
    assert parsed["type"] == "emergency"
    assert parsed["windows"]
    assert parsed["is_cancelled_by_source"] is True


def test_overnight_window():
    parsed = parse_fixture("july18_overnight.txt")
    overnight = [
        window
        for window in parsed["windows"]
        if window["start_at"].startswith("2026-07-18T22:00:00+08:00")
    ]
    assert overnight
    assert overnight[0]["end_at"].startswith("2026-07-19T06:00:00+08:00")


def test_updated_title():
    parsed = parse_fixture("updated_aug1.txt")
    assert parsed["type"] == "switching"
    assert parsed["windows"]
    assert parsed["areas"]


def test_malformed_is_failed():
    parsed = parse_fixture("malformed.txt")
    assert parsed["parse_confidence"] == "failed"
    assert parsed["windows"] == []
    assert parsed["areas"] == []


def test_should_not_overwrite_higher_confidence():
    assert should_replace("failed", "high") is True
    assert should_replace("manual", "high") is False
    assert should_replace("high", "high") is True
