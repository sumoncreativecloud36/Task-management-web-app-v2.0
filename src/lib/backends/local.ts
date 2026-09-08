import { migrate } from '../reducer';
import type { AppData } from '../types';

const KEY = 'taskmanager.data.v1';

export function loadLocal(): AppData | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return migrate(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveLocal(data: AppData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // Quota exceeded or storage blocked — the session still works in memory.
  }
}

export function clearLocal(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
