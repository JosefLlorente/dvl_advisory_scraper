from scraper.keywords import is_relevant_title


def test_keyword_allowlist():
    assert is_relevant_title("Scheduled power interruption on September 8")
    assert is_relevant_title("CANCELLED: Switching power interruptions")
    assert is_relevant_title("[UPDATED] Emergency power interruption")
    assert not is_relevant_title("INVITATION TO BID: Reroofing of Annex Building")
    assert not is_relevant_title("Davao Light inaugurates new substation")
