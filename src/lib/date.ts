import type { WeekdayIndex } from './types';

/** The week runs Saturday → Friday. */
export const DAY_LABELS = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'] as const;
export const DAY_LABELS_FULL = [
  'Saturday',
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
] as const;
export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

/** 'YYYY-MM-DD' in local time (never UTC — that shifts the day for most users). */
export function toKey(date: Date): string {
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

/** Parses 'YYYY-MM-DD' as a local midnight Date. */
export function fromKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function today(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function todayKey(): string {
  return toKey(today());
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/** Position of a date within the Sat→Fri week. JS getDay(): Sun=0 … Sat=6. */
export function weekdayIndex(date: Date): WeekdayIndex {
  return ((date.getDay() + 1) % 7) as WeekdayIndex;
}

/** The Saturday that opens the week containing `date`. */
export function startOfWeek(date: Date): Date {
  return addDays(date, -weekdayIndex(date));
}

/** The seven dates of the week containing `date`, Saturday first. */
export function weekDates(date: Date): Date[] {
  const start = startOfWeek(date);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function weekKeys(date: Date): string[] {
  return weekDates(date).map(toKey);
}

export function sameDay(a: Date, b: Date): boolean {
  return toKey(a) === toKey(b);
}

/** "Sep 5 – Sep 11" (adds the year when the week is not in the current year). */
export function formatWeekRange(date: Date): string {
  const dates = weekDates(date);
  const start = dates[0];
  const end = dates[6];
  const startText = `${MONTHS[start.getMonth()].slice(0, 3)} ${start.getDate()}`;
  const endText =
    start.getMonth() === end.getMonth()
      ? `${end.getDate()}`
      : `${MONTHS[end.getMonth()].slice(0, 3)} ${end.getDate()}`;
  const year = end.getFullYear() === new Date().getFullYear() ? '' : `, ${end.getFullYear()}`;
  return `${startText} – ${endText}${year}`;
}

/** "Sunday, September 6" */
export function formatLongDate(date: Date): string {
  return `${DAY_LABELS_FULL[weekdayIndex(date)]}, ${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

/** "Sep 6" */
export function formatShortDate(date: Date): string {
  return `${MONTHS[date.getMonth()].slice(0, 3)} ${date.getDate()}`;
}

export function formatMonthYear(date: Date): string {
  return `${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

/** Relative wording used by activity feeds: "just now", "3h ago", "Sep 2". */
export function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diff = Date.now() - then;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatShortDate(new Date(then));
}

export function formatMinutes(total: number | null): string {
  if (!total || total <= 0) return '—';
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (!h) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

/** Calendar grid for a month: whole weeks (Sat→Fri) covering every day of it. */
export function monthGrid(date: Date): Date[] {
  const first = new Date(date.getFullYear(), date.getMonth(), 1);
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  const start = startOfWeek(first);
  const cells: Date[] = [];
  let cursor = start;
  while (cursor <= last || cells.length % 7 !== 0) {
    cells.push(cursor);
    cursor = addDays(cursor, 1);
    if (cells.length > 42) break;
  }
  return cells;
}

export function isPast(dateKey: string): boolean {
  return dateKey < todayKey();
}
