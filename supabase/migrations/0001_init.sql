-- =============================================================================
-- Task Manager — schema, indexes and row-level security.
--
-- Apply with the Supabase CLI (`supabase db push`) or by pasting into the SQL
-- editor of a new project. Every table is keyed to auth.uid(), so a user can
-- only ever read or write their own rows.
-- =============================================================================

create extension if not exists "pgcrypto";

-- --------------------------------------------------------------- taxonomy ---

create table if not exists public.main_categories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 120),
  icon        text not null default '📁',
  color       text not null default '#2A835F',
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  -- Soft delete: the row moves to the Recycle Bin and keeps its history.
  deleted_at  timestamptz
);

create table if not exists public.subcategories (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users (id) on delete cascade,
  main_category_id  uuid not null references public.main_categories (id) on delete cascade,
  name              text not null check (char_length(name) between 1 and 120),
  position          integer not null default 0,
  created_at        timestamptz not null default now(),
  deleted_at        timestamptz
);

create table if not exists public.categories (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  subcategory_id  uuid not null references public.subcategories (id) on delete cascade,
  name            text not null check (char_length(name) between 1 and 120),
  position        integer not null default 0,
  created_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

-- ------------------------------------------------------------------ tasks ---

create table if not exists public.tasks (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  category_id        uuid not null references public.categories (id) on delete cascade,
  title              text not null check (char_length(title) between 1 and 500),
  description        text not null default '',
  priority           text not null default 'medium'
                       check (priority in ('low', 'medium', 'high', 'urgent')),
  due_date           date,
  estimated_minutes  integer check (estimated_minutes is null or estimated_minutes >= 0),
  actual_minutes     integer check (actual_minutes is null or actual_minutes >= 0),
  repeat_mode        text not null default 'none'
                       check (repeat_mode in ('none', 'daily', 'weekly', 'custom')),
  -- Scheduled weekdays as Sat→Fri indices: 0 = Saturday … 6 = Friday.
  repeat_days        smallint[] not null default '{}',
  tags               text[] not null default '{}',
  position           integer not null default 0,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  deleted_at         timestamptz,
  constraint tasks_repeat_days_range check (
    repeat_days <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]
  )
);

-- ------------------------------------------------------------ completions ---

-- One row per task per calendar date. Rolling into a new week never clears or
-- overwrites earlier rows, so weekly history is preserved indefinitely.
create table if not exists public.task_completions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  task_id          uuid not null references public.tasks (id) on delete cascade,
  completion_date  date not null,
  completed        boolean not null default false,
  completed_at     timestamptz,
  unique (task_id, completion_date)
);

-- --------------------------------------------------------------- settings ---

create table if not exists public.user_settings (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  settings    jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------- indexes ---

create index if not exists main_categories_user_idx  on public.main_categories (user_id, position);
create index if not exists subcategories_user_idx    on public.subcategories (user_id, main_category_id, position);
create index if not exists categories_user_idx       on public.categories (user_id, subcategory_id, position);
create index if not exists tasks_user_idx            on public.tasks (user_id, category_id, position);
create index if not exists tasks_due_idx             on public.tasks (user_id, due_date) where due_date is not null;
create index if not exists completions_task_idx      on public.task_completions (user_id, task_id, completion_date);
create index if not exists completions_date_idx      on public.task_completions (user_id, completion_date);

-- ----------------------------------------------------------------- grants ---

-- Supabase normally configures default privileges for these roles, but being
-- explicit means the migration behaves the same on a plain Postgres instance.
grant usage on schema public to authenticated;
grant select, insert, update, delete on
  public.main_categories,
  public.subcategories,
  public.categories,
  public.tasks,
  public.task_completions,
  public.user_settings
  to authenticated;

-- ----------------------------------------------------- row-level security ---

alter table public.main_categories  enable row level security;
alter table public.subcategories    enable row level security;
alter table public.categories       enable row level security;
alter table public.tasks            enable row level security;
alter table public.task_completions enable row level security;
alter table public.user_settings    enable row level security;

-- One policy per table covering all four verbs. `using` guards the rows a user
-- can see or change; `with check` stops them writing rows owned by anyone else.
do $$
declare
  t text;
begin
  foreach t in array array[
    'main_categories', 'subcategories', 'categories', 'tasks', 'task_completions'
  ] loop
    execute format('drop policy if exists %I on public.%I', t || '_owner', t);
    execute format(
      'create policy %I on public.%I
         for all
         to authenticated
         using (user_id = (select auth.uid()))
         with check (user_id = (select auth.uid()))',
      t || '_owner', t
    );
  end loop;
end $$;

drop policy if exists user_settings_owner on public.user_settings;
create policy user_settings_owner on public.user_settings
  for all
  to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- --------------------------------------------------------------- triggers ---

-- Keeps tasks.updated_at honest even for writes that do not set it.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists tasks_touch_updated_at on public.tasks;
create trigger tasks_touch_updated_at
  before update on public.tasks
  for each row execute function public.touch_updated_at();

drop trigger if exists user_settings_touch_updated_at on public.user_settings;
create trigger user_settings_touch_updated_at
  before update on public.user_settings
  for each row execute function public.touch_updated_at();
