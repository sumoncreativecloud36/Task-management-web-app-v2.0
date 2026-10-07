-- Sub-notes: a note can sit under another note in the Notes sidebar.
-- Run once in Supabase → SQL Editor, after 0002_notes.sql. Safe to run again.
-- No foreign key: the app removes sub-notes with their parent itself, and a
-- strict key could stall syncing if devices briefly disagree.

alter table public.notes
  add column if not exists parent_id uuid;

create index if not exists notes_parent_idx on public.notes (parent_id);
