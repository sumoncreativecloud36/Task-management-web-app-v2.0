import { uid } from './id';
import { toKey, today } from './date';
import type {
  AppData,
  Category,
  EntityKind,
  MainCategory,
  Priority,
  RepeatMode,
  Subcategory,
  Task,
  TaskCompletion,
  WeekdayIndex,
} from './types';

export const DATA_VERSION = 1;

export const DEFAULT_SETTINGS: AppData['settings'] = {
  reducedMotion: false,
  showWeekGrid: true,
  hideCompleted: false,
  density: 'compact',
};

export function emptyData(): AppData {
  return {
    version: DATA_VERSION,
    mainCategories: [],
    subcategories: [],
    categories: [],
    tasks: [],
    completions: [],
    settings: { ...DEFAULT_SETTINGS },
  };
}

export interface NewTaskInput {
  categoryId: string;
  title: string;
  description?: string;
  priority?: Priority;
  dueDate?: string | null;
  estimatedMinutes?: number | null;
  repeat?: RepeatMode;
  repeatDays?: WeekdayIndex[];
  tags?: string[];
}

export type Action =
  | { type: 'hydrate'; data: AppData }
  | { type: 'addMain'; name: string; icon?: string; color?: string }
  | { type: 'addSub'; mainCategoryId: string; name: string }
  | { type: 'addCategory'; subcategoryId: string; name: string }
  | { type: 'addTask'; input: NewTaskInput }
  /** Quick capture: files into `categoryId`, or the Inbox (created on demand). */
  | { type: 'addQuickTask'; input: Omit<NewTaskInput, 'categoryId'> & { categoryId?: string | null } }
  | { type: 'duplicateTask'; id: string }
  | { type: 'update'; kind: 'main'; id: string; patch: Partial<MainCategory> }
  | { type: 'update'; kind: 'sub'; id: string; patch: Partial<Subcategory> }
  | { type: 'update'; kind: 'category'; id: string; patch: Partial<Category> }
  | { type: 'update'; kind: 'task'; id: string; patch: Partial<Task> }
  | { type: 'softDelete'; kind: EntityKind; id: string }
  | { type: 'restore'; kind: EntityKind; id: string }
  | { type: 'purge'; kind: EntityKind; id: string }
  | { type: 'emptyBin' }
  | { type: 'move'; kind: EntityKind; id: string; targetId: string | null }
  | { type: 'setCompletion'; taskId: string; dateKey: string; completed: boolean }
  | { type: 'toggleCompletion'; taskId: string; dateKey: string }
  | { type: 'setSettings'; patch: Partial<AppData['settings']> }
  | { type: 'reset'; data?: AppData };

const COLLECTION: Record<EntityKind, keyof Pick<
  AppData,
  'mainCategories' | 'subcategories' | 'categories' | 'tasks'
>> = {
  main: 'mainCategories',
  sub: 'subcategories',
  category: 'categories',
  task: 'tasks',
};

function nextPosition(rows: { position: number }[]): number {
  return rows.reduce((max, row) => Math.max(max, row.position), -1) + 1;
}

/** Renumbers positions to 0..n-1 so drag-and-drop stays stable over time. */
function normalize<T extends { position: number }>(rows: T[]): T[] {
  return rows
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((row, index) => (row.position === index ? row : { ...row, position: index }));
}

/** Siblings share a parent; reordering must not leak across parents. */
function parentOf(kind: EntityKind, row: MainCategory | Subcategory | Category | Task): string {
  switch (kind) {
    case 'main':
      return 'root';
    case 'sub':
      return (row as Subcategory).mainCategoryId;
    case 'category':
      return (row as Category).subcategoryId;
    case 'task':
      return (row as Task).categoryId;
  }
}

