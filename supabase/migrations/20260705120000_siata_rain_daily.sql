-- SIATA Geoportal daily rain (Urrao station 641 and future stations)

create table public.siata_rain_stations (
  station_code text primary key,
  station_name text not null,
  city text,
  latitude numeric,
  longitude numeric,
  subcuenca text,
  updated_at timestamptz not null default now()
);

create table public.siata_rain_daily (
  id bigint generated always as identity primary key,
  station_code text not null references public.siata_rain_stations (station_code) on delete cascade,
  rain_date date not null,
  rain_mm_pluvio_1 numeric not null default 0,
  rain_mm_pluvio_2 numeric not null default 0,
  rain_mm_avg numeric not null default 0,
  acum_pluvio_1 numeric,
  acum_pluvio_2 numeric,
  data_coverage_pct numeric,
  fetched_at timestamptz not null default now(),
  constraint siata_rain_daily_station_date_key unique (station_code, rain_date)
);

create index idx_siata_rain_daily_station_code
  on public.siata_rain_daily (station_code);

create index idx_siata_rain_daily_rain_date
  on public.siata_rain_daily (rain_date desc);

alter table public.siata_rain_stations enable row level security;
alter table public.siata_rain_daily enable row level security;

create policy "Public read siata_rain_stations"
  on public.siata_rain_stations
  for select
  to anon, authenticated
  using (true);

create policy "Public read siata_rain_daily"
  on public.siata_rain_daily
  for select
  to anon, authenticated
  using (true);
