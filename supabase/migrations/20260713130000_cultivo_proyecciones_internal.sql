-- Internal Agro15 projections: no per-user ownership.
-- Writes go through service role from the API; browser history uses localStorage.

drop policy if exists "Users select own cultivo_proyecciones" on public.cultivo_proyecciones;
drop policy if exists "Users insert own cultivo_proyecciones" on public.cultivo_proyecciones;
drop policy if exists "Users update own cultivo_proyecciones" on public.cultivo_proyecciones;
drop policy if exists "Users delete own cultivo_proyecciones" on public.cultivo_proyecciones;

drop index if exists public.cultivo_proyecciones_user_id_created_at_idx;

alter table public.cultivo_proyecciones
  drop column if exists user_id;

create index if not exists cultivo_proyecciones_created_at_idx
  on public.cultivo_proyecciones (created_at desc);

comment on table public.cultivo_proyecciones is
  'Internal Agro15 projection log. Browser history is stored in localStorage; this table is written by the API with the service role.';