function reorder(data: AppData, kind: EntityKind, id: string, targetId: string | null): AppData {
  const key = COLLECTION[kind];
  const rows = data[key] as (MainCategory | Subcategory | Category | Task)[];
  const moving = rows.find((r) => r.id === id);
  if (!moving) return data;
  const parent = parentOf(kind, moving);

  const siblings = normalize(rows.filter((r) => parentOf(kind, r) === parent && !r.deletedAt));
  const others = rows.filter((r) => parentOf(kind, r) !== parent || r.deletedAt);

  const from = siblings.findIndex((r) => r.id === id);
  if (from < 0) return data;
  const [picked] = siblings.splice(from, 1);
  const to = targetId ? siblings.findIndex((r) => r.id === targetId) : siblings.length;
  siblings.splice(to < 0 ? siblings.length : to, 0, picked);

  const repositioned = siblings.map((row, index) => ({ ...row, position: index }));
  return { ...data, [key]: [...others, ...repositioned] } as AppData;
}

/** Ids of everything hanging off a node, so purge and cascade stay consistent. */
export function descendantIds(data: AppData, kind: EntityKind, id: string) {
  const mainIds = new Set<string>();
  const subIds = new Set<string>();
  const categoryIds = new Set<string>();
  const taskIds = new Set<string>();

  if (kind === 'main') mainIds.add(id);
  if (kind === 'sub') subIds.add(id);
  if (kind === 'category') categoryIds.add(id);
  if (kind === 'task') taskIds.add(id);

  if (mainIds.size) {
    data.subcategories.filter((s) => mainIds.has(s.mainCategoryId)).forEach((s) => subIds.add(s.id));
  }
  if (subIds.size) {
    data.categories.filter((c) => subIds.has(c.subcategoryId)).forEach((c) => categoryIds.add(c.id));
  }
  if (categoryIds.size) {
    data.tasks.filter((t) => categoryIds.has(t.categoryId)).forEach((t) => taskIds.add(t.id));
  }
  return { mainIds, subIds, categoryIds, taskIds };
}

function purge(data: AppData, kind: EntityKind, id: string): AppData {
  const { mainIds, subIds, categoryIds, taskIds } = descendantIds(data, kind, id);
  return {
    ...data,
    mainCategories: data.mainCategories.filter((r) => !mainIds.has(r.id)),
    subcategories: data.subcategories.filter((r) => !subIds.has(r.id)),
    categories: data.categories.filter((r) => !categoryIds.has(r.id)),
    tasks: data.tasks.filter((r) => !taskIds.has(r.id)),
    completions: data.completions.filter((c) => !taskIds.has(c.taskId)),
  };
}

export const INBOX_NAME = 'Inbox';

/**
 * The Inbox is an ordinary Main → Sub → Category chain named "Inbox", so it
 * syncs and behaves like any other list. Returns its category id, if it exists.
 */
export function inboxCategoryId(data: AppData): string | null {
  const main = data.mainCategories.find((m) => !m.deletedAt && m.name === INBOX_NAME);
  if (!main) return null;
  const sub = data.subcategories.find((s) => !s.deletedAt && s.mainCategoryId === main.id);
  if (!sub) return null;
  const category = data.categories.find((c) => !c.deletedAt && c.subcategoryId === sub.id);
  return category?.id ?? null;
}

function ensureInbox(state: AppData): { state: AppData; categoryId: string } {
  const existing = inboxCategoryId(state);
  if (existing) return { state, categoryId: existing };

  let next = state;
  let main = next.mainCategories.find((m) => !m.deletedAt && m.name === INBOX_NAME);
  if (!main) {
    next = reducer(next, { type: 'addMain', name: INBOX_NAME, icon: '📥', color: '#12544F' });
    main = next.mainCategories[next.mainCategories.length - 1];
    // The Inbox sits at the top of the category tree.
    next = reducer(next, { type: 'move', kind: 'main', id: main.id, targetId: visibleFirstMain(next, main.id) });
  }
  let sub = next.subcategories.find((s) => !s.deletedAt && s.mainCategoryId === main!.id);
  if (!sub) {
    next = reducer(next, { type: 'addSub', mainCategoryId: main.id, name: 'General' });
    sub = next.subcategories[next.subcategories.length - 1];
  }
  next = reducer(next, { type: 'addCategory', subcategoryId: sub.id, name: INBOX_NAME });
  const category = next.categories[next.categories.length - 1];
  return { state: next, categoryId: category.id };
}

