-- Extend insumos table for DANE XLSX source (SIPSA-I)

alter table public.sipsa_insumos_monthly
  add column presentation text,
  add column data_source text not null default 'dane-xlsx';

create index idx_sipsa_insumos_monthly_data_source
  on public.sipsa_insumos_monthly (data_source);
