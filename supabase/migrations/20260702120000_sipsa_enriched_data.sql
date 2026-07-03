-- SIPSA enriched data: price bands, report types, market names, monthly supply

alter table public.sipsa_product_prices
  add column price_min numeric,
  add column price_max numeric,
  add column daily_variation numeric,
  add column report_type text not null default 'day';

alter table public.sipsa_product_prices
  drop constraint sipsa_product_prices_product_municipality_date_key;

alter table public.sipsa_product_prices
  add constraint sipsa_product_prices_product_municipality_date_report_key
    unique (product_id, municipality_id, date, report_type);

create index idx_sipsa_product_prices_report_type
  on public.sipsa_product_prices (report_type);

alter table public.sipsa_municipalities
  add column market_name text;

create table public.sipsa_supply_monthly (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  product_id bigint not null references public.sipsa_products (id) on delete cascade,
  municipality_id bigint not null references public.sipsa_municipalities (id) on delete cascade,
  period_month date not null,
  quantity_tons numeric not null,
  source_id text,
  source_name text,
  fetch_timestamp timestamptz not null,
  constraint sipsa_supply_monthly_product_municipality_period_source_key
    unique (product_id, municipality_id, period_month, source_id)
);

create index idx_sipsa_supply_monthly_product_id
  on public.sipsa_supply_monthly (product_id);

create index idx_sipsa_supply_monthly_municipality_id
  on public.sipsa_supply_monthly (municipality_id);

create index idx_sipsa_supply_monthly_period_month
  on public.sipsa_supply_monthly (period_month);

alter table public.sipsa_supply_monthly enable row level security;

create policy "Public read sipsa_supply_monthly"
  on public.sipsa_supply_monthly
  for select
  to anon, authenticated
  using (true);
