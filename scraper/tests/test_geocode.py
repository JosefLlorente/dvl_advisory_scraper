from scraper.geocode import (
    hit_matches_query,
    in_allowed_city,
    match_barangay,
    required_tokens,
    result_from_google_geocode,
    simplify_query,
)


def test_hedcor_does_not_match_talomo_barangay():
    assert match_barangay("Hedcor Talomo Plant 3") is None


def test_sasa_matches_barangay():
    match = match_barangay("Sasa")
    assert match is not None
    assert match["name"] == "Sasa"


def test_catalunan_pequeno_matches_inside_longer_phrase():
    match = match_barangay(
        "Purok 24 Samulco Village along Catalunan Pequeno Road going to Cawa Cawa"
    )
    assert match is not None
    assert match["name"] == "Catalunan Pequeno"


def test_required_tokens_keep_hedcor():
    assert "hedcor" in required_tokens("Hedcor Talomo Plant 3")


def test_talomo_only_hit_rejected_for_hedcor():
    assert (
        hit_matches_query(
            "Hedcor Talomo Plant 3",
            {"display_name": "Talomo, Davao City, Philippines"},
        )
        is False
    )


def test_city_filter_allows_davao_and_panabo():
    assert in_allowed_city(
        {"display_name": "Jetti, Lanang, Davao City, Philippines", "lat": 7.1, "lon": 125.63}
    )
    assert in_allowed_city(
        {"display_name": "Panabo Wharf, Panabo City, Davao del Norte", "lat": 7.31, "lon": 125.68}
    )
    assert in_allowed_city(
        {
            "display_name": "Catalunan Pequeño, Davao del Sur, Philippines",
            "lat": 7.07,
            "lon": 125.54,
        }
    )
    assert not in_allowed_city(
        {"display_name": "Talomo, Cebu City, Philippines", "lat": 10.3, "lon": 123.9}
    )


def test_simplify_uses_first_side_of_to_range():
    assert simplify_query("Petron Gas Station to Anflo Industrial Estate") == (
        "Petron Gas Station"
    )


def test_simplify_strips_crossing_but_keeps_matina_crossing():
    assert simplify_query("crossing Arroyo Street") == "Arroyo Street"
    assert simplify_query("Matina Crossing") == "Matina Crossing"


def test_google_geocode_hit_maps_rooftop():
    result = result_from_google_geocode(
        {
            "formatted_address": "SM Lanang Premier, Davao City, Philippines",
            "geometry": {
                "location": {"lat": 7.0984, "lng": 125.6308},
                "location_type": "ROOFTOP",
            },
            "address_components": [
                {"long_name": "Davao City", "types": ["locality"]}
            ],
        }
    )
    assert result is not None
    assert result["lat"] == 7.0984
    assert result["lng"] == 125.6308
    assert result["confidence"] == "exact"
    assert result["address"]["city"] == "Davao City"
