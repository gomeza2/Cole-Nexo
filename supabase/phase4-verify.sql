-- NEXO Phase 4 — read-only Supabase readiness audit.
-- Run AFTER supabase/schema.sql and supabase/phase2-community.sql in SQL Editor.
-- This script only reads catalog metadata. It does not modify data, grants, policies or schema.

with expected_tables(table_name) as (
  values
    ('profiles'), ('tasks'), ('daily_wellbeing'), ('daily_activity'),
    ('reflections'), ('favorites'), ('learning_progress'), ('user_preferences'),
    ('data_migrations'), ('community_identities'), ('focus_rooms'),
    ('focus_room_members'), ('discovery_posts'), ('discovery_reports'),
    ('community_blocks')
),
table_checks as (
  select
    'TABLE'::text as category,
    e.table_name::text as object_name,
    (to_regclass('public.' || e.table_name) is not null) as ok,
    case when to_regclass('public.' || e.table_name) is not null
      then 'La tabla existe en public.'
      else 'Falta la tabla: revisar el SQL de Fase 1 o Fase 2.'
    end::text as details
  from expected_tables e
),
rls_checks as (
  select
    'RLS'::text as category,
    e.table_name::text as object_name,
    coalesce(c.relrowsecurity, false) as ok,
    case
      when c.oid is null then 'No se puede comprobar: primero debe existir la tabla.'
      when c.relrowsecurity then 'Row Level Security está activado.'
      else 'RIESGO: activar RLS antes de usar datos reales.'
    end::text as details
  from expected_tables e
  left join pg_class c on c.oid = to_regclass('public.' || e.table_name)
),
expected_rpcs(signature) as (
  values
    ('public.nexo_can_broadcast_focus_room(text)'),
    ('public.get_focus_room(uuid)'),
    ('public.create_focus_room(text, integer)'),
    ('public.join_focus_room(text)'),
    ('public.heartbeat_focus_room(uuid)'),
    ('public.start_focus_session(uuid, integer)'),
    ('public.pause_focus_session(uuid)'),
    ('public.resume_focus_session(uuid)'),
    ('public.finish_focus_session(uuid)'),
    ('public.leave_focus_room(uuid)'),
    ('public.create_discovery_post(text)'),
    ('public.get_discovery_wall(integer)'),
    ('public.get_my_discovery_posts(integer)'),
    ('public.report_discovery_post(uuid, text)'),
    ('public.block_community_alias(uuid)'),
    ('public.get_discovery_moderation_queue(integer)'),
    ('public.moderate_discovery_post(uuid, text)')
),
rpc_checks as (
  select
    'RPC'::text as category,
    e.signature::text as object_name,
    (
      to_regprocedure(e.signature) is not null
      and coalesce(has_function_privilege('authenticated', to_regprocedure(e.signature), 'EXECUTE'), false)
    ) as ok,
    case
      when to_regprocedure(e.signature) is null then 'Falta la función RPC: ejecutar Fase 2 completa.'
      when not coalesce(has_function_privilege('authenticated', to_regprocedure(e.signature), 'EXECUTE'), false)
        then 'La función existe pero authenticated no tiene EXECUTE.'
      else 'La función existe y authenticated tiene EXECUTE.'
    end::text as details
  from expected_rpcs e
),
expected_policies(schemaname, tablename, policyname) as (
  values
    ('public','profiles','profiles_select_own'),
    ('public','profiles','profiles_insert_own'),
    ('public','profiles','profiles_update_own'),
    ('public','tasks','tasks_own'),
    ('public','daily_wellbeing','daily_wellbeing_own'),
    ('public','daily_activity','daily_activity_own'),
    ('public','reflections','reflections_own'),
    ('public','favorites','favorites_own'),
    ('public','learning_progress','learning_progress_own'),
    ('public','user_preferences','user_preferences_own'),
    ('public','data_migrations','data_migrations_own'),
    ('public','community_identities','nexo_focus_member_select_own'),
    ('public','focus_rooms','nexo_focus_room_member_select'),
    ('realtime','messages','nexo_focus_private_channel_receive'),
    ('realtime','messages','nexo_focus_private_channel_send')
),
policy_checks as (
  select
    'POLICY'::text as category,
    (e.schemaname || '.' || e.tablename || '.' || e.policyname)::text as object_name,
    exists (
      select 1 from pg_policies p
      where p.schemaname = e.schemaname
        and p.tablename = e.tablename
        and p.policyname = e.policyname
    ) as ok,
    case when exists (
      select 1 from pg_policies p
      where p.schemaname = e.schemaname
        and p.tablename = e.tablename
        and p.policyname = e.policyname
    ) then 'La política esperada existe.'
      else 'Falta la política: revisar el SQL de fases 1/2 y el esquema realtime.'
    end::text as details
  from expected_policies e
),
realtime_check as (
  select
    'REALTIME'::text as category,
    'supabase_realtime.public.focus_room_members'::text as object_name,
    exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'focus_room_members'
    ) as ok,
    case when exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'focus_room_members'
    ) then 'La tabla de presencia/membresía está en la publicación Realtime.'
      else 'Falta la publicación o la tabla. Revisar Realtime en el proyecto Supabase.'
    end::text as details
),
all_checks as (
  select * from table_checks
  union all select * from rls_checks
  union all select * from rpc_checks
  union all select * from policy_checks
  union all select * from realtime_check
)
select
  category,
  object_name,
  case when ok then 'OK' else 'REVISAR' end as status,
  details
from all_checks
order by
  case category
    when 'TABLE' then 1
    when 'RLS' then 2
    when 'RPC' then 3
    when 'POLICY' then 4
    when 'REALTIME' then 5
    else 6
  end,
  object_name;
