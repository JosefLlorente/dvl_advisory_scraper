from pathlib import Path

from scraper.manual import parse_manual_file


def test_manual_front_matter(tmp_path: Path):
    path = tmp_path / "override.md"
    path.write_text(
        """---
source_url: https://www.davaolight.com/post/example
type: scheduled
title: Manual override
---
From 9:00 a.m. to 11:00 a.m. on Monday, September 1, 2026.
Specifically affected are customers from Poblacion and nearby areas.
""",
        encoding="utf-8",
    )
    result = parse_manual_file(path)
    assert result["parsed"]["parse_confidence"] == "manual"
    assert result["parsed"]["type"] == "scheduled"
    assert result["parsed"]["windows"]
    assert result["parsed"]["areas"]
