-- Davao Light outage crawler schema
-- Apply in the Supabase SQL editor or via the CLI.

create extension if not exists "pgcrypto";

create type advisory_type as enum ('scheduled', 'emergency', 'switching', 'unspecified');
create type advisory_status as enum ('upcoming', 'active', 'completed', 'cancelled');
create type parse_confidence as enum ('high', 'low', 'failed', 'manual');
create type geocode_confidence as enum (
  'exact',
  'approximate',
  'barangay_centroid',
  'failed',
  'pending'
);

create table advisories (
  id uuid primary key default gen_random_uuid(),
  source_url text not null unique,
  title text not null,
  raw_html text,
  raw_text text not null,
  parsed_json jsonb,
  advisory_type advisory_type not null default 'unspecified',
  status advisory_status not null default 'upcoming',
  is_cancelled_by_source boolean not null default false,
  reason text,
  published_at timestamptz,
  scraped_at timestamptz not null default now(),
  parse_confidence parse_confidence not null default 'failed',
  parser_version integer not null default 1,
  revision integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table outage_windows (
  id uuid primary key default gen_random_uuid(),
  advisory_id uuid not null references advisories (id) on delete cascade,
  start_at timestamptz,
  end_at timestamptz,
  raw_date_text text not null,
  created_at timestamptz not null default now()
);

create table affected_areas (
  id uuid primary key default gen_random_uuid(),
  advisory_id uuid not null references advisories (id) on delete cascade,
  raw_text text not null,
  normalized_name text,
  barangay text,
  lat double precision,
  lng double precision,
  geocode_confidence geocode_confidence not null default 'pending',
  created_at timestamptz not null default now()
);

create table parse_failures (
  id uuid primary key default gen_random_uuid(),
  source_url text not null,
  raw_text text,
  error text not null,
  created_at timestamptz not null default now()
);

create table geocode_cache (
  query text primary key,
  lat double precision,
  lng double precision,
  display_name text,
  confidence geocode_confidence not null default 'failed',
  updated_at timestamptz not null default now()
);

create table scrape_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  discovered integer not null default 0,
  inserted integer not null default 0,
  updated integer not null default 0,
  parse_failures integer not null default 0,
  geocode_failures integer not null default 0,
  notes text
);

create index outage_windows_advisory_id_idx on outage_windows (advisory_id);
create index outage_windows_start_at_idx on outage_windows (start_at);
create index affected_areas_advisory_id_idx on affected_areas (advisory_id);
create index advisories_published_at_idx on advisories (published_at desc);
create index parse_failures_created_at_idx on parse_failures (created_at desc);

-- Derived status: cancelled overrides; else any active window, else any upcoming, else completed.
create or replace view advisory_current_status as
select
  a.id as advisory_id,
  case
    when a.is_cancelled_by_source then 'cancelled'::advisory_status
    when exists (
      select 1
      from outage_windows w
      where w.advisory_id = a.id
        and w.start_at is not null
        and w.end_at is not null
        and w.start_at <= now()
        and w.end_at >= now()
    ) then 'active'::advisory_status
    when exists (
      select 1
      from outage_windows w
      where w.advisory_id = a.id
        and w.start_at is not null
        and w.start_at > now()
    ) then 'upcoming'::advisory_status
    when exists (
      select 1
      from outage_windows w
      where w.advisory_id = a.id
        and w.end_at is not null
        and w.end_at < now()
    ) then 'completed'::advisory_status
    else a.status
  end as status
from advisories a;

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger advisories_set_updated_at
before update on advisories
for each row
execute function set_updated_at();

alter table advisories enable row level security;
alter table outage_windows enable row level security;
alter table affected_areas enable row level security;
alter table parse_failures enable row level security;
alter table geocode_cache enable row level security;
alter table scrape_runs enable row level security;

create policy advisories_read on advisories
  for select to anon, authenticated
  using (true);

create policy outage_windows_read on outage_windows
  for select to anon, authenticated
  using (true);

create policy affected_areas_read on affected_areas
  for select to anon, authenticated
  using (true);

-- Views inherit table RLS in recent Postgres/Supabase; grant select explicitly.
grant usage on type advisory_type, advisory_status, parse_confidence, geocode_confidence to anon, authenticated, service_role;
grant select on advisory_current_status to anon, authenticated, service_role;
grant select on advisories, outage_windows, affected_areas to anon, authenticated, service_role;
grant all on advisories, outage_windows, affected_areas, parse_failures, geocode_cache, scrape_runs to service_role;

notify pgrst, 'reload schema';
