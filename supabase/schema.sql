-- NEXO Phase 1 — private, user-owned storage for Supabase Postgres.
-- Run this in the Supabase SQL Editor for a new project.
-- The browser must NEVER receive the service_role key.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name varchar(48) check (display_name is null or char_length(trim(display_name)) between 1 and 48),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title varchar(120) not null check (char_length(trim(title)) between 1 and 120),
  category varchar(24) not null default 'Personal' check (category in ('Personal','Estudio','Proyecto','Descanso')),
  due_date date,
  is_done boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);
create index if not exists tasks_user_created_idx on public.tasks(user_id, created_at desc);
create index if not exists tasks_user_due_idx on public.tasks(user_id, due_date);

create table if not exists public.daily_wellbeing (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  mood smallint check (mood is null or mood between 1 and 5),
  energy smallint check (energy is null or energy between 1 and 5),
  sleep_hours numeric(3,1) check (sleep_hours is null or sleep_hours between 0 and 24),
  movement_minutes smallint not null default 0 check (movement_minutes between 0 and 999),
  water_count smallint not null default 0 check (water_count between 0 and 999),
  outside boolean not null default false,
  stretch boolean not null default false,
  breaks boolean not null default false,
  private_note varchar(1200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);
create index if not exists daily_wellbeing_user_day_idx on public.daily_wellbeing(user_id, day desc);
comment on table public.daily_wellbeing is 'Private user-owned wellbeing records. Never expose to anonymous users or public community feeds.';

create table if not exists public.daily_activity (
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_date date not null,
  focus_sessions smallint not null default 0 check (focus_sessions between 0 and 1000),
  tasks_completed smallint not null default 0 check (tasks_completed between 0 and 1000),
  learning_modules smallint not null default 0 check (learning_modules between 0 and 1000),
  wellbeing_checkin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, activity_date)
);
create index if not exists daily_activity_user_date_idx on public.daily_activity(user_id, activity_date desc);

create table if not exists public.reflections (
  user_id uuid not null references auth.users(id) on delete cascade,
  reflection_date date not null,
  went_well varchar(1200),
  learned varchar(1200),
  next_step varchar(1200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, reflection_date)
);
comment on table public.reflections is 'Private reflection notes. Do not include in product analytics or social feeds by default.';

create table if not exists public.favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  discovery_id varchar(80) not null,
  created_at timestamptz not null default now(),
  primary key (user_id, discovery_id)
);

create table if not exists public.learning_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  module_id varchar(80) not null,
  completed_at timestamptz not null default now(),
  primary key (user_id, module_id)
);

create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  theme varchar(8) not null default 'light' check (theme in ('light','dark')),
  reminders_enabled boolean not null default false,
  reminder_interval_minutes smallint not null default 120 check (reminder_interval_minutes in (60,120,180)),
  updated_at timestamptz not null default now()
);

create table if not exists public.data_migrations (
  user_id uuid not null references auth.users(id) on delete cascade,
  migration_key varchar(80) not null,
  migrated_at timestamptz not null default now(),
  primary key (user_id, migration_key)
);

-- Enable Row Level Security on every table that contains user data.
alter table public.profiles enable row level security;
alter table public.tasks enable row level security;
alter table public.daily_wellbeing enable row level security;
alter table public.daily_activity enable row level security;
alter table public.reflections enable row level security;
alter table public.favorites enable row level security;
alter table public.learning_progress enable row level security;
alter table public.user_preferences enable row level security;
alter table public.data_migrations enable row level security;

-- Profiles are strictly tied to the matching Supabase Auth user.
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles for select to authenticated using (id = auth.uid());
drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles for insert to authenticated with check (id = auth.uid());
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- All remaining records can only be read or changed by their owner.
drop policy if exists tasks_own on public.tasks;
create policy tasks_own on public.tasks for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists daily_wellbeing_own on public.daily_wellbeing;
create policy daily_wellbeing_own on public.daily_wellbeing for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists daily_activity_own on public.daily_activity;
create policy daily_activity_own on public.daily_activity for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists reflections_own on public.reflections;
create policy reflections_own on public.reflections for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists favorites_own on public.favorites;
create policy favorites_own on public.favorites for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists learning_progress_own on public.learning_progress;
create policy learning_progress_own on public.learning_progress for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists user_preferences_own on public.user_preferences;
create policy user_preferences_own on public.user_preferences for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists data_migrations_own on public.data_migrations;
create policy data_migrations_own on public.data_migrations for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.tasks to authenticated;
grant select, insert, update, delete on public.daily_wellbeing to authenticated;
grant select, insert, update, delete on public.daily_activity to authenticated;
grant select, insert, update, delete on public.reflections to authenticated;
grant select, insert, update, delete on public.favorites to authenticated;
grant select, insert, update, delete on public.learning_progress to authenticated;
grant select, insert, update, delete on public.user_preferences to authenticated;
grant select, insert, update, delete on public.data_migrations to authenticated;
