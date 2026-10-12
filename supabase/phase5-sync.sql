-- NEXO Phase 5 — explicit, versioned cloud snapshot sync.
-- Run AFTER supabase/schema.sql and supabase/phase2-community.sql.
-- This feature is MANUAL OPT-IN: it never uploads personal data automatically.
-- The browser may use only the Supabase publishable key, never service_role.

create table if not exists public.nexo_user_snapshots (
  user_id uuid primary key references auth.users(id) on delete cascade,
  snapshot_version bigint not null default 1 check (snapshot_version >= 1),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.nexo_user_snapshots enable row level security;
comment on table public.nexo_user_snapshots is
  'Private opt-in NEXO backup. Access is through versioned RPC only; direct browser table access is revoked. Payload may contain personal tasks, wellbeing and reflection notes.';

revoke all on table public.nexo_user_snapshots from public, anon, authenticated;

create or replace function public.get_nexo_snapshot()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_snapshot public.nexo_user_snapshots%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select *
    into v_snapshot
    from public.nexo_user_snapshots
    where user_id = v_user_id;

  if not found then
    return jsonb_build_object(
      'exists', false,
      'version', 0,
      'payload', null,
      'updated_at', null
    );
  end if;

  return jsonb_build_object(
    'exists', true,
    'version', v_snapshot.snapshot_version,
    'payload', v_snapshot.payload,
    'updated_at', v_snapshot.updated_at
  );
end;
$$;

create or replace function public.save_nexo_snapshot(
  p_expected_version bigint,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_snapshot public.nexo_user_snapshots%rowtype;
  v_new_version bigint;
  v_now timestamptz;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_expected_version is null or p_expected_version < 0 then
    raise exception 'Invalid expected version' using errcode = '22023';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object'
     or coalesce(p_payload ->> 'product', '') <> 'NEXO'
     or coalesce(p_payload ->> 'schemaVersion', '') <> '1'
     or coalesce(jsonb_typeof(p_payload -> 'state'), '') <> 'object'
     or coalesce(jsonb_typeof(p_payload #> '{state,tasks}'), '') <> 'array'
     or coalesce(jsonb_typeof(p_payload #> '{state,favorites}'), '') <> 'array'
     or coalesce(jsonb_typeof(p_payload -> 'local'), '') <> 'object' then
    raise exception 'Invalid NEXO snapshot format' using errcode = '22023';
  end if;
  if octet_length(p_payload::text) > 1500000 then
    raise exception 'Snapshot exceeds the 1.5 MB limit' using errcode = '22023';
  end if;
  if exists (
    select 1
    from jsonb_object_keys(p_payload -> 'local') as item(key)
    where item.key not in (
      'nexo.wellbeing.home.v1',
      'nexo-reflex-ninja-top3-v1',
      'nexo-discovery-learned-v1',
      'nexo.companion.weekly.v1',
      'nexo.companion.reflection.v1'
    )
  ) then
    raise exception 'Snapshot contains an unsupported local key' using errcode = '22023';
  end if;
  if exists (
    select 1
    from jsonb_each(p_payload -> 'local') as item(key, value)
    where jsonb_typeof(item.value) <> 'string'
  ) then
    raise exception 'Local snapshot values must be JSON strings' using errcode = '22023';
  end if;

  -- Serialize first-write and update attempts for the same account.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text, 0)
  );
  v_now := clock_timestamp();

  select *
    into v_snapshot
    from public.nexo_user_snapshots
    where user_id = v_user_id
    for update;

  if not found then
    if p_expected_version <> 0 then
      return jsonb_build_object(
        'saved', false, 'conflict', true, 'exists', false,
        'version', 0, 'payload', null, 'updated_at', null
      );
    end if;

    insert into public.nexo_user_snapshots (
      user_id, snapshot_version, payload, created_at, updated_at
    ) values (
      v_user_id, 1, p_payload, v_now, v_now
    );

    return jsonb_build_object(
      'saved', true, 'conflict', false, 'exists', true,
      'version', 1, 'payload', p_payload, 'updated_at', v_now
    );
  end if;

  if v_snapshot.snapshot_version <> p_expected_version then
    return jsonb_build_object(
      'saved', false, 'conflict', true, 'exists', true,
      'version', v_snapshot.snapshot_version,
      'payload', v_snapshot.payload,
      'updated_at', v_snapshot.updated_at
    );
  end if;

  v_new_version := v_snapshot.snapshot_version + 1;

  update public.nexo_user_snapshots
    set snapshot_version = v_new_version,
        payload = p_payload,
        updated_at = v_now
    where user_id = v_user_id;

  return jsonb_build_object(
    'saved', true, 'conflict', false, 'exists', true,
    'version', v_new_version, 'payload', p_payload, 'updated_at', v_now
  );
end;
$$;

revoke all on function public.get_nexo_snapshot() from public, anon;
revoke all on function public.save_nexo_snapshot(bigint, jsonb) from public, anon;
grant execute on function public.get_nexo_snapshot() to authenticated;
grant execute on function public.save_nexo_snapshot(bigint, jsonb) to authenticated;
