# Davao Light Outage Crawler — Roadmap

Reference: [vecoadv.prannsss.dev](https://vecoadv.prannsss.dev/) (Cebu/VECO outage crawler)
Source: [Davao Light Service Advisory](https://www.davaolight.com/customer-services/service-advisory)

Stack: Next.js + TypeScript + Tailwind + shadcn/ui (frontend) · Python (scraper/parser) · Supabase Postgres (storage) · Vercel + Vercel Cron (hosting/scheduling) · OpenStreetMap (map) · No user accounts.

---

## 0. Key Difference From VECO, Read This First

Davao Light's advisories are **not structured data** — they're Wix blog posts written in free-form prose (e.g. *"...a ten-hour switching power interruption from 5:00 a.m. to 3:00 p.m. on Tuesday, September 8, 2026... Specifically affected are customers from Purok 24 Samulco Village along Catalunan Pequeno Road going to Cawa Cawa..."*). There are no lat/lng, no clean area list, no machine-readable status field.

This changes the hard part of the project from "build a UI" to "reliably parse Filipino-English utility-advisory prose into structured records and geocode vague place names in Davao." Budget most of your time there. Everything below is scoped around that reality.

**How the reference site (vecoadv) actually handles this**, per its developer: Python + Scrapy scrapes VECO on an hourly schedule, but only looks for posts matching keywords like `ADVISORY`, `UPDATE`, `BROWNOUT`. If nothing matches, it doesn't touch the stored data at all that run. If something matches, it parses and structures it as JSON for the frontend to consume. When the parser fails on a new/unseen post format, the fix isn't "improve the parser first" — it's manual: copy the Facebook post text into a `.md` file, and parse *that* file into JSON instead. That manual-fallback step is the pragmatic escape hatch this roadmap was missing — it turns "parser failure" from a blocking bug into a 2-minute manual override. Adopt the same pattern below (Phase 2 and Phase 3).

---

## Phase 1 — Data Model & Infrastructure Setup

**Goal:** Supabase schema + project skeleton exist and are deployed, before any scraping logic.

1. Create Supabase project. Design tables:
   - `advisories`
     - `id` (uuid, pk)
     - `source_url` (text, unique, not null) — dedupe key per project.mdc rule "every outage must have a source URL"
     - `title` (text)
     - `raw_html` / `raw_text` (text) — keep original for re-parsing later without re-scraping
     - `advisory_type` (enum: `scheduled`, `emergency`, `switching`, `unspecified`)
     - `status` (enum: `upcoming`, `active`, `completed`, `cancelled`) — computed, not scraped
     - `is_cancelled_by_source` (bool) — true if title/body explicitly says "CANCELLED"
     - `reason` (text, nullable) — e.g. "net metering and recloser installation"
     - `published_at` (timestamptz) — from the post
     - `scraped_at` (timestamptz)
     - `parse_confidence` (enum: `high`, `low`, `failed`, `manual`) — see Phase 3
     - `parser_version` (int) — so you can tell which records need re-parsing after parser changes
   - `outage_windows` (an advisory can list multiple dates/areas, e.g. "September 6 and 7")
     - `id`, `advisory_id` (fk)
     - `start_at` (timestamptz), `end_at` (timestamptz)
     - `raw_date_text` (text) — original phrase, for debugging bad parses
   - `affected_areas`
     - `id`, `advisory_id` (fk)
     - `raw_text` (text) — e.g. "Purok 24 Samulco Village along Catalunan Pequeno Road"
     - `normalized_name` (text, nullable)
     - `barangay` (text, nullable)
     - `lat`, `lng` (nullable) — filled by geocoder
     - `geocode_confidence` (enum: `exact`, `approximate`, `barangay_centroid`, `failed`)
   - `parse_failures` (log table per project.mdc "log parsing failures")
     - `id`, `source_url`, `raw_text`, `error`, `created_at`
   - `geocode_cache`
     - `query` (text, pk), `lat`, `lng`, `display_name`, `confidence`, `updated_at`
     - Avoids re-hitting Nominatim for repeated area names (huge rate-limit saver)
2. Row-Level Security: anon key gets **read-only** access to `advisories`, `outage_windows`, `affected_areas`. Service-role key (used only by the scraper) has write access. No public writes anywhere — matches "no account needed" and "never expose service-role credentials to the client."
3. Scaffold Next.js app (`create-next-app`, TypeScript, Tailwind, App Router). Install shadcn/ui. Set up Supabase client (`@supabase/supabase-js`) with anon key on the frontend only.
4. Set up Python scraper project (`/scraper` folder, separate `requirements.txt`): `httpx` or `requests`, `beautifulsoup4`, `python-dateutil`, `supabase-py` (or raw `psycopg2`/`postgrest` calls), geocoding client.
5. Decide scraper hosting shape now, since it affects folder structure (see Phase 5): a Python **Vercel Serverless Function** (`/api/cron/scrape.py`) triggered by `vercel.json` `crons`, OR a separate always-on job (GitHub Actions cron / small worker) that writes directly to Supabase and Vercel Cron just hits a lightweight Next.js API route that pings/triggers it. Given "Vercel + Vercel Cron" was specified, default to the Python serverless function approach — confirm Vercel's Python runtime supports your scraping deps before committing.

**Deliverable:** empty-but-correct schema live on Supabase, blank Next.js app deployed to Vercel, blank scraper deployed and reachable via a manual test hit.

---

## Phase 2 — Scraper: Discovery & Fetching

**Goal:** Reliably get the list of advisory posts and their raw content, idempotently.

1. Fetch `https://www.davaolight.com/customer-services/service-advisory` (or the category feed `/newsroom-blog/categories/service-advisory` / `.../scheduled-power-interruption` / `.../emergency-power-interruption`, which are more directly on-topic than the mixed announcements page).
2. **Gate the run on keywords first**, same as vecoadv: only treat a post title as relevant if it matches keywords like `ADVISORY`, `UPDATE`, `SCHEDULED`, `EMERGENCY`, `SWITCHING`, `INTERRUPTION`, `CANCELLED`. Davao Light's titles are pretty consistent (see the live examples above), so a keyword allowlist is a cheap, effective filter before you spend a request fetching/parsing a post. If a run finds zero new keyword-matching titles, **don't write anything** — leave the stored data untouched for that hour, exactly like the reference site does. This also means a scraper bug or a site hiccup can't silently blank out good data.
3. **Rendering risk — check this before writing scraper code:** the service-advisory listing page uses Wix's Pro Gallery widget, which is client-side hydrated. A plain `requests`/`httpx` GET may return an empty shell or a pre-hydration DOM rather than the populated `.item-link-wrapper` blocks (each containing the post `<a href>`, an `h2` title, and a `[data-hook="time-ago"]` timestamp). Test a plain GET against both the listing page and the category feeds (`/newsroom-blog/categories/scheduled-power-interruption`, `/emergency-power-interruption`, `/service-advisory`) first — if any of them return server-rendered post links without needing JS, use that one and skip the complexity below. If none do, you'll need a headless browser (Playwright) just for the discovery step; that's real added weight in a Vercel Python serverless function (headless Chromium needs a package like `@sparticuz/chromium` and a longer cold start/execution budget), so confirm this need early rather than discovering it mid-build. Either way, the individual post pages (`/post/...`) rendered as plain server HTML when fetched directly, so Phase 2 step 5 (fetching full post content) doesn't need a headless browser regardless.
4. Extract each post's URL, title, and relative timestamp ("2 hours ago", "Aug 27").
5. For each URL not already in `advisories.source_url`, fetch the full post page and extract:
   - Title
   - Full body text (the paragraphs under the headline, before "Related Posts")
   - Category tags (Customer Advisory / Service Advisory / Scheduled vs Emergency Power Interruption)
   - Published/modified time (Wix pages typically expose this in meta tags — check `article:published_time`)
6. **Idempotency rule:** upsert on `source_url`. If a URL already exists, only update mutable fields (title, raw_text, status-relevant flags) — never delete the row, and never wipe `outage_windows`/`affected_areas` unless you're intentionally re-parsing (see Phase 3, versioning).
7. **Handle re-published/edited advisories.** Davao Light sometimes edits a post in place (e.g. "[UPDATED] Switching power interruptions..." with the same or a changed URL) or cancels one via a follow-up post with a different URL that references the original. Decide and document a policy:
   - Same URL, changed content → update in place, bump a `revision` counter.
   - New URL that says "CANCELLED: ..." referencing the same dates/areas as an earlier advisory → best-effort link via title/date similarity, mark the *original* advisory `is_cancelled_by_source = true` rather than only storing the cancellation post standalone. This is a judgment call — even a partial heuristic (fuzzy match on date + overlapping area keywords) beats nothing.
8. Respect the source: set a real User-Agent, add delay between requests, and don't hammer old pagination pages every run — once history is backfilled, only the first page/category feed needs checking hourly.

**Deliverable:** running the scraper populates `advisories` with raw title/body for all current + recent posts, safely re-runnable with no duplicates.

---

## Phase 3 — Parsing: Prose → Structured Data

**Goal:** Turn `raw_text` into `outage_windows` + `affected_areas` rows. This is the core R&D risk of the project — prototype it in a notebook against 20-30 real historical posts before wiring it into the pipeline.

1. **Status/type detection** (cheap, regex/keyword-based, do this first):
   - `CANCELLED` in title → `is_cancelled_by_source = true`
   - Title/body contains "emergency" → `advisory_type = emergency`
   - Title/body contains "switching" → `advisory_type = switching`
   - Otherwise "scheduled power interruption" → `scheduled`
2. **Date & time extraction:**
   - Look for patterns like `from 5:00 a.m. to 3:00 p.m. on Tuesday, September 8, 2026` and `on September 6 and 7` (multiple dates, same time window, implied year/details from context).
   - Use `dateutil.parser` plus custom regex for the "X a.m. to Y p.m." and "Month D and D" constructions. Handle both 12-hour ("5:00 a.m.") and duration phrasing ("ten-hour switching power interruption").
   - Every distinct date mentioned that shares a time window becomes its own `outage_windows` row tied to the same advisory (matches "Sept 6 and 7" → two rows).
   - Keep `raw_date_text` alongside every parsed window so failures are debuggable without re-fetching the source.
3. **Affected-area extraction:**
   - Isolate the sentence(s) starting with "Specifically affected are..." / "Affected areas include..." / similar boilerplate lead-ins (survey real posts for the actual set of lead-in phrases used — they're fairly consistent).
   - Split on commas/"and"/semicolons into candidate area strings (e.g. "Purok 24 Samulco Village", "Catalunan Pequeno Road", "Cawa Cawa", "Hedcor Talomo Plant 3", "Villa Constancia Subdivision").
   - Store each raw fragment as its own `affected_areas` row — don't try to force one lat/lng per whole advisory.
4. **Confidence flagging:** if the date/time regex or the "affected areas" sentence isn't found at all, still save the advisory with `parse_confidence = failed` and log to `parse_failures` (per project.mdc — never silently drop). The site/list view should still be able to show a "details on source" fallback for these rather than hiding them.
5. **Parser versioning:** stamp every parse with `parser_version`. When you improve the parser, re-run it only against stored `raw_text` (no re-scraping) for rows below the current version, and never let a parser change corrupt/break already-correctly-parsed older rows (project.mdc rule) — diff before overwriting, keep the old parse if the new one scores lower confidence.
6. Write unit tests against a fixed corpus of ~15-20 real historical advisory texts (save them as fixtures) covering: single date, multi-date, cancelled, emergency, "[UPDATED]", and at least one malformed/edge-case post. This is your regression suite for rule "parser changes must not break previously parsed formats."
7. **Output shape:** whatever parses the prose (regex pipeline, or an LLM-assisted extractor if regex gets too brittle) should emit one intermediate JSON object per advisory — `{ title, type, status, dates: [...], areas: [...], reason, source_url }` — *before* it's written to Supabase. Keep that JSON around (log it or store it in `raw_text`'s sibling column) so you can inspect/replay a bad parse without re-scraping or re-typing anything.
8. **Manual fallback for parser failures (adopt vecoadv's approach):** when the automated parser can't handle a new post format — you'll see it in `parse_failures` or by noticing the site didn't update for an advisory you know exists — don't block on fixing the parser immediately. Instead:
   - Copy the advisory text (from the Davao Light post or their Facebook page, whichever is clearer) into a plain `.md` file with a fixed, simple front-matter/structure you define once, e.g.:
     ```md
     ---
     source_url: https://www.davaolight.com/post/...
     type: scheduled
     ---
     Ten-hour switching power interruption from 5:00 a.m. to 3:00 p.m. on Tuesday, September 8, 2026...
     Specifically affected are customers from Purok 24 Samulco Village...
     ```
   - Run the *same* parser against this `.md` file's body instead of a scraped page. Since the parser's job is "prose in → JSON out" regardless of where the prose came from, this requires no separate code path — just a different input source.
   - The resulting JSON gets upserted into Supabase exactly like an automated parse, just flagged `parse_confidence = manual` so you can track how often you're intervening.
   - This turns every new "the parser broke" incident into a ~2-minute manual copy-paste instead of an emergency regex fix, and gives you a growing fixture corpus (Phase 3, item 6) for free every time you do it.

**Deliverable:** for a batch of historical posts, `outage_windows` and `affected_areas` are populated with reasonable accuracy; failures are logged, not silent, and have a fast manual-override path; there's a test suite protecting past behavior.

---

## Phase 4 — Geocoding (OpenStreetMap / Nominatim)

**Goal:** Turn `affected_areas.raw_text` into map-able coordinates.

1. Use Nominatim (OSM's geocoder) with a strict rate limit (1 req/sec per their usage policy) and a proper `User-Agent`/referrer, or self-host/use a paid Nominatim mirror if volume grows.
2. Query strategy, cheapest-first:
   - Check `geocode_cache` for an exact or near-exact match first.
   - Query as `"<raw_text>, Davao City, Philippines"` — append the city explicitly since raw text alone ("Cawa Cawa") is too ambiguous globally.
   - If no result, strip down to the most specific noun phrase (drop "along X Road going to Y" qualifiers) and retry.
   - If still nothing, fall back to matching against a **static barangay centroid lookup table** you build once (Davao City has ~180+ barangays; a CSV of barangay name → lat/lng is a reasonable one-time asset) and set `geocode_confidence = barangay_centroid`.
3. Cache every successful (and, with a short TTL, failed) lookup in `geocode_cache` so re-parses and repeated place names (the same purok/subdivision shows up across many advisories) don't re-hit Nominatim.
4. Never block the scraper run on geocoding: if geocoding is slow/rate-limited, save the advisory/areas first with `geocode_confidence = pending` and let a secondary pass (same cron run, after scraping/parsing, or a separate lower-frequency job) fill in coordinates.

**Deliverable:** most `affected_areas` rows have usable lat/lng within a run or two; a visible, non-blocking fallback exists for the ones that don't.

---

## Phase 5 — Scheduling on Vercel

**Goal:** The above runs automatically, hourly, per project.mdc.

1. Add a `vercel.json` with a `crons` entry hitting your scrape endpoint every hour (e.g. `0 * * * *`).
2. Protect the cron endpoint (Vercel sends a special header/secret for cron-triggered requests — verify it, or check a shared secret) so it can't be triggered by random public requests.
3. Structure the run as: fetch/discover new posts → parse new/failed posts → geocode pending areas → update `status` on all rows whose window has just started/ended (see Phase 6) — all in one function if it fits Vercel's execution time limit, otherwise split into 2 cron jobs (`scrape+parse`, `geocode+status-refresh`).
4. Add basic run logging (rows added, rows updated, parse failures, geocode failures) — even a simple `scrape_runs` table or Vercel function logs — so you can tell at a glance if a run silently did nothing.

**Deliverable:** a live cron job running hourly in production, observable via logs.

---

## Phase 6 — Status Computation (Upcoming / Active / Completed)

Per ui.mdc, status must be consistent and semantically colored across the app (`outage`, `upcoming`, `active`, `resolved`). This is derived, not scraped:

- `upcoming`: `now < start_at`
- `active`: `start_at <= now <= end_at`
- `completed`: `now > end_at`
- `cancelled`: overrides all of the above if `is_cancelled_by_source = true`

Compute this either at query time (a Postgres view/function) or refresh it each cron run — a DB view (`current_status`) is simpler and always correct without extra writes; prefer that unless query performance becomes an issue.

---

## Phase 7 — Frontend: Data Layer

1. Supabase server-side fetch (Next.js Server Components) for the initial list/map render — no client-exposed service key, anon key only, read-only per RLS.
2. Optionally add light client-side polling or Supabase Realtime subscription for "last updated" freshness without a full refresh, mirroring the reference site's "Live / Last updated" indicator.
3. Define shared TypeScript types for `Advisory`, `OutageWindow`, `AffectedArea` matching the Supabase schema (generate with `supabase gen types typescript` to keep them in sync automatically).

---

## Phase 8 — Frontend: UI (per project.mdc / ui.mdc)

Before building: create `DESIGN.md` (referenced by project.mdc but doesn't exist yet) defining the color tokens, spacing scale, and typography you'll commit to, so "no new colors/typography without checking existing patterns" has something to check against from day one.

1. **Layout:** mobile-first single page, matching the reference's structure:
   - Header: site title, live/last-updated indicator, manual refresh button.
   - Map view (primary): OSM tiles via **Leaflet** or **MapLibre GL** (either works with `react-leaflet` / `maplibre-gl`; pick Leaflet if you want the simpler/lighter option, MapLibre if you want vector tiles and nicer styling control) with markers per `affected_areas` (colored by computed status), clustered if dense.
   - List/panel: tabs for All / Upcoming / Active / Past (or "Completed"), each showing a count, mirroring the reference site's tab counts.
   - Empty states for each tab (per ui.mdc "empty states must be intentional") — e.g. "No completed outages yet" style copy already validated by the reference.
2. **Advisory detail:** clicking a list item or map marker shows date/time window(s), affected area text, reason, advisory type badge, cancelled badge if applicable, and a link back to the original `source_url` (always show the source link — non-negotiable per project.mdc).
3. **Status colors:** implement once as Tailwind/shadcn theme tokens (e.g. `--status-upcoming`, `--status-active`, `--status-completed`, `--status-cancelled`) and reuse everywhere — map markers, list badges, filter tabs — never hardcode a hex value inline.
4. **Components:** build on shadcn/ui primitives (Tabs, Badge, Card, Sheet/Dialog for detail view) rather than one-off elements, per ui.mdc.
5. **Loading/error states:** skeletons while data loads, a clear message if Supabase fetch fails or if an advisory has `parse_confidence = failed` (e.g. "Details unavailable — view original advisory" with the source link) rather than showing broken/blank data.
6. Accessibility: keyboard-navigable tabs and list items, sufficient color contrast on status badges (don't rely on color alone — pair with text/icon).

**Deliverable:** a working map + list UI reading live from Supabase, visually consistent with your new DESIGN.md.

---

## Phase 9 — QA & Backfill

1. Run the scraper against Davao Light's full `service-advisory` / `scheduled-power-interruption` / `emergency-power-interruption` category history to backfill past advisories (useful for testing the UI with realistic volume and for validating the parser against edge cases you haven't seen yet).
2. Manually spot-check a sample of parsed records against their source pages — dates, times, areas, cancelled status.
3. Verify hourly cron actually adds new posts as Davao Light publishes them (watch it for a day or two after a real advisory drops).
4. Load-test the map with the full backfilled dataset to make sure marker rendering/clustering holds up.

---

## Phase 10 — Nice-to-Haves (post-launch)

- Barangay/area search or filter.
- "Affected areas near me" using browser geolocation (still no accounts needed — just a client-side permission prompt).
- PWA/installable shell for quick mobile access.
- Simple public API (`/api/advisories`) so others can consume the parsed data, matching the spirit of the "no account needed" openness.
- Slack/Discord/RSS feed of new advisories, generated from the same Supabase data.

---

## Suggested Build Order (if you want a literal checklist)

- [ ] Phase 1: Supabase schema + repo scaffolding
- [ ] Phase 2: scraper fetch/discovery + idempotent upsert
- [ ] Phase 3: parser (prototype in notebook first, then wire in) + failure logging + test fixtures
- [ ] Phase 4: geocoding + cache + barangay fallback table
- [ ] Phase 5: Vercel Cron wiring, hourly
- [ ] Phase 6: status view (upcoming/active/completed/cancelled)
- [ ] Phase 7: Supabase data layer + generated types
- [ ] Phase 8: DESIGN.md, then map + list UI
- [ ] Phase 9: backfill + QA pass
- [ ] Phase 10: pick nice-to-haves