function visibleFirstMain(data: AppData, exceptId: string): string | null {
  const first = data.mainCategories
    .filter((m) => !m.deletedAt && m.id !== exceptId)
    .sort((a, b) => a.position - b.position)[0];
  return first?.id ?? null;
}

function stamp<T extends { id: string }>(rows: T[], id: string, patch: Partial<T>): T[] {
  return rows.map((row) => (row.id === id ? { ...row, ...patch } : row));
}

export function reducer(state: AppData, action: Action): AppData {
  const now = new Date().toISOString();

  switch (action.type) {
    case 'hydrate':
      return action.data;

    case 'reset':
      return action.data ?? emptyData();

    case 'addMain': {
      const row: MainCategory = {
        id: uid(),
        name: action.name.trim(),
        icon: action.icon ?? '📁',
        color: action.color ?? '#2A835F',
        position: nextPosition(state.mainCategories),
        createdAt: now,
        deletedAt: null,
      };
      return { ...state, mainCategories: [...state.mainCategories, row] };
    }

    case 'addSub': {
      const siblings = state.subcategories.filter((s) => s.mainCategoryId === action.mainCategoryId);
      const row: Subcategory = {
        id: uid(),
        mainCategoryId: action.mainCategoryId,
        name: action.name.trim(),
        position: nextPosition(siblings),
        createdAt: now,
        deletedAt: null,
      };
      return { ...state, subcategories: [...state.subcategories, row] };
    }

    case 'addCategory': {
      const siblings = state.categories.filter((c) => c.subcategoryId === action.subcategoryId);
      const row: Category = {
        id: uid(),
        subcategoryId: action.subcategoryId,
        name: action.name.trim(),
        position: nextPosition(siblings),
        createdAt: now,
        deletedAt: null,
      };
      return { ...state, categories: [...state.categories, row] };
    }

    case 'addTask': {
      const input = action.input;
      const siblings = state.tasks.filter((t) => t.categoryId === input.categoryId);
      const row: Task = {
        id: uid(),
        categoryId: input.categoryId,
        title: input.title.trim(),
        description: input.description?.trim() ?? '',
        priority: input.priority ?? 'medium',
        dueDate: input.dueDate ?? null,
        estimatedMinutes: input.estimatedMinutes ?? null,
        actualMinutes: null,
        repeat: input.repeat ?? 'none',
        repeatDays: input.repeatDays?.length ? [...input.repeatDays].sort((a, b) => a - b) : [],
        tags: input.tags ?? [],
        position: nextPosition(siblings),
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      };
      return { ...state, tasks: [...state.tasks, row] };
    }

    case 'addQuickTask': {
      const { categoryId, ...rest } = action.input;
      const target = categoryId
        ? state.categories.find((c) => c.id === categoryId && !c.deletedAt)
        : undefined;
      if (target) return reducer(state, { type: 'addTask', input: { ...rest, categoryId: target.id } });
      const inbox = ensureInbox(state);
      return reducer(inbox.state, { type: 'addTask', input: { ...rest, categoryId: inbox.categoryId } });
    }

    case 'duplicateTask': {
      const source = state.tasks.find((t) => t.id === action.id);
      if (!source) return state;
      const siblings = state.tasks.filter((t) => t.categoryId === source.categoryId);
      const copy: Task = {
        ...source,
        id: uid(),
        title: `${source.title} (copy)`,
        position: nextPosition(siblings),
        createdAt: now,
        updatedAt: now,
        actualMinutes: null,
        deletedAt: null,
      };
      return { ...state, tasks: [...state.tasks, copy] };
    }

    case 'update': {
      const key = COLLECTION[action.kind];
      if (action.kind === 'task') {
        const patch = { ...action.patch, updatedAt: now };
        return { ...state, tasks: stamp(state.tasks, action.id, patch) };
      }
      const rows = state[key] as { id: string }[];
      return { ...state, [key]: stamp(rows, action.id, action.patch as never) } as AppData;
    }

    case 'softDelete': {
      const key = COLLECTION[action.kind];
      const rows = state[key] as { id: string }[];
      return { ...state, [key]: stamp(rows, action.id, { deletedAt: now } as never) } as AppData;
    }

    case 'restore': {
      const key = COLLECTION[action.kind];
      const rows = state[key] as { id: string }[];
      let next = { ...state, [key]: stamp(rows, action.id, { deletedAt: null } as never) } as AppData;
      // A restored child is useless while an ancestor is still in the bin — bring
      // the chain back with it.
      if (action.kind === 'task') {
        const task = next.tasks.find((t) => t.id === action.id);
        const category = next.categories.find((c) => c.id === task?.categoryId);
        if (category?.deletedAt) next = reducer(next, { type: 'restore', kind: 'category', id: category.id });
      }
      if (action.kind === 'category') {
        const category = next.categories.find((c) => c.id === action.id);
        const sub = next.subcategories.find((s) => s.id === category?.subcategoryId);
        if (sub?.deletedAt) next = reducer(next, { type: 'restore', kind: 'sub', id: sub.id });
      }
      if (action.kind === 'sub') {
        const sub = next.subcategories.find((s) => s.id === action.id);
        const main = next.mainCategories.find((m) => m.id === sub?.mainCategoryId);
        if (main?.deletedAt) next = reducer(next, { type: 'restore', kind: 'main', id: main.id });
      }
      return next;
    }

    case 'purge':
      return purge(state, action.kind, action.id);

    case 'emptyBin': {
      let next = state;
      for (const row of state.mainCategories.filter((r) => r.deletedAt)) next = purge(next, 'main', row.id);
      for (const row of next.subcategories.filter((r) => r.deletedAt)) next = purge(next, 'sub', row.id);
      for (const row of next.categories.filter((r) => r.deletedAt)) next = purge(next, 'category', row.id);
      for (const row of next.tasks.filter((r) => r.deletedAt)) next = purge(next, 'task', row.id);
      return next;
    }

    case 'move':
      return reorder(state, action.kind, action.id, action.targetId);

    case 'setCompletion':
    case 'toggleCompletion': {
      const existing = state.completions.find(
        (c) => c.taskId === action.taskId && c.completionDate === action.dateKey,
      );
      const completed =
        action.type === 'setCompletion' ? action.completed : !(existing?.completed ?? false);

      if (existing) {
        return {
          ...state,
          completions: state.completions.map((c) =>
            c.id === existing.id
              ? { ...c, completed, completedAt: completed ? now : null }
              : c,
          ),
        };
      }
      const row: TaskCompletion = {
        id: uid(),
        taskId: action.taskId,
        completionDate: action.dateKey,
        completed,
        completedAt: completed ? now : null,
      };
      return { ...state, completions: [...state.completions, row] };
    }

    case 'setSettings':
      return { ...state, settings: { ...state.settings, ...action.patch } };

    default:
      return state;
  }
}

/** Fills in fields added by later versions so old saves keep working. */
export function migrate(raw: unknown): AppData {
  const base = emptyData();
  if (!raw || typeof raw !== 'object') return base;
  const input = raw as Partial<AppData>;
  const data: AppData = {
    version: DATA_VERSION,
    mainCategories: (input.mainCategories ?? []).map((r) => ({ ...r, deletedAt: r.deletedAt ?? null })),
    subcategories: (input.subcategories ?? []).map((r) => ({ ...r, deletedAt: r.deletedAt ?? null })),
    categories: (input.categories ?? []).map((r) => ({ ...r, deletedAt: r.deletedAt ?? null })),
    tasks: (input.tasks ?? []).map((r) => ({
      ...r,
      deletedAt: r.deletedAt ?? null,
      tags: r.tags ?? [],
      repeatDays: r.repeatDays ?? [],
      repeat: r.repeat ?? 'none',
      description: r.description ?? '',
      actualMinutes: r.actualMinutes ?? null,
      updatedAt: r.updatedAt ?? r.createdAt ?? new Date().toISOString(),
    })),
    completions: input.completions ?? [],
    settings: { ...base.settings, ...(input.settings ?? {}) },
  };
  return data;
}

export const TODAY_KEY = () => toKey(today());
