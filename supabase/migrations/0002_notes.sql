-- Notes tab: free-form documents, one row per note, private to each user.
-- Run once in Supabase → SQL Editor. Safe to run again.

create table if not exists public.notes (
  id          uuid primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  title       text not null default '',
  content     text not null default '',
  pinned      boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists notes_user_idx on public.notes (user_id, updated_at desc);

grant select, insert, update, delete on public.notes to authenticated;

alter table public.notes enable row level security;

drop policy if exists notes_owner on public.notes;
create policy notes_owner on public.notes
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
