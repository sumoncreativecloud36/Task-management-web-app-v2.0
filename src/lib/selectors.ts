import {
  addDays,
  fromKey,
  startOfWeek,
  toKey,
  today,
  weekdayIndex,
  weekKeys,
} from './date';
import type {
  AppData,
  Category,
  MainCategory,
  Subcategory,
  Task,
  WeekdayIndex,
} from './types';

export const live = <T extends { deletedAt: string | null }>(rows: T[]): T[] =>
  rows.filter((r) => !r.deletedAt);

export const byPosition = <T extends { position: number }>(rows: T[]): T[] =>
  rows.slice().sort((a, b) => a.position - b.position);

/** A completion lookup keyed `${taskId}|${YYYY-MM-DD}`. */
export type CompletionMap = Map<string, boolean>;

export function completionMap(data: AppData): CompletionMap {
  const map: CompletionMap = new Map();
  for (const c of data.completions) map.set(`${c.taskId}|${c.completionDate}`, c.completed);
  return map;
}

export function isDone(map: CompletionMap, taskId: string, dateKey: string): boolean {
  return map.get(`${taskId}|${dateKey}`) === true;
}

/** Visible rows for each column of the four-column workspace. */
export function visibleMains(data: AppData): MainCategory[] {
  return byPosition(live(data.mainCategories));
}

export function visibleSubs(data: AppData, mainId: string | null): Subcategory[] {
  if (!mainId) return [];
  return byPosition(live(data.subcategories).filter((s) => s.mainCategoryId === mainId));
}

export function visibleCategories(data: AppData, subId: string | null): Category[] {
  if (!subId) return [];
  return byPosition(live(data.categories).filter((c) => c.subcategoryId === subId));
}

export function visibleTasks(data: AppData, categoryId: string | null): Task[] {
  if (!categoryId) return [];
  return byPosition(live(data.tasks).filter((t) => t.categoryId === categoryId));
}

/** Tasks whose whole ancestor chain is alive — the set every global view uses. */
export function allActiveTasks(data: AppData): Task[] {
  const mains = new Set(live(data.mainCategories).map((m) => m.id));
  const subs = new Set(
    live(data.subcategories).filter((s) => mains.has(s.mainCategoryId)).map((s) => s.id),
  );
  const categories = new Set(
    live(data.categories).filter((c) => subs.has(c.subcategoryId)).map((c) => c.id),
  );
  return live(data.tasks).filter((t) => categories.has(t.categoryId));
}

export interface TaskPath {
  main?: MainCategory;
  sub?: Subcategory;
  category?: Category;
}

export function pathForTask(data: AppData, task: Task): TaskPath {
  const category = data.categories.find((c) => c.id === task.categoryId);
  const sub = category && data.subcategories.find((s) => s.id === category.subcategoryId);
  const main = sub && data.mainCategories.find((m) => m.id === sub.mainCategoryId);
  return { main: main ?? undefined, sub: sub ?? undefined, category: category ?? undefined };
}

export function pathLabel(path: TaskPath): string {
  return [path.main?.name, path.sub?.name, path.category?.name].filter(Boolean).join(' / ');
}

/** Task counts roll up the hierarchy so every column can show a number. */
export function taskCounts(data: AppData) {
  const perCategory = new Map<string, number>();
  for (const task of live(data.tasks)) {
    perCategory.set(task.categoryId, (perCategory.get(task.categoryId) ?? 0) + 1);
  }
  const perSub = new Map<string, number>();
  for (const category of live(data.categories)) {
    const count = perCategory.get(category.id) ?? 0;
    perSub.set(category.subcategoryId, (perSub.get(category.subcategoryId) ?? 0) + count);
  }
  const perMain = new Map<string, number>();
  for (const sub of live(data.subcategories)) {
    const count = perSub.get(sub.id) ?? 0;
    perMain.set(sub.mainCategoryId, (perMain.get(sub.mainCategoryId) ?? 0) + count);
  }
  return { perCategory, perSub, perMain };
}

/** True when the task carries any scheduling information at all. */
export function hasSchedule(task: Task): boolean {
  return task.repeat !== 'none' || task.repeatDays.length > 0 || Boolean(task.dueDate);
}

/**
 * The weekday pattern a task repeats on, ignoring which week is being viewed.
 * A one-off task borrows the weekday of its due date so that its row still has
 * a meaningful checkbox.
 */
export function scheduledDays(task: Task): WeekdayIndex[] {
  if (task.repeat === 'daily') return [0, 1, 2, 3, 4, 5, 6];
  if (task.repeatDays.length) return task.repeatDays;
  if (task.dueDate) return [weekdayIndex(fromKey(task.dueDate))];
  return [];
}

/**
 * The days a task is actually scheduled for *within one specific week*. A
 * recurring task repeats every week; a one-off only occupies the week its due
 * date falls in, so it stops counting against later weeks' totals.
 */
export function scheduledDaysInWeek(task: Task, weekDate: Date): WeekdayIndex[] {
  const days = scheduledDays(task);
  if (!days.length) return [];
  const isOneOff = task.repeat === 'none' && !task.repeatDays.length && Boolean(task.dueDate);
  if (isOneOff) {
    const keys = weekKeys(weekDate);
    return keys.includes(task.dueDate!) ? days : [];
  }
  return days;
}

export function isScheduledOn(task: Task, date: Date): boolean {
  const days = scheduledDays(task);
  if (!days.length) return false;
  if (task.dueDate && !task.repeatDays.length && task.repeat === 'none') {
    return task.dueDate === toKey(date);
  }
  return days.includes(weekdayIndex(date));
}

