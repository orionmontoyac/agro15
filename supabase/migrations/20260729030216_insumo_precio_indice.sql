-- Índice de precios de insumos agrícolas (DANE, base ene-2021=100)
-- Wide CSV melted to long format: one row per (fecha, producto).

create table public.insumo_precio_indice (
  id bigint generated always as identity primary key,
  fecha date not null,
  categoria text not null,
  producto text not null,
  valor numeric(8, 2),
  created_at timestamptz not null default now(),
  constraint insumo_precio_indice_fecha_producto_key unique (fecha, producto)
);

create index idx_insumo_producto_fecha
  on public.insumo_precio_indice (producto, fecha);

create index idx_insumo_categoria_fecha
  on public.insumo_precio_indice (categoria, fecha);

comment on table public.insumo_precio_indice is
  'Índice mensual de precios de insumos agrícolas (DANE). Base ene-2021=100. valor null = sin reporte.';

alter table public.insumo_precio_indice enable row level security;

create policy "Public read insumo_precio_indice"
  on public.insumo_precio_indice
  for select
  to anon, authenticated
  using (true);

create or replace function public.get_serie_insumo(
  p_productos text[],
  p_fecha_inicio date default '2018-12-01',
  p_fecha_fin date default current_date
)
returns table (
  fecha date,
  producto text,
  valor numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  select i.fecha, i.producto, i.valor
  from public.insumo_precio_indice i
  where i.producto = any (p_productos)
    and i.fecha between p_fecha_inicio and p_fecha_fin
  order by i.fecha asc, i.producto asc;
$$;

comment on function public.get_serie_insumo(text[], date, date) is
  'Serie temporal del índice de precios de insumos para uno o varios productos.';

grant execute on function public.get_serie_insumo(text[], date, date) to anon, authenticated;

create or replace function public.get_catalogo_insumo_indice()
returns table (
  categoria text,
  producto text
)
language sql
stable
security invoker
set search_path = public
as $$
  select distinct i.categoria, i.producto
  from public.insumo_precio_indice i
  order by i.categoria asc, i.producto asc;
$$;

comment on function public.get_catalogo_insumo_indice() is
  'Catálogo categoría → producto del índice de precios de insumos.';

grant execute on function public.get_catalogo_insumo_indice() to anon, authenticated;
