-- SIPSA monthly agricultural input prices (insumos)

create table public.sipsa_insumos_monthly (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  insumo_name text not null,
  department_name text,
  municipality_code text not null,
  municipality_name text,
  period_month date not null,
  average_price numeric not null,
  collection_type_id text,
  collection_type_name text,
  fetch_timestamp timestamptz not null,
  constraint sipsa_insumos_monthly_insumo_muni_period_type_key
    unique (insumo_name, municipality_code, period_month, collection_type_id)
);

create index idx_sipsa_insumos_monthly_municipality_code
  on public.sipsa_insumos_monthly (municipality_code);

create index idx_sipsa_insumos_monthly_period_month
  on public.sipsa_insumos_monthly (period_month);

create index idx_sipsa_insumos_monthly_insumo_name
  on public.sipsa_insumos_monthly (insumo_name);

alter table public.sipsa_insumos_monthly enable row level security;

create policy "Public read sipsa_insumos_monthly"
  on public.sipsa_insumos_monthly
  for select
  to anon, authenticated
  using (true);
