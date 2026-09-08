import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseConfig } from './config';
import { emptyData, migrate } from '../reducer';
import type { AppData, Category, MainCategory, Subcategory, Task, TaskCompletion } from '../types';

let clientPromise: Promise<SupabaseClient> | null = null;

/** Lazily imported so a purely local install never pays for the SDK. */
export async function getSupabase(): Promise<SupabaseClient> {
  const config = supabaseConfig;
  if (!config) throw new Error('Supabase is not configured');
  if (!clientPromise) {
    clientPromise = import('@supabase/supabase-js').then(({ createClient }) =>
      createClient(config.url, config.anonKey, {
        auth: { persistSession: true, autoRefreshToken: true },
      }),
    );
  }
  return clientPromise;
}

type Row = Record<string, unknown>;

const TABLES = {
  mainCategories: 'main_categories',
  subcategories: 'subcategories',
  categories: 'categories',
  tasks: 'tasks',
  completions: 'task_completions',
} as const;

type Collection = keyof typeof TABLES;

const toRow: { [K in Collection]: (row: AppData[K][number], userId: string) => Row } = {
  mainCategories: (r, userId) => ({
    id: r.id,
    user_id: userId,
    name: r.name,
    icon: r.icon,
    color: r.color,
    position: r.position,
    created_at: r.createdAt,
    deleted_at: r.deletedAt,
  }),
  subcategories: (r, userId) => ({
    id: r.id,
    user_id: userId,
    main_category_id: r.mainCategoryId,
    name: r.name,
    position: r.position,
    created_at: r.createdAt,
    deleted_at: r.deletedAt,
  }),
  categories: (r, userId) => ({
    id: r.id,
    user_id: userId,
    subcategory_id: r.subcategoryId,
    name: r.name,
    position: r.position,
    created_at: r.createdAt,
    deleted_at: r.deletedAt,
  }),
  tasks: (r, userId) => ({
    id: r.id,
    user_id: userId,
    category_id: r.categoryId,
    title: r.title,
    description: r.description,
    priority: r.priority,
    due_date: r.dueDate,
    estimated_minutes: r.estimatedMinutes,
    actual_minutes: r.actualMinutes,
    repeat_mode: r.repeat,
    repeat_days: r.repeatDays,
    tags: r.tags,
    position: r.position,
    created_at: r.createdAt,
    updated_at: r.updatedAt,
    deleted_at: r.deletedAt,
  }),
  completions: (r, userId) => ({
    id: r.id,
    user_id: userId,
    task_id: r.taskId,
    completion_date: r.completionDate,
    completed: r.completed,
    completed_at: r.completedAt,
  }),
};

const fromRow = {
  mainCategories: (r: Row): MainCategory => ({
    id: String(r.id),
    name: String(r.name ?? ''),
    icon: String(r.icon ?? '📁'),
    color: String(r.color ?? '#2A835F'),
    position: Number(r.position ?? 0),
    createdAt: String(r.created_at ?? new Date().toISOString()),
    deletedAt: (r.deleted_at as string | null) ?? null,
  }),
  subcategories: (r: Row): Subcategory => ({
    id: String(r.id),
    mainCategoryId: String(r.main_category_id),
    name: String(r.name ?? ''),
    position: Number(r.position ?? 0),
    createdAt: String(r.created_at ?? new Date().toISOString()),
    deletedAt: (r.deleted_at as string | null) ?? null,
  }),
  categories: (r: Row): Category => ({
    id: String(r.id),
    subcategoryId: String(r.subcategory_id),
    name: String(r.name ?? ''),
    position: Number(r.position ?? 0),
    createdAt: String(r.created_at ?? new Date().toISOString()),
    deletedAt: (r.deleted_at as string | null) ?? null,
  }),
  tasks: (r: Row): Task => ({
    id: String(r.id),
    categoryId: String(r.category_id),
    title: String(r.title ?? ''),
    description: String(r.description ?? ''),
    priority: (r.priority as Task['priority']) ?? 'medium',
    dueDate: (r.due_date as string | null) ?? null,
    estimatedMinutes: (r.estimated_minutes as number | null) ?? null,
    actualMinutes: (r.actual_minutes as number | null) ?? null,
    repeat: (r.repeat_mode as Task['repeat']) ?? 'none',
    repeatDays: (r.repeat_days as Task['repeatDays']) ?? [],
    tags: (r.tags as string[]) ?? [],
    position: Number(r.position ?? 0),
    createdAt: String(r.created_at ?? new Date().toISOString()),
    updatedAt: String(r.updated_at ?? new Date().toISOString()),
    deletedAt: (r.deleted_at as string | null) ?? null,
  }),
  completions: (r: Row): TaskCompletion => ({
    id: String(r.id),
    taskId: String(r.task_id),
    completionDate: String(r.completion_date),
    completed: Boolean(r.completed),
    completedAt: (r.completed_at as string | null) ?? null,
  }),
};

const COLLECTIONS: Collection[] = [
  'mainCategories',
  'subcategories',
  'categories',
  'tasks',
  'completions',
];

/** Reads the signed-in user's whole dataset. Volumes here are personal-scale. */
export async function pullAll(userId: string): Promise<AppData> {
  const supabase = await getSupabase();
  const data = emptyData();

  for (const collection of COLLECTIONS) {
    const { data: rows, error } = await supabase.from(TABLES[collection]).select('*');
    if (error) throw new Error(`${TABLES[collection]}: ${error.message}`);
    const mapped = (rows ?? []).map((row) => fromRow[collection](row as Row));
    (data as unknown as Record<string, unknown>)[collection] = mapped;
  }

  const { data: prefs } = await supabase
    .from('user_settings')
    .select('settings')
    .eq('user_id', userId)
    .maybeSingle();
  if (prefs?.settings) data.settings = { ...data.settings, ...(prefs.settings as object) };

  return migrate(data);
}

function indexById<T extends { id: string }>(rows: T[]): Map<string, T> {
  return new Map(rows.map((row) => [row.id, row]));
}

/**
 * Write-through sync. Diffing the previous snapshot against the next one keeps
 * every reducer action synced without each action needing its own network code,
 * and a failed push simply retries on the following change.
 */
export async function pushDiff(prev: AppData, next: AppData, userId: string): Promise<void> {
  const supabase = await getSupabase();

  for (const collection of COLLECTIONS) {
    const before = indexById(prev[collection] as { id: string }[]);
    const after = indexById(next[collection] as { id: string }[]);

    const upserts: Row[] = [];
    for (const [id, row] of after) {
      const previous = before.get(id);
      if (previous && JSON.stringify(previous) === JSON.stringify(row)) continue;
      upserts.push((toRow[collection] as (r: unknown, u: string) => Row)(row, userId));
    }
    const removals = [...before.keys()].filter((id) => !after.has(id));

    if (upserts.length) {
      const { error } = await supabase.from(TABLES[collection]).upsert(upserts);
      if (error) throw new Error(`${TABLES[collection]} upsert: ${error.message}`);
    }
    if (removals.length) {
      const { error } = await supabase.from(TABLES[collection]).delete().in('id', removals);
      if (error) throw new Error(`${TABLES[collection]} delete: ${error.message}`);
    }
  }

  if (JSON.stringify(prev.settings) !== JSON.stringify(next.settings)) {
    const { error } = await supabase
      .from('user_settings')
      .upsert({ user_id: userId, settings: next.settings });
    if (error) throw new Error(`user_settings: ${error.message}`);
  }
}
