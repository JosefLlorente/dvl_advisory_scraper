# LightsOutinDVO

Hourly crawler and public map for [Davao Light service advisories](https://www.davaolight.com/customer-services/service-advisory). Advisories are free-form Wix posts; the hard part is parsing that prose into windows, areas, and map points.

This project is unofficial and is not affiliated with Davao Light and Power Co., Inc. Advisory titles, body text, and source pages belong to Davao Light. This repo only indexes public posts. Map tiles and geocoding follow [OpenStreetMap](https://www.openstreetmap.org/copyright) / Nominatim terms.

Frontend contributions (UI, layout, map styling, copy) are welcome. Changes to the scraper, parser, schema, geocoding, or cron should be discussed in an issue first.

Reference UI: [vecoadv.prannsss.dev](https://vecoadv.prannsss.dev/). Project rules live in `.cursor/rules/` and `docs/ROADMAP.md`.

## Stack

- Next.js + TypeScript + Tailwind + shadcn/ui
- Python scraper (`httpx`, BeautifulSoup, dateutil)
- Supabase Postgres
- Vercel (frontend) + GitHub Actions cron (hourly scrape)
- OpenStreetMap / Nominatim

Without Supabase env vars the UI renders checked-in demo advisories so the layout is usable locally.

## Setup

```bash
npm install
cp .env.example .env.local
```

Apply `supabase/migrations/001_init.sql` in the Supabase SQL editor. Put the publishable key in `NEXT_PUBLIC_*` and the secret key only in server/scraper secrets.

```bash
npm run dev
```

## Scraper

```bash
pip install -r scraper/requirements.txt
python -m scraper --dry-run --limit 3
python -m scraper
python -m pytest
```

The listing page already contains `/post/` links in the HTML, so discovery does not need a headless browser. The run is idempotent on `source_url`. If a hour finds no new keyword-matching titles, stored advisories are left untouched.

Parser failures are logged to `parse_failures`. To override a bad parse, drop a markdown file in `scraper/manuals/` (see `example.md.example`) and rerun `python -m scraper --manuals-only`.

## Hourly schedule

GitHub Actions (`.github/workflows/scrape.yml`) runs `python -m scraper` every hour. Add repository secrets `SUPABASE_URL` and `SUPABASE_SECRET_KEY`.

Vercel Cron hits `/api/cron/scrape` every hour as a status check of `scrape_runs`. Protect manual calls with `Authorization: Bearer $CRON_SECRET`.

## License

Code in this repository is licensed under the [MIT License](LICENSE). Copyright © 2026 Josef Llorente.

The MIT license covers the application and scraper source only. It does not apply to Davao Light advisories or OpenStreetMap data.
