-- NEXO Phase 5 — read-only check for private cloud snapshot sync.
-- Run after supabase/phase5-sync.sql in Supabase SQL Editor.
-- This query does not modify schema, policies, grants or user data.

with checks as (
  select
    'TABLE'::text as category,
    'public.nexo_user_snapshots'::text as object_name,
    to_regclass('public.nexo_user_snapshots') is not null as ok,
    'La tabla privada de copias debe existir.'::text as purpose
  union all
  select
    'RLS',
    'public.nexo_user_snapshots',
    coalesce(c.relrowsecurity, false),
    'RLS debe estar activado.'
  from (select to_regclass('public.nexo_user_snapshots')::oid as oid) r
  left join pg_class c on c.oid = r.oid
  union all
  select
    'DIRECT_ACCESS',
    'authenticated SELECT public.nexo_user_snapshots',
    not coalesce(has_table_privilege('authenticated',to_regclass('public.nexo_user_snapshots')::oid,'SELECT'), false),
    'El navegador no debe leer la tabla directamente; usa RPC autenticadas.'
  union all
  select
    'DIRECT_ACCESS',
    'authenticated INSERT public.nexo_user_snapshots',
    not coalesce(has_table_privilege('authenticated',to_regclass('public.nexo_user_snapshots')::oid,'INSERT'), false),
    'El navegador no debe insertar directamente en la tabla.'
  union all
  select
    'RPC',
    'public.get_nexo_snapshot()',
    to_regprocedure('public.get_nexo_snapshot()') is not null
      and coalesce(has_function_privilege('authenticated',to_regprocedure('public.get_nexo_snapshot()')::oid,'EXECUTE'),false),
    'La función de lectura debe existir y permitir EXECUTE a authenticated.'
  union all
  select
    'RPC',
    'public.save_nexo_snapshot(bigint,jsonb)',
    to_regprocedure('public.save_nexo_snapshot(bigint,jsonb)') is not null
      and coalesce(has_function_privilege('authenticated',to_regprocedure('public.save_nexo_snapshot(bigint,jsonb)')::oid,'EXECUTE'),false),
    'La función de guardado versionado debe existir y permitir EXECUTE a authenticated.'
  union all
  select
    'RPC',
    'public.get_nexo_snapshot() for anon',
    not coalesce(has_function_privilege('anon',to_regprocedure('public.get_nexo_snapshot()')::oid,'EXECUTE'),false),
    'Los usuarios no autenticados no deben ejecutar la lectura.'
  union all
  select
    'RPC',
    'public.save_nexo_snapshot(bigint,jsonb) for anon',
    not coalesce(has_function_privilege('anon',to_regprocedure('public.save_nexo_snapshot(bigint,jsonb)')::oid,'EXECUTE'),false),
    'Los usuarios no autenticados no deben ejecutar el guardado.'
)
select category, object_name,
       case when ok then 'OK' else 'REVISAR' end as status,
       purpose
from checks
order by category, object_name;
