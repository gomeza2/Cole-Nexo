-- NEXO Phase 2 — community, focus rooms, pseudonymous wall and moderation.
-- Run AFTER supabase/schema.sql in Supabase SQL Editor.
-- All social features require authenticated users. No anonymous public inserts.

create table if not exists public.community_identities (
  user_id uuid primary key references auth.users(id) on delete cascade,
  alias_id uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create table if not exists public.focus_rooms (
  id uuid primary key default gen_random_uuid(),
  join_code varchar(6) not null unique check (join_code ~ '^[A-Z0-9]{6}$'),
  title varchar(48) not null check (char_length(trim(title)) between 1 and 48),
  host_user_id uuid not null references auth.users(id) on delete cascade,
  room_status varchar(10) not null default 'open' check (room_status in ('open','closed')),
  session_status varchar(10) not null default 'idle' check (session_status in ('idle','running','paused','finished')),
  duration_minutes smallint not null default 25 check (duration_minutes in (5,15,25,45)),
  session_ends_at timestamptz,
  remaining_seconds integer not null default 1500 check (remaining_seconds between 0 and 2700),
  max_participants smallint not null default 12 check (max_participants between 2 and 12),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists focus_rooms_open_created_idx
  on public.focus_rooms(room_status, created_at desc);

create table if not exists public.focus_room_members (
  room_id uuid not null references public.focus_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (room_id, user_id)
);
create index if not exists focus_room_members_presence_idx
  on public.focus_room_members(room_id, last_seen_at desc);

create table if not exists public.discovery_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  body varchar(420) not null check (char_length(trim(body)) between 12 and 400),
  status varchar(10) not null default 'pending' check (status in ('pending','approved','rejected','removed')),
  created_at timestamptz not null default now(),
  moderated_at timestamptz,
  moderated_by uuid references auth.users(id) on delete set null
);
create index if not exists discovery_posts_status_created_idx
  on public.discovery_posts(status, created_at desc);
create index if not exists discovery_posts_author_created_idx
  on public.discovery_posts(author_id, created_at desc);

create table if not exists public.discovery_reports (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.discovery_posts(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason varchar(24) not null check (reason in ('bullying','private_info','unsafe','spam','other')),
  created_at timestamptz not null default now(),
  unique(post_id, reporter_id)
);
create index if not exists discovery_reports_post_idx on public.discovery_reports(post_id, created_at desc);

create table if not exists public.community_blocks (
  blocker_user_id uuid not null references auth.users(id) on delete cascade,
  blocked_alias_id uuid not null references public.community_identities(alias_id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_user_id, blocked_alias_id)
);

alter table public.community_identities enable row level security;
alter table public.focus_rooms enable row level security;
alter table public.focus_room_members enable row level security;
alter table public.discovery_posts enable row level security;
alter table public.discovery_reports enable row level security;
alter table public.community_blocks enable row level security;

-- Tables are not directly writable by client code. The RPC functions below
-- validate access and return only fields intended for the current audience.
revoke all on public.community_identities from anon, authenticated;
revoke all on public.focus_rooms from anon, authenticated;
-- The client may inspect only non-secret room metadata, and only as an active member.
grant select (id, host_user_id, room_status) on public.focus_rooms to authenticated;
revoke all on public.focus_room_members from anon, authenticated;
revoke all on public.discovery_posts from anon, authenticated;
revoke all on public.discovery_reports from anon, authenticated;
revoke all on public.community_blocks from anon, authenticated;

-- Realtime authorization needs SELECT on memberships; RLS exposes only your
-- fresh membership row. Everything else is performed through security-definer RPC.
grant select on public.focus_room_members to authenticated;
drop policy if exists nexo_focus_member_select_own on public.focus_room_members;
create policy nexo_focus_member_select_own
  on public.focus_room_members for select to authenticated
  using (user_id = (select auth.uid()) and last_seen_at > now() - interval '2 minutes');

drop policy if exists nexo_focus_room_member_select on public.focus_rooms;
create policy nexo_focus_room_member_select
  on public.focus_rooms for select to authenticated
  using (
    exists (
      select 1 from public.focus_room_members m
      where m.room_id = focus_rooms.id
        and m.user_id = (select auth.uid())
        and m.last_seen_at > now() - interval '2 minutes'
    )
  );

create or replace function public.ensure_community_identity()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_alias uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  insert into public.community_identities(user_id)
    values ((select auth.uid()))
    on conflict (user_id) do nothing;
  select alias_id into v_alias
    from public.community_identities
    where user_id = (select auth.uid());
  return v_alias;
end;
$$;
revoke all on function public.ensure_community_identity() from public, anon, authenticated;

create or replace function public.get_focus_room(p_room_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_result jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'id', r.id,
    'title', r.title,
    'join_code', r.join_code,
    'session_status', r.session_status,
    'duration_minutes', r.duration_minutes,
    'session_ends_at', r.session_ends_at,
    'remaining_seconds', r.remaining_seconds,
    'is_host', r.host_user_id = (select auth.uid()),
    'participant_count', (
      select count(*)::integer from public.focus_room_members m
      where m.room_id = r.id and m.last_seen_at > now() - interval '2 minutes'
    ),
    'max_participants', r.max_participants
  ) into v_result
  from public.focus_rooms r
  where r.id = p_room_id
    and r.room_status = 'open'
    and exists (
      select 1 from public.focus_room_members m
      where m.room_id = r.id and m.user_id = (select auth.uid())
        and m.last_seen_at > now() - interval '2 minutes'
    );

  if v_result is null then
    raise exception 'Room not found, closed or membership expired' using errcode = '42501';
  end if;
  return v_result;
end;
$$;

create or replace function public.create_focus_room(p_title text default 'Sala tranquila', p_duration_minutes integer default 25)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room_id uuid;
  v_code text;
  v_capacity integer;
  v_recent_count integer;
  v_attempt integer := 0;
  v_duration integer := coalesce(p_duration_minutes, 25);
  v_title text := trim(coalesce(p_title, ''));
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if char_length(v_title) < 1 or char_length(v_title) > 48 then
    raise exception 'Room title must be between 1 and 48 characters' using errcode = '22023';
  end if;
  if v_duration not in (5,15,25,45) then
    raise exception 'Invalid focus duration' using errcode = '22023';
  end if;

  select count(*)::integer into v_recent_count from public.focus_rooms r
    where r.host_user_id = (select auth.uid()) and r.created_at > now() - interval '1 hour';
  if v_recent_count >= 5 then
    raise exception 'Room creation limit reached. Try again later.' using errcode = '54000';
  end if;

  perform public.ensure_community_identity();
  loop
    v_attempt := v_attempt + 1;
    v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    exit when not exists (select 1 from public.focus_rooms r where r.join_code = v_code);
    if v_attempt >= 10 then
      raise exception 'Could not allocate a room code. Try again.' using errcode = '55000';
    end if;
  end loop;

  insert into public.focus_rooms(join_code, title, host_user_id, duration_minutes, remaining_seconds)
  values (v_code, v_title, (select auth.uid()), v_duration, v_duration * 60)
  returning id into v_room_id;

  insert into public.focus_room_members(room_id, user_id)
  values (v_room_id, (select auth.uid()));

  return public.get_focus_room(v_room_id);
end;
$$;

create or replace function public.join_focus_room(p_join_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room_id uuid;
  v_count integer;
  v_host uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if coalesce(p_join_code, '') !~* '^[A-Z0-9]{6}$' then
    raise exception 'Enter the six-character room code' using errcode = '22023';
  end if;

  select r.id, r.host_user_id, r.max_participants into v_room_id, v_host, v_capacity
  from public.focus_rooms r
  where r.join_code = upper(trim(p_join_code)) and r.room_status = 'open'
  for update;
  if v_room_id is null then
    raise exception 'Room not found or closed' using errcode = 'P0002';
  end if;

  delete from public.focus_room_members m
  where m.room_id = v_room_id and m.last_seen_at < now() - interval '2 minutes'
    and m.user_id <> (select auth.uid());

  update public.focus_room_members
    set last_seen_at = now()
    where room_id = v_room_id and user_id = (select auth.uid());

  select count(*)::integer into v_count
    from public.focus_room_members m
    where m.room_id = v_room_id and m.last_seen_at > now() - interval '2 minutes';

  if not exists (
    select 1 from public.focus_room_members m
    where m.room_id = v_room_id and m.user_id = (select auth.uid())
      and m.last_seen_at > now() - interval '2 minutes'
  ) then
    if v_count >= v_capacity then
      raise exception 'This room is full. Try another one.' using errcode = '54000';
    end if;
    insert into public.focus_room_members(room_id, user_id, joined_at, last_seen_at)
      values (v_room_id, (select auth.uid()), now(), now());
  end if;

  -- Hand host controls to a currently online participant if the original host left.
  if not exists (
    select 1 from public.focus_room_members m
    where m.room_id = v_room_id and m.user_id = v_host
      and m.last_seen_at > now() - interval '2 minutes'
  ) then
    update public.focus_rooms set host_user_id = (select auth.uid()), updated_at = now()
    where id = v_room_id;
  end if;

  return public.get_focus_room(v_room_id);
end;
$$;

create or replace function public.heartbeat_focus_room(p_room_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_host uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  update public.focus_room_members set last_seen_at = now()
    where room_id = p_room_id and user_id = (select auth.uid());
  if not found then
    raise exception 'You are no longer a member of this room. Rejoin with the room code.' using errcode = '42501';
  end if;

  delete from public.focus_room_members m
    where m.room_id = p_room_id and m.user_id <> (select auth.uid())
      and m.last_seen_at < now() - interval '2 minutes';

  select host_user_id into v_host from public.focus_rooms
    where id = p_room_id and room_status = 'open';
  if v_host is null then
    raise exception 'Room is closed' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from public.focus_room_members m
    where m.room_id = p_room_id and m.user_id = v_host
      and m.last_seen_at > now() - interval '2 minutes'
  ) then
    update public.focus_rooms set host_user_id = (select auth.uid()), updated_at = now()
      where id = p_room_id;
  end if;

  return public.get_focus_room(p_room_id);
end;
$$;

create or replace function public.start_focus_session(p_room_id uuid, p_duration_minutes integer default 25)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_duration integer := coalesce(p_duration_minutes,25);
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if v_duration not in (5,15,25,45) then
    raise exception 'Invalid focus duration' using errcode = '22023';
  end if;
  update public.focus_rooms r
    set session_status = 'running',
        duration_minutes = v_duration,
        remaining_seconds = v_duration * 60,
        session_ends_at = now() + make_interval(mins => v_duration),
        updated_at = now()
  where r.id = p_room_id and r.room_status = 'open'
    and r.host_user_id = (select auth.uid())
    and exists (select 1 from public.focus_room_members m
      where m.room_id = r.id and m.user_id = (select auth.uid())
        and m.last_seen_at > now() - interval '2 minutes');
  if not found then
    raise exception 'Only the room host can start a session' using errcode = '42501';
  end if;
  return public.get_focus_room(p_room_id);
end;
$$;

create or replace function public.pause_focus_session(p_room_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_end timestamptz; v_remaining integer;
begin
  select r.session_ends_at into v_end
  from public.focus_rooms r
  where r.id = p_room_id and r.room_status = 'open' and r.host_user_id = (select auth.uid())
    and r.session_status = 'running'
    and exists (select 1 from public.focus_room_members m
      where m.room_id = r.id and m.user_id = (select auth.uid())
        and m.last_seen_at > now() - interval '2 minutes');
  if v_end is null then
    raise exception 'Only the host can pause an active session' using errcode = '42501';
  end if;
  v_remaining := greatest(0, ceil(extract(epoch from (v_end - now())))::integer);
  update public.focus_rooms set session_status = 'paused', session_ends_at = null,
    remaining_seconds = v_remaining, updated_at = now()
  where id = p_room_id;
  return public.get_focus_room(p_room_id);
end;
$$;

create or replace function public.resume_focus_session(p_room_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.focus_rooms r
    set session_status = 'running',
        session_ends_at = now() + make_interval(secs => r.remaining_seconds),
        updated_at = now()
  where r.id = p_room_id and r.room_status = 'open'
    and r.host_user_id = (select auth.uid()) and r.session_status = 'paused'
    and r.remaining_seconds > 0
    and exists (select 1 from public.focus_room_members m
      where m.room_id = r.id and m.user_id = (select auth.uid())
        and m.last_seen_at > now() - interval '2 minutes');
  if not found then
    raise exception 'Only the host can resume a paused session' using errcode = '42501';
  end if;
  return public.get_focus_room(p_room_id);
end;
$$;

create or replace function public.finish_focus_session(p_room_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.focus_rooms r
    set session_status = 'finished', session_ends_at = null,
        remaining_seconds = 0, updated_at = now()
  where r.id = p_room_id and r.room_status = 'open'
    and r.host_user_id = (select auth.uid())
    and exists (select 1 from public.focus_room_members m
      where m.room_id = r.id and m.user_id = (select auth.uid())
        and m.last_seen_at > now() - interval '2 minutes');
  if not found then
    raise exception 'Only the room host can finish this session' using errcode = '42501';
  end if;
  return public.get_focus_room(p_room_id);
end;
$$;

create or replace function public.leave_focus_room(p_room_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare v_is_host boolean;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  select (host_user_id = (select auth.uid())) into v_is_host
    from public.focus_rooms where id = p_room_id and room_status = 'open';
  if v_is_host is null then
    return false;
  end if;
  if v_is_host then
    update public.focus_rooms set room_status = 'closed', session_status = 'finished',
      session_ends_at = null, remaining_seconds = 0, updated_at = now()
      where id = p_room_id;
    delete from public.focus_room_members where room_id = p_room_id;
  else
    delete from public.focus_room_members
      where room_id = p_room_id and user_id = (select auth.uid());
  end if;
  return true;
end;
$$;

create or replace function public.create_discovery_post(p_body text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_body text := trim(coalesce(p_body, '')); v_count integer; v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if char_length(v_body) < 12 or char_length(v_body) > 400 then
    raise exception 'Write between 12 and 400 characters' using errcode = '22023';
  end if;
  -- Remove common direct-contact patterns before any moderator sees the text.
  if v_body ~* '(https?://|www\.|[[:alnum:]._%+-]+@[[:alnum:].-]+\.[a-z]{2,})'
     or char_length(regexp_replace(v_body, '[^0-9]', '', 'g')) >= 8 then
    raise exception 'For privacy, posts cannot include links, email addresses or phone-like number strings.' using errcode = '22023';
  end if;
  select count(*)::integer into v_count from public.discovery_posts p
    where p.author_id = (select auth.uid()) and p.created_at > now() - interval '24 hours';
  if v_count >= 5 then
    raise exception 'You have reached the daily post limit. You can try again tomorrow.' using errcode = '54000';
  end if;
  perform public.ensure_community_identity();
  insert into public.discovery_posts(author_id, body, status)
    values ((select auth.uid()), v_body, 'pending')
    returning id into v_id;
  return jsonb_build_object('id', v_id, 'status', 'pending');
end;
$$;

create or replace function public.get_discovery_wall(p_limit integer default 20)
returns table(post_id uuid, body text, created_at timestamptz, author_alias_id uuid, author_label text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.body::text, p.created_at, ci.alias_id,
    'Anónimo · ' || upper(substr(replace(ci.alias_id::text, '-', ''), 1, 6))
  from public.discovery_posts p
  join public.community_identities ci on ci.user_id = p.author_id
  where p.status = 'approved'
    and not exists (
      select 1 from public.community_blocks b
      where b.blocker_user_id = (select auth.uid()) and b.blocked_alias_id = ci.alias_id
    )
  order by p.created_at desc
  limit greatest(1, least(coalesce(p_limit, 20), 40));
$$;

create or replace function public.get_my_discovery_posts(p_limit integer default 10)
returns table(post_id uuid, body text, status text, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.body::text, p.status::text, p.created_at
  from public.discovery_posts p
  where p.author_id = (select auth.uid())
  order by p.created_at desc
  limit greatest(1, least(coalesce(p_limit, 10), 20));
$$;

create or replace function public.report_discovery_post(p_post_id uuid, p_reason text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare v_author uuid; v_count integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_reason not in ('bullying','private_info','unsafe','spam','other') then
    raise exception 'Invalid report category' using errcode = '22023';
  end if;
  select author_id into v_author from public.discovery_posts
    where id = p_post_id and status = 'approved';
  if v_author is null or v_author = (select auth.uid()) then
    raise exception 'Post cannot be reported' using errcode = '22023';
  end if;
  select count(*)::integer into v_count from public.discovery_reports
    where reporter_id = (select auth.uid()) and created_at > now() - interval '1 hour';
  if v_count >= 10 then
    raise exception 'Report limit reached. Try again later.' using errcode = '54000';
  end if;
  insert into public.discovery_reports(post_id, reporter_id, reason)
    values (p_post_id, (select auth.uid()), p_reason)
    on conflict (post_id, reporter_id) do nothing;
  return true;
end;
$$;

create or replace function public.block_community_alias(p_alias_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare v_own_alias uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  v_own_alias := public.ensure_community_identity();
  if p_alias_id is null or p_alias_id = v_own_alias
     or not exists (select 1 from public.community_identities ci where ci.alias_id = p_alias_id) then
    raise exception 'Invalid alias' using errcode = '22023';
  end if;
  insert into public.community_blocks(blocker_user_id, blocked_alias_id)
    values ((select auth.uid()), p_alias_id)
    on conflict do nothing;
  return true;
end;
$$;

create or replace function public.get_discovery_moderation_queue(p_limit integer default 30)
returns table(post_id uuid, body text, created_at timestamptz, author_label text, status text, report_count integer, report_reasons text[])
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'nexo_role', '') <> 'moderator' then
    raise exception 'Moderator access required' using errcode = '42501';
  end if;
  return query
    select p.id, p.body::text, p.created_at,
      'Anónimo · ' || upper(substr(replace(ci.alias_id::text, '-', ''), 1, 6)),
      p.status::text,
      count(r.id)::integer,
      coalesce(array_agg(distinct r.reason) filter (where r.reason is not null), array[]::text[])
    from public.discovery_posts p
    join public.community_identities ci on ci.user_id = p.author_id
    left join public.discovery_reports r on r.post_id = p.id
    where p.status = 'pending' or (p.status = 'approved' and r.id is not null)
    group by p.id, ci.alias_id
    order by case when p.status = 'pending' then 0 else 1 end, p.created_at asc
    limit greatest(1, least(coalesce(p_limit, 30), 60));
end;
$$;

create or replace function public.moderate_discovery_post(p_post_id uuid, p_status text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.jwt() -> 'app_metadata' ->> 'nexo_role', '') <> 'moderator' then
    raise exception 'Moderator access required' using errcode = '42501';
  end if;
  if p_status not in ('approved','rejected','removed') then
    raise exception 'Invalid moderation status' using errcode = '22023';
  end if;
  update public.discovery_posts
    set status = p_status, moderated_at = now(), moderated_by = (select auth.uid())
    where id = p_post_id and status in ('pending','approved');
  if not found then
    raise exception 'Post not found or already processed' using errcode = 'P0002';
  end if;
  return true;
end;
$$;

-- Private Realtime topics: only recent room members may receive presence/broadcast.
drop policy if exists nexo_focus_private_channel_receive on realtime.messages;
create policy nexo_focus_private_channel_receive
  on realtime.messages for select to authenticated
  using (
    extension in ('broadcast','presence')
    and exists (
      select 1 from public.focus_room_members m
      where m.user_id = (select auth.uid())
        and ('nexo-focus:' || m.room_id::text) = realtime.topic()
        and m.last_seen_at > now() - interval '2 minutes'
    )
  );

drop policy if exists nexo_focus_private_channel_send on realtime.messages;
create policy nexo_focus_private_channel_send
  on realtime.messages for insert to authenticated
  with check (
    (
      extension = 'presence'
      and exists (
        select 1 from public.focus_room_members m
        where m.user_id = (select auth.uid())
          and ('nexo-focus:' || m.room_id::text) = realtime.topic()
          and m.last_seen_at > now() - interval '2 minutes'
      )
    )
    or
    (
      extension = 'broadcast'
      and exists (
        select 1 from public.focus_room_members m
        join public.focus_rooms r on r.id = m.room_id
        where m.user_id = (select auth.uid())
          and r.host_user_id = (select auth.uid())
          and r.room_status = 'open'
          and ('nexo-focus:' || m.room_id::text) = realtime.topic()
          and m.last_seen_at > now() - interval '2 minutes'
      )
    )
  );

-- All privileged operations are invoked through validated RPC functions.
revoke all on function public.get_focus_room(uuid) from public, anon;
revoke all on function public.create_focus_room(text, integer) from public, anon;
revoke all on function public.join_focus_room(text) from public, anon;
revoke all on function public.heartbeat_focus_room(uuid) from public, anon;
revoke all on function public.start_focus_session(uuid, integer) from public, anon;
revoke all on function public.pause_focus_session(uuid) from public, anon;
revoke all on function public.resume_focus_session(uuid) from public, anon;
revoke all on function public.finish_focus_session(uuid) from public, anon;
revoke all on function public.leave_focus_room(uuid) from public, anon;
revoke all on function public.create_discovery_post(text) from public, anon;
revoke all on function public.get_discovery_wall(integer) from public, anon;
revoke all on function public.get_my_discovery_posts(integer) from public, anon;
revoke all on function public.report_discovery_post(uuid, text) from public, anon;
revoke all on function public.block_community_alias(uuid) from public, anon;
revoke all on function public.get_discovery_moderation_queue(integer) from public, anon;
revoke all on function public.moderate_discovery_post(uuid, text) from public, anon;

grant execute on function public.get_focus_room(uuid) to authenticated;
grant execute on function public.create_focus_room(text, integer) to authenticated;
grant execute on function public.join_focus_room(text) to authenticated;
grant execute on function public.heartbeat_focus_room(uuid) to authenticated;
grant execute on function public.start_focus_session(uuid, integer) to authenticated;
grant execute on function public.pause_focus_session(uuid) to authenticated;
grant execute on function public.resume_focus_session(uuid) to authenticated;
grant execute on function public.finish_focus_session(uuid) to authenticated;
grant execute on function public.leave_focus_room(uuid) to authenticated;
grant execute on function public.create_discovery_post(text) to authenticated;
grant execute on function public.get_discovery_wall(integer) to authenticated;
grant execute on function public.get_my_discovery_posts(integer) to authenticated;
grant execute on function public.report_discovery_post(uuid, text) to authenticated;
grant execute on function public.block_community_alias(uuid) to authenticated;
grant execute on function public.get_discovery_moderation_queue(integer) to authenticated;
grant execute on function public.moderate_discovery_post(uuid, text) to authenticated;

-- Supabase creates this publication in managed projects; don't add the same table twice.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'focus_room_members'
     ) then
    execute 'alter publication supabase_realtime add table public.focus_room_members';
  end if;
end
$$;

comment on table public.discovery_posts is 'Text-only pseudonymous wall. Every post stays pending until a moderator approves it.';
comment on table public.discovery_reports is 'Reports are private and visible to moderation tooling only.';
comment on table public.community_blocks is 'Per-user alias blocks. Blocked aliases are filtered out by get_discovery_wall.';
comment on table public.focus_room_members is 'Private membership used for Realtime authorization; stale presence expires after two minutes.';
