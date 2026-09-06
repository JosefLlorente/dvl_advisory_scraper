from scraper.store import match_window_rows, window_id_for_area


def test_window_id_for_area_uses_index():
    rows = [{"id": "w0"}, {"id": "w1"}]
    assert window_id_for_area({"window_index": 1}, rows) == "w1"
    assert window_id_for_area({"window_index": 0}, rows) == "w0"
    assert window_id_for_area({"window_index": None}, rows) is None
    assert window_id_for_area({}, rows) is None
    assert window_id_for_area({"window_index": 9}, rows) is None


def test_match_window_rows_preserves_parse_order():
    parsed = [
        {"start_at": "a", "end_at": "b"},
        {"start_at": "c", "end_at": "d"},
    ]
    fetched = [
        {"id": "w1", "start_at": "c", "end_at": "d"},
        {"id": "w0", "start_at": "a", "end_at": "b"},
    ]
    assert [row["id"] for row in match_window_rows(parsed, fetched)] == ["w0", "w1"]
