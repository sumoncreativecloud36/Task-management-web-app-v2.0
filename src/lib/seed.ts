import { addDays, startOfWeek, toKey, today } from './date';
import { uid } from './id';
import { emptyData } from './reducer';
import type { AppData, Priority, RepeatMode, Task, WeekdayIndex } from './types';

interface SeedTask {
  title: string;
  days: WeekdayIndex[];
  priority?: Priority;
  repeat?: RepeatMode;
  estimate?: number;
  notes?: string;
  tags?: string[];
  dueInDays?: number;
}

interface SeedTree {
  name: string;
  icon: string;
  color: string;
  subs: { name: string; categories: { name: string; tasks: SeedTask[] }[] }[];
}

const TREE: SeedTree[] = [
  {
    name: 'Work',
    icon: '💼',
    color: '#2A835F',
    subs: [
      {
        name: 'Websites',
        categories: [
          {
            name: 'My Website',
            tasks: [
              { title: 'Build homepage', days: [0, 2, 4], priority: 'high', estimate: 120, tags: ['frontend'] },
              { title: 'Write case study', days: [1, 3], estimate: 60, notes: 'Two projects, 400 words each.' },
              { title: 'Fix mobile navigation', days: [2], priority: 'urgent', estimate: 45, dueInDays: 1 },
            ],
          },
          {
            name: 'Client Website',
            tasks: [
              { title: 'Review staging build', days: [0, 3], estimate: 30 },
              { title: 'Send weekly update', days: [6], repeat: 'weekly', priority: 'low', estimate: 15 },
            ],
          },
          { name: 'Landing Pages', tasks: [{ title: 'A/B test hero copy', days: [1, 4], estimate: 40 }] },
        ],
      },
      {
        name: 'Marketing',
        categories: [
          {
            name: 'SEO Project',
            tasks: [
              { title: 'Keyword research', days: [0, 2], estimate: 50, tags: ['seo'] },
              { title: 'Publish blog post', days: [4], priority: 'high', estimate: 90 },
            ],
          },
          { name: 'Newsletter', tasks: [{ title: 'Draft Friday issue', days: [5, 6], estimate: 45 }] },
        ],
      },
      {
        name: 'Clients',
        categories: [
          {
            name: 'Acme Co',
            tasks: [
              { title: 'Invoice for September', days: [1], priority: 'high', dueInDays: 3, estimate: 20 },
              { title: 'Prepare handoff docs', days: [2, 4], estimate: 60 },
            ],
          },
        ],
      },
    ],
  },
  {
    name: 'Design',
    icon: '🎨',
    color: '#8BBB92',
    subs: [
      {
        name: 'Branding',
        categories: [
          {
            name: 'Logo Refresh',
            tasks: [
              { title: 'Create logo variations', days: [1, 3], priority: 'high', estimate: 120 },
              { title: 'Export SVG assets', days: [3], estimate: 25 },
            ],
          },
        ],
      },
      {
        name: 'Product UI',
        categories: [
          {
            name: 'Mobile App',
            tasks: [
              { title: 'Polish onboarding screens', days: [0, 2, 4], estimate: 75 },
              { title: 'Audit dark mode contrast', days: [5], estimate: 40, tags: ['a11y'] },
            ],
          },
        ],
      },
    ],
  },
  {
    name: 'Learning',
    icon: '📚',
    color: '#2A835F',
    subs: [
      {
        name: 'Courses',
        categories: [
          {
            name: 'TypeScript Deep Dive',
            tasks: [
              { title: 'Watch one lesson', days: [0, 1, 2, 3, 4, 5, 6], repeat: 'daily', estimate: 30 },
              { title: 'Write practice exercises', days: [1, 4], estimate: 45 },
            ],
          },
        ],
      },
      {
        name: 'Reading',
        categories: [
          { name: 'Books', tasks: [{ title: 'Read 20 pages', days: [0, 1, 2, 3, 4, 5, 6], repeat: 'daily', estimate: 25 }] },
        ],
      },
    ],
  },
  {
    name: 'Personal',
    icon: '👤',
    color: '#8BBB92',
    subs: [
      {
        name: 'Health',
        categories: [
          {
            name: 'Fitness',
            tasks: [
              { title: 'Exercise', days: [0, 2, 4, 6], repeat: 'custom', priority: 'high', estimate: 45 },
              { title: 'Stretch for 10 minutes', days: [0, 1, 2, 3, 4, 5, 6], repeat: 'daily', estimate: 10 },
            ],
          },
        ],
      },
      {
        name: 'Home',
        categories: [
          {
            name: 'Chores',
            tasks: [
              { title: 'Grocery run', days: [0], estimate: 60 },
              { title: 'Tidy desk', days: [5], priority: 'low', estimate: 15 },
            ],
          },
        ],
      },
    ],
  },
  {
    name: 'Finance',
    icon: '💰',
    color: '#2A835F',
    subs: [
      {
        name: 'Budget',
        categories: [
          {
            name: 'Monthly Review',
            tasks: [
              { title: 'Categorise expenses', days: [6], repeat: 'weekly', estimate: 30 },
              { title: 'Move savings', days: [1], priority: 'high', estimate: 10 },
            ],
          },
        ],
      },
    ],
  },
];

