import { MONTHS, addDays, startOfWeek, toKey, today, weekdayIndex } from './date';
import type { Priority, RepeatMode, WeekdayIndex } from './types';

/**
 * Natural-language quick capture. One line such as
 *   "Call mom tomorrow 30m !high #family"
 * becomes a title plus the fields it mentions. Anything the parser doesn't
 * recognise stays in the title, so nothing the user typed is ever lost.
 */
export interface ParsedTask {
  title: string;
  /** Present only when the text mentioned a date ("tomorrow", "fri", "30/9"…). */
  dueDate?: string;
  priority?: Priority;
  repeat?: RepeatMode;
  repeatDays?: WeekdayIndex[];
  estimatedMinutes?: number;
  /** Every #word, without the '#'. The caller decides which one names a list. */
  hashes: string[];
}

// Sat→Fri indices, matching WeekdayIndex.
const WEEKDAYS: Record<string, WeekdayIndex> = {
  sat: 0, saturday: 0,
  sun: 1, sunday: 1,
  mon: 2, monday: 2,
  tue: 3, tues: 3, tuesday: 3,
  wed: 4, wednesday: 4,
  thu: 5, thur: 5, thurs: 5, thursday: 5,
  fri: 6, friday: 6,
};

const MONTH_INDEX = new Map<string, number>();
MONTHS.forEach((name, i) => {
  MONTH_INDEX.set(name.toLowerCase(), i);
  MONTH_INDEX.set(name.slice(0, 3).toLowerCase(), i);
});
MONTH_INDEX.set('sept', 8);

const PRIORITY_WORDS: Record<string, Priority> = {
  '!!!': 'urgent', '!urgent': 'urgent', p1: 'urgent',
  '!!': 'high', '!high': 'high', p2: 'high',
  '!': 'medium', '!medium': 'medium', '!med': 'medium', p3: 'medium',
  '!low': 'low', p4: 'low',
};

/** The next date (1–7 days ahead) that falls on `day`. */
function nextWeekday(day: WeekdayIndex): Date {
  const now = today();
  const diff = (day - weekdayIndex(now) + 7) % 7 || 7;
  return addDays(now, diff);
}

/** A day/month without a year means the next time that date comes round. */
function upcoming(day: number, month: number): string | undefined {
  if (month < 0 || month > 11 || day < 1 || day > 31) return undefined;
  const now = today();
  let date = new Date(now.getFullYear(), month, day);
  if (date.getMonth() !== month) return undefined; // e.g. 31 Feb
  if (date < now) date = new Date(now.getFullYear() + 1, month, day);
  return toKey(date);
}

function parseDuration(word: string): number | undefined {
  const match = /^(?:(\d+(?:\.\d+)?)h(?:rs?|ours?)?)?(?:(\d+)m(?:in(?:s|utes?)?)?)?$/.exec(word);
  if (!match || (!match[1] && !match[2])) return undefined;
  const minutes = Math.round(Number(match[1] ?? 0) * 60) + Number(match[2] ?? 0);
  return minutes > 0 && minutes <= 24 * 60 ? minutes : undefined;
}

