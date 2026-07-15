-- Monthly SIPSA price bands (calendar month across history).
-- price_min/max = avg of worst/best 20% within that month (same method as get_price_stats).

create or replace function public.get_monthly_price_stats(p_product_id bigint)
returns table (
  month_number int,
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
  with priced as (
    select
      extract(month from p.date)::int as month_number,
      p.price,
      ntile(5) over (
        partition by extract(month from p.date)
        order by p.price
      ) as quintile
    from public.sipsa_product_prices p
    where p.product_id = p_product_id
      and p.report_type = 'day'
  )
  select
    month_number,
    avg(price) filter (where quintile = 1) as price_min,
    avg(price) filter (where quintile = 5) as price_max,
    avg(price) as price_avg,
    stddev_samp(price) as price_stddev,
    count(*)::bigint as sample_count
  from priced
  group by month_number
  order by month_number;
$$;

comment on function public.get_monthly_price_stats(bigint) is
  'Historical SIPSA daily prices by calendar month. price_min/max = avg of worst/best 20% within each month.';

grant execute on function public.get_monthly_price_stats(bigint) to anon, authenticated;