/**
 * Sample content with two weeks of completion history, so the weekly grid,
 * analytics and streaks all have something real to show on first run.
 */
export function seedData(): AppData {
  const data = emptyData();
  const now = new Date().toISOString();
  const thisWeek = startOfWeek(today());
  const lastWeek = addDays(thisWeek, -7);
  const todayKeyStr = toKey(today());

  TREE.forEach((mainSeed, mainIndex) => {
    const mainId = uid();
    data.mainCategories.push({
      id: mainId,
      name: mainSeed.name,
      icon: mainSeed.icon,
      color: mainSeed.color,
      position: mainIndex,
      createdAt: now,
      deletedAt: null,
    });

    mainSeed.subs.forEach((subSeed, subIndex) => {
      const subId = uid();
      data.subcategories.push({
        id: subId,
        mainCategoryId: mainId,
        name: subSeed.name,
        position: subIndex,
        createdAt: now,
        deletedAt: null,
      });

      subSeed.categories.forEach((categorySeed, categoryIndex) => {
        const categoryId = uid();
        data.categories.push({
          id: categoryId,
          subcategoryId: subId,
          name: categorySeed.name,
          position: categoryIndex,
          createdAt: now,
          deletedAt: null,
        });

        categorySeed.tasks.forEach((taskSeed, taskIndex) => {
          const task: Task = {
            id: uid(),
            categoryId,
            title: taskSeed.title,
            description: taskSeed.notes ?? '',
            priority: taskSeed.priority ?? 'medium',
            dueDate: taskSeed.dueInDays ? toKey(addDays(today(), taskSeed.dueInDays)) : null,
            estimatedMinutes: taskSeed.estimate ?? null,
            actualMinutes: null,
            repeat: taskSeed.repeat ?? (taskSeed.days.length > 1 ? 'custom' : 'none'),
            repeatDays: [...taskSeed.days].sort((a, b) => a - b),
            tags: taskSeed.tags ?? [],
            position: taskIndex,
            createdAt: now,
            updatedAt: now,
            deletedAt: null,
          };
          data.tasks.push(task);

          // Deterministic-ish history: last week mostly done, this week partly.
          const fill = (weekStart: Date, rate: number) => {
            task.repeatDays.forEach((day, i) => {
              const date = addDays(weekStart, day);
              const key = toKey(date);
              if (key > todayKeyStr) return;
              const hit = (taskIndex + i + mainIndex + day) % 10 < rate * 10;
              if (!hit) return;
              data.completions.push({
                id: uid(),
                taskId: task.id,
                completionDate: key,
                completed: true,
                completedAt: new Date(date.getTime() + 10 * 3600_000).toISOString(),
              });
            });
          };
          fill(lastWeek, 0.8);
          fill(thisWeek, 0.6);
        });
      });
    });
  });

  return data;
}
