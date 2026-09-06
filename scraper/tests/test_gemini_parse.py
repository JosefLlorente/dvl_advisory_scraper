from scraper.gemini_parse import advisory_from_gemini
from scraper.parse import sanitize_area_list


def test_sanitize_drops_nearby_and_blank():
    rows = sanitize_area_list(
        [
            "Arroyo Street",
            "nearby areas",
            "  ",
            "Arroyo Street",
            "Jetti Gas opposite SM Lanang and nearby areas",
        ]
    )
    texts = [row["raw_text"] for row in rows]
    assert texts[0] == "Arroyo Street"
    assert any("Jetti Gas" in text for text in texts)
    assert not any("nearby" in text.lower() for text in texts)


def test_advisory_from_gemini_normalizes_windows():
    parsed = advisory_from_gemini(
        "Switching power interruption",
        "Cancelled advisory affecting Arroyo Street.",
        "https://example.com/post",
        {
            "type": "switching",
            "is_cancelled": True,
            "reason": "substation works",
            "windows": [
                {
                    "start_at": "2026-09-08T05:00:00",
                    "end_at": "2026-09-08T15:00:00+08:00",
                    "raw_date_text": "from 5:00 a.m. to 3:00 p.m.",
                    "areas": ["Arroyo Street", "nearby areas"],
                }
            ],
            "areas": [],
        },
    )
    assert parsed["is_cancelled_by_source"] is True
    assert parsed["status"] == "cancelled"
    assert parsed["windows"][0]["start_at"].endswith("+08:00")
    assert parsed["areas"] == ["Arroyo Street"]
    assert parsed["area_rows"][0]["window_index"] == 0
    assert parsed["parse_confidence"] == "high"


def test_advisory_from_gemini_splits_areas_per_window():
    parsed = advisory_from_gemini(
        "Switching power interruptions",
        "Two windows on September 6.",
        "https://example.com/post",
        {
            "type": "switching",
            "is_cancelled": False,
            "reason": "substation works",
            "windows": [
                {
                    "start_at": "2026-09-06T05:00:00+08:00",
                    "end_at": "2026-09-06T06:00:00+08:00",
                    "raw_date_text": "between 5:00 a.m. and 6:00 a.m.",
                    "areas": ["Panabo Wharf"],
                },
                {
                    "start_at": "2026-09-06T00:00:00+08:00",
                    "end_at": "2026-09-06T08:00:00+08:00",
                    "raw_date_text": "from 12:00 a.m. to 8:00 a.m.",
                    "areas": ["Damosa to Jetti Gas"],
                },
            ],
            "areas": ["Bioessence"],
        },
    )
    by_window = {
        row["window_index"]: row["raw_text"] for row in parsed["area_rows"]
    }
    assert by_window[0] == "Panabo Wharf"
    assert by_window[1] == "Damosa to Jetti Gas"
    assert by_window[None] == "Bioessence"


def test_advisory_from_gemini_ignores_shared_copy_of_window_areas():
    parsed = advisory_from_gemini(
        "Switching power interruptions",
        "Two windows on September 6.",
        "https://example.com/post",
        {
            "type": "switching",
            "is_cancelled": False,
            "reason": "substation works",
            "windows": [
                {
                    "start_at": "2026-09-06T05:00:00+08:00",
                    "end_at": "2026-09-06T06:00:00+08:00",
                    "raw_date_text": "between 5:00 a.m. and 6:00 a.m.",
                    "areas": ["Panabo Wharf"],
                },
                {
                    "start_at": "2026-09-06T00:00:00+08:00",
                    "end_at": "2026-09-06T08:00:00+08:00",
                    "raw_date_text": "from 12:00 a.m. to 8:00 a.m.",
                    "areas": ["Damosa to Jetti Gas"],
                },
            ],
            "areas": ["Panabo Wharf", "Damosa to Jetti Gas"],
        },
    )
    assert [row["window_index"] for row in parsed["area_rows"]] == [0, 1]
    assert parsed["areas"] == ["Panabo Wharf", "Damosa to Jetti Gas"]
