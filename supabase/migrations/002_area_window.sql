-- Link affected areas to a specific outage window when the advisory
-- splits interruptions by time. Null means the area applies to every window.

alter table affected_areas
  add column if not exists window_id uuid references outage_windows (id) on delete set null;

create index if not exists affected_areas_window_id_idx on affected_areas (window_id);

notify pgrst, 'reload schema';
