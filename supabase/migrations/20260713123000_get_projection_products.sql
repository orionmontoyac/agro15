-- Products available for income projections (have daily SIPSA prices)

create or replace function public.get_projection_products()
returns table (
  id bigint,
  product_code text,
  product_name text,
  unit_type text,
  has_yield_reference boolean
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    p.id,
    p.product_code,
    p.product_name,
    y.unit_type,
    (y.product_id is not null) as has_yield_reference
  from public.sipsa_products p
  left join public.product_yield_reference y on y.product_id = p.id
  where exists (
    select 1
    from public.sipsa_product_prices pp
    where pp.product_id = p.id
      and pp.report_type = 'day'
  )
  order by p.product_name;
$$;

grant execute on function public.get_projection_products() to anon, authenticated;