export function parseQuickAdd(input: string): ParsedTask {
  const words = input.trim().split(/\s+/).filter(Boolean);
  const lower = words.map((w) => w.toLowerCase().replace(/[,.]$/, ''));
  const used = new Array<boolean>(words.length).fill(false);
  const result: ParsedTask = { title: '', hashes: [] };

  const take = (...indices: number[]) => indices.forEach((i) => (used[i] = true));

  for (let i = 0; i < words.length; i += 1) {
    if (used[i]) continue;
    const w = lower[i];
    const next = lower[i + 1];
    const next2 = lower[i + 2];

    // #list or #tag
    if (w.startsWith('#') && w.length > 1) {
      result.hashes.push(words[i].slice(1).replace(/[,.]$/, ''));
      take(i);
      continue;
    }

    if (w in PRIORITY_WORDS) {
      result.priority = PRIORITY_WORDS[w];
      take(i);
      continue;
    }

    const minutes = parseDuration(w);
    if (minutes !== undefined) {
      result.estimatedMinutes = minutes;
      take(i);
      continue;
    }

    // Repeats: "daily", "everyday", "every day", "weekly", "every mon wed"
    if (w === 'daily' || w === 'everyday' || (w === 'every' && next === 'day')) {
      result.repeat = 'daily';
      result.repeatDays = [0, 1, 2, 3, 4, 5, 6];
      take(i, ...(w === 'every' ? [i + 1] : []));
      continue;
    }
    if (w === 'weekly' || (w === 'every' && next === 'week')) {
      result.repeat = 'weekly';
      take(i, ...(w === 'every' ? [i + 1] : []));
      continue;
    }
    if (w === 'every' && next && next in WEEKDAYS) {
      const days: WeekdayIndex[] = [];
      let j = i + 1;
      while (j < words.length && (lower[j] in WEEKDAYS || lower[j] === 'and' || lower[j] === '&')) {
        if (lower[j] in WEEKDAYS) days.push(WEEKDAYS[lower[j]]);
        take(j);
        j += 1;
      }
      take(i);
      const unique = [...new Set(days)].sort((a, b) => a - b);
      result.repeat = unique.length === 1 ? 'weekly' : 'custom';
      result.repeatDays = unique;
      i = j - 1;
      continue;
    }

    // Dates
    if (w === 'today' || w === 'tonight') {
      result.dueDate = toKey(today());
      take(i);
      continue;
    }
    if (w === 'tomorrow' || w === 'tmr' || w === 'tmrw') {
      result.dueDate = toKey(addDays(today(), 1));
      take(i);
      continue;
    }
    if (w === 'next' && next === 'week') {
      result.dueDate = toKey(addDays(startOfWeek(today()), 7));
      take(i, i + 1);
      continue;
    }
    if ((w === 'next' || w === 'on' || w === 'this') && next && next in WEEKDAYS) {
      result.dueDate = toKey(nextWeekday(WEEKDAYS[next]));
      take(i, i + 1);
      continue;
    }
    if (w in WEEKDAYS) {
      result.dueDate = toKey(nextWeekday(WEEKDAYS[w]));
      take(i);
      continue;
    }
    if (w === 'in' && next && /^\d+$/.test(next) && next2 && /^(day|days|week|weeks)$/.test(next2)) {
      const n = Number(next) * (next2.startsWith('week') ? 7 : 1);
      result.dueDate = toKey(addDays(today(), n));
      take(i, i + 1, i + 2);
      continue;
    }
    // 30/9 or 30-9 (day first)
    const numeric = /^(\d{1,2})[/-](\d{1,2})$/.exec(w);
    if (numeric) {
      const key = upcoming(Number(numeric[1]), Number(numeric[2]) - 1);
      if (key) {
        result.dueDate = key;
        take(i);
        continue;
      }
    }
    // "sep 30" / "30 sep"
    if (MONTH_INDEX.has(w) && next && /^\d{1,2}(st|nd|rd|th)?$/.test(next)) {
      const key = upcoming(parseInt(next, 10), MONTH_INDEX.get(w)!);
      if (key) {
        result.dueDate = key;
        take(i, i + 1);
        continue;
      }
    }
    if (/^\d{1,2}(st|nd|rd|th)?$/.test(w) && next && MONTH_INDEX.has(next)) {
      const key = upcoming(parseInt(w, 10), MONTH_INDEX.get(next)!);
      if (key) {
        result.dueDate = key;
        take(i, i + 1);
        continue;
      }
    }
  }

  result.title = words
    .filter((_, i) => !used[i])
    .join(' ')
    .replace(/\s+(on|at|by)$/i, '')
    .trim();
  return result;
}
