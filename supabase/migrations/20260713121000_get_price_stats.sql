-- Price stats for income projections (1y / 3y / 5y windows).
-- price_min / price_max = average of worst/best 20% of daily prices (quintiles),
-- not absolute min/max peaks.

create or replace function public.get_price_stats(p_product_id bigint)
returns table (
  window_years int,
  price_min numeric,
  price_max numeric,
  price_avg numeric,
  price_stddev numeric,
  sample_count bigint
)
language sql
stable
security invoker
set search_path = public
as $$
  with windows as (
    select 1::int as window_years, interval '1 year' as span
    union all
    select 3::int, interval '3 years'
    union all
    select 5::int, interval '5 years'
  ),
  priced as (
    select
      w.window_years,
      p.price,
      ntile(5) over (
        partition by w.window_years
        order by p.price
      ) as quintile
    from windows w
    inner join public.sipsa_product_prices p
      on p.product_id = p_product_id
     and p.report_type = 'day'
     and p.date >= (current_date - w.span)
  )
  select
    window_years,
    avg(price) filter (where quintile = 1) as price_min,
    avg(price) filter (where quintile = 5) as price_max,
    avg(price) as price_avg,
    stddev_samp(price) as price_stddev,
    count(*)::bigint as sample_count
  from priced
  group by window_years
  order by window_years;
$$;

comment on function public.get_price_stats(bigint) is
  'SIPSA daily price stats by 1/3/5y windows. price_min/max = avg of worst/best 20% (not absolute min/max).';

grant execute on function public.get_price_stats(bigint) to anon, authenticated;
