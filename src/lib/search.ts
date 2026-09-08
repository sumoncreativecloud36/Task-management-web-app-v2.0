import { live, pathForTask } from './selectors';
import type { AppData, EntityKind } from './types';

export interface SearchHit {
  kind: EntityKind;
  id: string;
  title: string;
  path: string;
  /** Ids needed to jump the four columns straight to this hit. */
  mainId: string;
  subId: string | null;
  categoryId: string | null;
  score: number;
}

/** Prefix and word-start matches rank above plain substring matches. */
function score(haystack: string, needle: string): number {
  const value = haystack.toLowerCase();
  const index = value.indexOf(needle);
  if (index < 0) return -1;
  if (index === 0) return 100 - value.length * 0.01;
  if (/\s|\/|-/.test(value[index - 1] ?? '')) return 70 - value.length * 0.01;
  return 40 - value.length * 0.01;
}

export function searchAll(data: AppData, query: string, limit = 24): SearchHit[] {
  const needle = query.trim().toLowerCase();
  if (needle.length < 1) return [];
  const hits: SearchHit[] = [];

  for (const main of live(data.mainCategories)) {
    const value = score(main.name, needle);
    if (value >= 0) {
      hits.push({
        kind: 'main',
        id: main.id,
        title: main.name,
        path: 'Main category',
        mainId: main.id,
        subId: null,
        categoryId: null,
        score: value + 6,
      });
    }
  }

  for (const sub of live(data.subcategories)) {
    const value = score(sub.name, needle);
    if (value < 0) continue;
    const main = data.mainCategories.find((m) => m.id === sub.mainCategoryId);
    if (!main || main.deletedAt) continue;
    hits.push({
      kind: 'sub',
      id: sub.id,
      title: sub.name,
      path: main.name,
      mainId: main.id,
      subId: sub.id,
      categoryId: null,
      score: value + 4,
    });
  }

  for (const category of live(data.categories)) {
    const value = score(category.name, needle);
    if (value < 0) continue;
    const sub = data.subcategories.find((s) => s.id === category.subcategoryId);
    const main = sub && data.mainCategories.find((m) => m.id === sub.mainCategoryId);
    if (!sub || !main || sub.deletedAt || main.deletedAt) continue;
    hits.push({
      kind: 'category',
      id: category.id,
      title: category.name,
      path: `${main.name} → ${sub.name}`,
      mainId: main.id,
      subId: sub.id,
      categoryId: category.id,
      score: value + 2,
    });
  }

  for (const task of live(data.tasks)) {
    const value = Math.max(
      score(task.title, needle),
      task.description ? score(task.description, needle) - 15 : -1,
      task.tags.some((tag) => tag.toLowerCase().includes(needle)) ? 45 : -1,
    );
    if (value < 0) continue;
    const { main, sub, category } = pathForTask(data, task);
    if (!main || !sub || !category || main.deletedAt || sub.deletedAt || category.deletedAt) continue;
    hits.push({
      kind: 'task',
      id: task.id,
      title: task.title,
      path: `${main.name} → ${sub.name} → ${category.name}`,
      mainId: main.id,
      subId: sub.id,
      categoryId: category.id,
      score: value,
    });
  }

  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}

export const KIND_LABEL: Record<EntityKind, string> = {
  main: 'Main categories',
  sub: 'Subcategories',
  category: 'Categories',
  task: 'Tasks',
};
