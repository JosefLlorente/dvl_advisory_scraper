import os
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env.local")
load_dotenv(ROOT / ".env")

LISTING_URLS = [
    "https://www.davaolight.com/customer-services/service-advisory",
    "https://www.davaolight.com/newsroom-blog/categories/scheduled-power-interruption",
    "https://www.davaolight.com/newsroom-blog/categories/emergency-power-interruption",
    "https://www.davaolight.com/newsroom-blog/categories/service-advisory",
]

REQUEST_DELAY_SECONDS = float(os.getenv("SCRAPE_DELAY_SECONDS", "1.5"))
GEOCODE_ENABLED = os.getenv("GEOCODE_ENABLED", "true").lower() != "false"
TIMEZONE = "Asia/Manila"

SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = (
    os.getenv("SUPABASE_SECRET_KEY")
    or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
)

FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures"
MANUALS_DIR = Path(__file__).resolve().parent / "manuals"
BARANGAY_CSV = Path(__file__).resolve().parent / "data" / "barangays.csv"
