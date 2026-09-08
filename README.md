# Task Manager

A spreadsheet-inspired weekly task manager for everyday personal productivity.
Four linked columns — **Main Category → Subcategory → Category → Tasks** — and a
Saturday-to-Friday completion grid on every task row.

The app runs entirely in the browser out of the box. Point it at a Supabase
project and the same data syncs to Postgres with per-user row-level security.

```
┌──────────────┬──────────────┬──────────────┬──────────────────────────────┐
│ MAIN         │ SUBCATEGORY  │ CATEGORY     │ TASKS   SAT SUN MON … FRI    │
│ 💼 Work   24 │ Websites  12 │ My Website 3 │ Build homepage  ✓ ○ ○ … ○    │
│ 🎨 Design  9 │ Marketing  8 │ Client A   2 │ Create logo     ○ ✓ ○ … ○    │
└──────────────┴──────────────┴──────────────┴──────────────────────────────┘
```

## Quick start

```bash
npm install
npm run dev      # http://localhost:5173
```

The first run seeds sample categories and two weeks of completion history so
every view has something to show. Replace it any time from **Settings → Load
sample data / Delete everything**.

```bash
npm run build     # typecheck + production bundle into dist/
npm run preview   # serve the production build
```

## Views

| View | What it is for |
| --- | --- |
| **Dashboard** | Today and week progress, streak, overdue, recent activity |
| **Tasks** | The four-column workspace with the inline weekly grid |
| **Today** | Just what is scheduled for one day, with day stepping |
| **Week** | The full spreadsheet: every task as a row, Sat→Fri as columns |
| **Calendar** | Month grid with a day panel for adding and completing work |
| **Analytics** | Weekly and monthly totals, daily bars, 8-week trend, per-category |
| **Recycle Bin** | Soft-deleted items, restorable or purgeable |
| **Settings** | Density, grid options, import/export, storage status |

## How completion is stored

Completion is **never** a single boolean on the task. Each tick writes one row
keyed by task *and* calendar date:

```
Task → Weekly completion → Daily completion → Date
```

Because rows are keyed by real dates, rolling into a new week never clears or
overwrites an earlier one. Week 1 keeps its Sat ✓ Sun ✓ while week 2 records its
own Sun ✓ Mon ✓, and the analytics and streak views read straight from that
history.

A task's *scheduled days* come from its repeat rule (daily, weekly, custom days)
or, for a one-off, from the weekday of its due date. A one-off only occupies the
week its due date falls in, so it stops counting against later weeks.

## Keyboard

| Keys | Action |
| --- | --- |
| `Ctrl`/`⌘` + `K` | Global search across all four levels |
| `Enter` | Create the task or category being typed |
| `Escape` | Cancel editing, close a dialog or menu |
| `Space` | Toggle the focused day checkbox |
| `↑` `↓` | Move between rows in a column |
| `Alt` + `↑` `↓` | Reorder the focused row |
| `F2` | Rename the focused category |
| `1`–`6` | Jump to Dashboard … Analytics |

Rows also reorder by drag-and-drop at every level.

## Storage

### Local (default)

With no environment variables set, everything lives in `localStorage` under
`taskmanager.data.v1`. No account, no network, no build configuration.

### Supabase + Postgres

```bash
cp .env.example .env.local
# VITE_SUPABASE_URL=https://<project>.supabase.co
# VITE_SUPABASE_ANON_KEY=<anon key>
```

Then apply the schema:

```bash
supabase db push          # or paste supabase/migrations/0001_init.sql
                          # into the project's SQL editor
```

With both variables present the app shows a sign-in screen (Supabase Auth,
email + password), loads that user's rows, and writes changes back through a
debounced diff of the previous snapshot. `localStorage` stays in place as an
offline cache, so a dropped connection degrades to local editing and re-syncs on
the next change.

Every table carries a `user_id` and a single `for all` policy of
`user_id = (select auth.uid())` with a matching `with check`, so a user can
neither read nor write another user's rows — nor forge one under someone else's
id. The migration was verified against Postgres 16: cross-user `select`,
`update` and `delete` all return zero rows, and a forged insert is rejected.

### Tables

```
main_categories   id, user_id, name, icon, color, position, created_at, deleted_at
subcategories     id, user_id, main_category_id, name, position, …
categories        id, user_id, subcategory_id, name, position, …
tasks             id, user_id, category_id, title, description, priority,
                  due_date, estimated_minutes, actual_minutes, repeat_mode,
                  repeat_days[], tags[], position, created_at, updated_at, deleted_at
task_completions  id, user_id, task_id, completion_date, completed, completed_at
                  unique (task_id, completion_date)
user_settings     user_id, settings jsonb
```

Deletes are soft (`deleted_at`) and land in the Recycle Bin; purging is a real
`delete` that cascades to descendants and their completion history.

## Design

Five colours, used consistently:

| Colour | Role |
| --- | --- |
| `#092328` | Application background |
| `#12544F` | Panels, column surfaces, borders |
| `#2A835F` | Primary buttons, active nav, selection, completed ticks, progress |
| `#8BBB92` | Secondary text, badges, chart details, hover accents |
| `#F5F7F4` | Primary text |

Every other tone in the interface is a `color-mix()` of those five, so surfaces,
borders and muted text stay in the same family. Inter with a system fallback,
8–12px radii, compact rows, no gradients or heavy shadows.

Responsive behaviour follows the shape of the data:

- **Desktop** — all four columns side by side.
- **Tablet** — the columns scroll horizontally with snap points.
- **Mobile** — one column at a time as a drill-down flow with a back button and
  step dots; each day checkbox carries its own label since the shared column
  header is off screen.

## Project layout

```
src/
  lib/
    types.ts       domain model, mirrors the SQL schema
    reducer.ts     every mutation, as one pure reducer
    selectors.ts   derived data: counts, schedules, stats, streaks
    date.ts        Sat→Fri week maths, all in local time
    search.ts      ranked search across all four levels
    store.tsx      persistence, Supabase sync, auth
    ui.tsx         view, selection and week-cursor state
    backends/      localStorage and Supabase adapters
  components/      column list, task row, forms, menus, dialogs, toasts
  views/           one file per view
supabase/migrations/0001_init.sql
```

State lives in a single reducer over one plain data object, so mutations are
synchronous and the UI is optimistic by construction — there is no request to
wait on before a checkbox turns green.
