-- Seed yield references for MVP products (kg / planta / año, conservative ranges).
-- Also add plantas_por_hectarea so modo 'hectareas' can convert when unit_type = 'planta'.

alter table public.product_yield_reference
  add column if not exists plantas_por_hectarea numeric;

comment on column public.product_yield_reference.plantas_por_hectarea is
  'Densidad típica (plantas/ha) para convertir modo hectareas cuando unit_type = planta';

-- Granadilla (sipsa product_code 106, id 1)
-- Densidad típica pasifloras ~1.000–1.500 plantas/ha; rendimientos nacionales
-- ~10–15 t/ha (Agrosavia cadena pasifloras / Agronet). Conservador → ~6–15 kg/planta/año.
-- fuente marcada estimado por conversión t/ha → kg/planta.
insert into public.product_yield_reference (
  product_id, unit_type, yield_min, yield_avg, yield_max, ciclo_meses, fuente, plantas_por_hectarea
) values (
  1, 'planta', 6, 10, 15, 12, 'estimado', 1200
)
on conflict (product_id) do update set
  unit_type = excluded.unit_type,
  yield_min = excluded.yield_min,
  yield_avg = excluded.yield_avg,
  yield_max = excluded.yield_max,
  ciclo_meses = excluded.ciclo_meses,
  fuente = excluded.fuente,
  plantas_por_hectarea = excluded.plantas_por_hectarea,
  updated_at = now();

-- Gulupa (sipsa product_code 113, id 3)
-- Rendimiento histórico ~13 t/ha (Agronet 2013 vía estudios de cadena); densidad similar.
-- Conservador → 5–14 kg/planta/año.
insert into public.product_yield_reference (
  product_id, unit_type, yield_min, yield_avg, yield_max, ciclo_meses, fuente, plantas_por_hectarea
) values (
  3, 'planta', 5, 9, 14, 12, 'estimado', 1200
)
on conflict (product_id) do update set
  unit_type = excluded.unit_type,
  yield_min = excluded.yield_min,
  yield_avg = excluded.yield_avg,
  yield_max = excluded.yield_max,
  ciclo_meses = excluded.ciclo_meses,
  fuente = excluded.fuente,
  plantas_por_hectarea = excluded.plantas_por_hectarea,
  updated_at = now();

-- Tomate de árbol (sipsa product_code 148, id 248)
-- Reportes altoandinos citan ~2–4.5 kg/planta/mes en pico; anualizamos de forma
-- conservadora a 12–35 kg/planta/año (estimado). Densidad ~1.600 plantas/ha.
insert into public.product_yield_reference (
  product_id, unit_type, yield_min, yield_avg, yield_max, ciclo_meses, fuente, plantas_por_hectarea
) values (
  248, 'planta', 12, 20, 35, 12, 'estimado', 1600
)
on conflict (product_id) do update set
  unit_type = excluded.unit_type,
  yield_min = excluded.yield_min,
  yield_avg = excluded.yield_avg,
  yield_max = excluded.yield_max,
  ciclo_meses = excluded.ciclo_meses,
  fuente = excluded.fuente,
  plantas_por_hectarea = excluded.plantas_por_hectarea,
  updated_at = now();
