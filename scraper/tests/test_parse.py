import re
from pathlib import Path

from scraper.parse import extract_area_rows, extract_areas, parse_advisory, should_replace

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
    assert any(area == "Arroyo Street" for area in parsed["areas"])
    assert any("Damosa to Jetti Gas" in area for area in parsed["areas"])
    assert any(area.endswith("Ornels Sea Foods") for area in parsed["areas"])
    assert not any(area.lower().endswith(" and") for area in parsed["areas"])
    assert not any("crossing" in area.lower() for area in parsed["areas"])
    assert not any("up to" in area.lower() for area in parsed["areas"])
    assert not any("nearby" in area.lower() for area in parsed["areas"])
    assert not any("," in area for area in parsed["areas"])
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


def test_comma_and_up_to_split_jp_laurel_span():
    areas = extract_areas(
        "Further, another 45-minute normalization activity will be conducted "
        "at any time between 8:00 a.m. and 9:00 a.m. on Sunday, September 6, "
        "affecting a portion of J. P. Laurel Avenue in Lanang, crossing Arroyo "
        "Street up to Jetti Gas opposite SM Lanang, and nearby areas."
    )
    assert any("J. P. Laurel Avenue in Lanang" in area for area in areas)
    assert "Arroyo Street" in areas
    assert "Jetti Gas opposite SM Lanang" in areas
    assert not any("crossing" in area.lower() for area in areas)
    assert not any("nearby" in area.lower() for area in areas)
    assert not any("," in area for area in areas)


def test_nearby_areas_drops_trailing_text_without_period():
    areas = extract_areas(
        "Specifically affected are customers from Abreeza, and nearby areas "
        "including a stray park without a period"
    )
    assert areas == ["Abreeza"]


def test_nearby_areas_allows_next_sentence_after_period():
    areas = extract_areas(
        "Specifically affected are customers from Abreeza, and nearby areas. "
        "Also affected are those from Bajada."
    )
    assert "Abreeza" in areas
    assert "Bajada" in areas


def test_crossing_kept_only_for_matina_crossing():
    areas = extract_areas(
        "Specifically affected are customers from Matina Crossing, crossing "
        "Arroyo Street, and nearby areas."
    )
    assert "Matina Crossing" in areas
    assert "Arroyo Street" in areas
    assert not any(area.lower() == "crossing arroyo street" for area in areas)


def test_including_marks_follow_on_areas():
    rows = extract_area_rows(
        "Specifically affected are customers from Purok 24 Samulco Village "
        "along Catalunan Pequeno Road going to Cawa Cawa, including Hedcor "
        "Talomo Plant 3, Villa Constancia Subdivision, and nearby areas."
    )
    by_name = {row["raw_text"]: row["included"] for row in rows}
    assert any("Samulco" in name for name in by_name)
    assert by_name["Hedcor Talomo Plant 3"] is True
    assert by_name["Villa Constancia Subdivision"] is True
    assert not any(included for name, included in by_name.items() if "Samulco" in name)
