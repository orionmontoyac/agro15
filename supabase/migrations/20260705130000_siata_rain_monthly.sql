-- Monthly rain accumulations from SIATA capa_service (current-year series)

create table public.siata_rain_monthly (
  id bigint generated always as identity primary key,
  station_code text not null references public.siata_rain_stations (station_code) on delete cascade,
  calendar_year integer not null,
  month integer not null check (month >= 1 and month <= 12),
  rain_mm numeric not null default 0,
  fetched_at timestamptz not null default now(),
  constraint siata_rain_monthly_station_year_month_key
    unique (station_code, calendar_year, month)
);

create index idx_siata_rain_monthly_station_year
  on public.siata_rain_monthly (station_code, calendar_year desc);

alter table public.siata_rain_monthly enable row level security;

create policy "Public read siata_rain_monthly"
  on public.siata_rain_monthly
  for select
  to anon, authenticated
  using (true);
