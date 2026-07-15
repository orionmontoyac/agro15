-- Cultivo projections MVP (adapted to agro15: sipsa_products)

create table public.product_yield_reference (
  id uuid primary key default gen_random_uuid(),
  product_id bigint not null references public.sipsa_products (id) on delete cascade,
  unit_type text not null,
  yield_min numeric not null,
  yield_avg numeric not null,
  yield_max numeric not null,
  ciclo_meses int not null,
  fuente text not null default 'estimado',
  plantas_por_hectarea numeric,
  updated_at timestamptz not null default now(),
  constraint product_yield_reference_product_id_key unique (product_id),
  constraint product_yield_reference_unit_type_check
    check (unit_type in ('planta', 'hectarea')),
  constraint product_yield_reference_yield_positive_check
    check (yield_min > 0 and yield_avg > 0 and yield_max > 0),
  constraint product_yield_reference_yield_order_check
    check (yield_min <= yield_avg and yield_avg <= yield_max),
  constraint product_yield_reference_ciclo_positive_check
    check (ciclo_meses > 0)
);

create table public.cultivo_proyecciones (
  id uuid primary key default gen_random_uuid(),
  product_id bigint not null references public.sipsa_products (id) on delete cascade,
  modo_entrada text not null,
  cantidad_unidades numeric,
  kilos_min numeric,
  kilos_avg numeric,
  kilos_max numeric,
  resultado jsonb not null,
  created_at timestamptz not null default now(),
  constraint cultivo_proyecciones_modo_entrada_check
    check (modo_entrada in ('kilos_directo', 'plantas', 'hectareas'))
);

create index cultivo_proyecciones_created_at_idx
  on public.cultivo_proyecciones (created_at desc);

create index cultivo_proyecciones_product_id_idx
  on public.cultivo_proyecciones (product_id);

alter table public.product_yield_reference enable row level security;
alter table public.cultivo_proyecciones enable row level security;

-- Reference yields are public read (shared agronomic data)
create policy "Public read product_yield_reference"
  on public.product_yield_reference
  for select
  to anon, authenticated
  using (true);

-- cultivo_proyecciones: no public policies; API writes with service role (internal log).
-- Browser history is stored in localStorage on the client.
comment on table public.cultivo_proyecciones is
  'Internal Agro15 projection log. Browser history is stored in localStorage; this table is written by the API with the service role.';
