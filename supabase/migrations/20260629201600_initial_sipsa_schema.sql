-- SIPSA schema for agro15 (DANE wholesale fruit prices)

create table public.sipsa_departments (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  department_code text not null,
  department_name text not null,
  constraint sipsa_departments_department_code_key unique (department_code),
  constraint sipsa_departments_department_name_key unique (department_name)
);

create table public.sipsa_municipalities (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  municipality_code text not null,
  municipality_name text not null,
  department_id bigint not null references public.sipsa_departments (id) on delete cascade,
  constraint sipsa_municipalities_municipality_code_key unique (municipality_code)
);

create table public.sipsa_products (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  product_code text not null,
  product_name text not null,
  constraint sipsa_products_product_code_key unique (product_code)
);

create table public.sipsa_product_prices (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  product_id bigint not null references public.sipsa_products (id) on delete cascade,
  municipality_id bigint not null references public.sipsa_municipalities (id) on delete cascade,
  department_id bigint not null references public.sipsa_departments (id) on delete cascade,
  price numeric not null,
  date date not null,
  fetch_timestamp timestamptz not null,
  constraint sipsa_product_prices_product_municipality_date_key
    unique (product_id, municipality_id, date)
);

create index idx_sipsa_product_prices_product_id
  on public.sipsa_product_prices (product_id);

create index idx_sipsa_product_prices_municipality_id
  on public.sipsa_product_prices (municipality_id);

create index idx_sipsa_product_prices_date
  on public.sipsa_product_prices (date);

create index idx_sipsa_product_prices_fetch_timestamp
  on public.sipsa_product_prices (fetch_timestamp);

create table public.sync_runs (
  id bigint generated always as identity primary key,
  started_at timestamptz not null,
  finished_at timestamptz,
  status text not null,
  records_upserted integer not null default 0,
  products_synced integer not null default 0,
  error_message text
);

-- Row Level Security
alter table public.sipsa_departments enable row level security;
alter table public.sipsa_municipalities enable row level security;
alter table public.sipsa_products enable row level security;
alter table public.sipsa_product_prices enable row level security;
alter table public.sync_runs enable row level security;

create policy "Public read sipsa_departments"
  on public.sipsa_departments
  for select
  to anon, authenticated
  using (true);

create policy "Public read sipsa_municipalities"
  on public.sipsa_municipalities
  for select
  to anon, authenticated
  using (true);

create policy "Public read sipsa_products"
  on public.sipsa_products
  for select
  to anon, authenticated
  using (true);

create policy "Public read sipsa_product_prices"
  on public.sipsa_product_prices
  for select
  to anon, authenticated
  using (true);

create policy "Public read sync_runs"
  on public.sync_runs
  for select
  to anon, authenticated
  using (true);

-- Seed catalog: tracked departments, municipalities, and agro15 fruits
insert into public.sipsa_departments (department_code, department_name)
values
  ('05', 'Antioquia'),
  ('11', 'Bogotá, D.C.')
on conflict (department_code) do nothing;

insert into public.sipsa_municipalities (municipality_code, municipality_name, department_id)
values
  (
    '05001',
    'Medellín',
    (select id from public.sipsa_departments where department_code = '05')
  ),
  (
    '11001',
    'Bogotá, D.C.',
    (select id from public.sipsa_departments where department_code = '11')
  )
on conflict (municipality_code) do nothing;

insert into public.sipsa_products (product_code, product_name)
values
  ('106', 'Granadilla'),
  ('46', 'Tomate chonto'),
  ('113', 'Gulupa')
on conflict (product_code) do nothing;
