/** Domain model. Mirrors the SQL schema in supabase/migrations/0001_init.sql. */

export type Priority = 'low' | 'medium' | 'high' | 'urgent';
export type RepeatMode = 'none' | 'daily' | 'weekly' | 'custom';

/** Index into the Sat→Fri week. 0 = Saturday … 6 = Friday. */
export type WeekdayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface Entity {
  id: string;
  position: number;
  createdAt: string;
  /** ISO timestamp when soft-deleted (moved to Recycle Bin), else null. */
  deletedAt: string | null;
}

export interface MainCategory extends Entity {
  name: string;
  icon: string;
  color: string;
}

export interface Subcategory extends Entity {
  mainCategoryId: string;
  name: string;
}

export interface Category extends Entity {
  subcategoryId: string;
  name: string;
}

export interface Task extends Entity {
  categoryId: string;
  title: string;
  description: string;
  priority: Priority;
  /** 'YYYY-MM-DD' or null. */
  dueDate: string | null;
  estimatedMinutes: number | null;
  actualMinutes: number | null;
  repeat: RepeatMode;
  /** Days the task is scheduled for, as Sat→Fri indices. */
  repeatDays: WeekdayIndex[];
  tags: string[];
  updatedAt: string;
}

/**
 * One row per task per calendar date. Completion history is never overwritten
 * when the week rolls over — each week keeps its own records.
 */
export interface TaskCompletion {
  id: string;
  taskId: string;
  /** 'YYYY-MM-DD'. */
  completionDate: string;
  completed: boolean;
  completedAt: string | null;
}

export interface Settings {
  /** Reduce motion for users who prefer it, overriding the OS hint. */
  reducedMotion: boolean;
  /** Show the weekly Sat→Fri grid inline on every task row. */
  showWeekGrid: boolean;
  /** Hide tasks whose scheduled days are all complete. */
  hideCompleted: boolean;
  /** Compact spreadsheet density. */
  density: 'compact' | 'comfortable';
}

export interface AppData {
  version: number;
  mainCategories: MainCategory[];
  subcategories: Subcategory[];
  categories: Category[];
  tasks: Task[];
  completions: TaskCompletion[];
  settings: Settings;
}

export type ViewName =
  | 'dashboard'
  | 'tasks'
  | 'today'
  | 'week'
  | 'calendar'
  | 'analytics'
  | 'recycle'
  | 'settings';

export type EntityKind = 'main' | 'sub' | 'category' | 'task';