/** True when every day this task is scheduled for that week is ticked. */
export function isWeekComplete(task: Task, map: CompletionMap, weekDate: Date): boolean {
  const days = scheduledDaysInWeek(task, weekDate);
  if (!days.length) return false;
  const keys = weekKeys(weekDate);
  return days.every((d) => isDone(map, task.id, keys[d]));
}

export function weekProgress(task: Task, map: CompletionMap, weekDate: Date) {
  const days = scheduledDaysInWeek(task, weekDate);
  const keys = weekKeys(weekDate);
  const done = days.filter((d) => isDone(map, task.id, keys[d])).length;
  return { done, total: days.length };
}

/** Tasks scheduled for a given date, across the whole hierarchy. */
export function tasksForDate(data: AppData, date: Date): Task[] {
  return allActiveTasks(data).filter((task) => isScheduledOn(task, date));
}

export interface DayStats {
  total: number;
  completed: number;
  remaining: number;
  percent: number;
}

export function statsForDate(data: AppData, map: CompletionMap, date: Date): DayStats {
  const key = toKey(date);
  const tasks = tasksForDate(data, date);
  const completed = tasks.filter((t) => isDone(map, t.id, key)).length;
  const total = tasks.length;
  return {
    total,
    completed,
    remaining: total - completed,
    percent: total ? Math.round((completed / total) * 100) : 0,
  };
}

export function statsForWeek(data: AppData, map: CompletionMap, weekDate: Date): DayStats {
  const keys = weekKeys(weekDate);
  const tasks = allActiveTasks(data);
  let total = 0;
  let completed = 0;
  for (const task of tasks) {
    for (const day of scheduledDaysInWeek(task, weekDate)) {
      total += 1;
      if (isDone(map, task.id, keys[day])) completed += 1;
    }
  }
  return {
    total,
    completed,
    remaining: total - completed,
    percent: total ? Math.round((completed / total) * 100) : 0,
  };
}

/** Consecutive days up to today where every scheduled task was completed. */
export function currentStreak(data: AppData, map: CompletionMap): number {
  let streak = 0;
  let cursor = today();
  for (let i = 0; i < 400; i += 1) {
    const stats = statsForDate(data, map, cursor);
    if (stats.total === 0) {
      // A day with nothing scheduled never breaks a streak, but today with no
      // work done yet should not inflate it either.
      if (i === 0) {
        cursor = addDays(cursor, -1);
        continue;
      }
      cursor = addDays(cursor, -1);
      continue;
    }
    if (stats.completed === stats.total) {
      streak += 1;
      cursor = addDays(cursor, -1);
      continue;
    }
    // Today only breaks the streak once it is over.
    if (i === 0) {
      cursor = addDays(cursor, -1);
      continue;
    }
    break;
  }
  return streak;
}

export function overdueTasks(data: AppData, map: CompletionMap): Task[] {
  const key = toKey(today());
  return allActiveTasks(data).filter(
    (t) => t.dueDate && t.dueDate < key && !isDone(map, t.id, t.dueDate),
  );
}

export interface ActivityItem {
  taskId: string;
  title: string;
  at: string;
  dateKey: string;
}

export function recentActivity(data: AppData, limit = 8): ActivityItem[] {
  const titles = new Map(data.tasks.map((t) => [t.id, t.title]));
  return data.completions
    .filter((c) => c.completed && c.completedAt && titles.has(c.taskId))
    .sort((a, b) => (a.completedAt! < b.completedAt! ? 1 : -1))
    .slice(0, limit)
    .map((c) => ({
      taskId: c.taskId,
      title: titles.get(c.taskId) ?? 'Task',
      at: c.completedAt!,
      dateKey: c.completionDate,
    }));
}

/** Completed ticks per day for the seven days of a week — the analytics bars. */
export function completionsByDay(data: AppData, weekDate: Date): number[] {
  const keys = weekKeys(weekDate);
  const active = new Set(allActiveTasks(data).map((t) => t.id));
  return keys.map(
    (key) =>
      data.completions.filter((c) => c.completed && c.completionDate === key && active.has(c.taskId))
        .length,
  );
}

export function completionsInRange(data: AppData, from: Date, to: Date): number {
  const fromKeyStr = toKey(from);
  const toKeyStr = toKey(to);
  const active = new Set(allActiveTasks(data).map((t) => t.id));
  return data.completions.filter(
    (c) =>
      c.completed &&
      active.has(c.taskId) &&
      c.completionDate >= fromKeyStr &&
      c.completionDate <= toKeyStr,
  ).length;
}

/** Completed ticks grouped by main category, for the productivity chart. */
export function productivityByMain(data: AppData, from: Date, to: Date) {
  const fromKeyStr = toKey(from);
  const toKeyStr = toKey(to);
  const mainByTask = new Map<string, string>();
  for (const task of allActiveTasks(data)) {
    const { main } = pathForTask(data, task);
    if (main) mainByTask.set(task.id, main.id);
  }
  const totals = new Map<string, number>();
  for (const c of data.completions) {
    if (!c.completed || c.completionDate < fromKeyStr || c.completionDate > toKeyStr) continue;
    const mainId = mainByTask.get(c.taskId);
    if (!mainId) continue;
    totals.set(mainId, (totals.get(mainId) ?? 0) + 1);
  }
  return visibleMains(data)
    .map((main) => ({ main, count: totals.get(main.id) ?? 0 }))
    .sort((a, b) => b.count - a.count);
}

export function weeksBack(count: number): Date[] {
  const start = startOfWeek(today());
  return Array.from({ length: count }, (_, i) => addDays(start, -7 * (count - 1 - i)));
}

export const PRIORITY_ORDER: Record<Task['priority'], number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};
