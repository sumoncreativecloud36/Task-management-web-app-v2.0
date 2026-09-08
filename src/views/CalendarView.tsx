import { useMemo, useState } from 'react';
import { Empty } from '../components/Empty';
import { Icon } from '../components/Icon';
import { Tick } from '../components/Tick';
import { TaskForm, emptyDraft, type TaskDraft } from '../components/TaskForm';
import { useActions } from '../lib/actions';
import {
  DAY_LABELS,
  formatLongDate,
  formatMonthYear,
  fromKey,
  monthGrid,
  toKey,
  today,
  weekdayIndex,
} from '../lib/date';
import {
  completionMap,
  isDone,
  pathForTask,
  pathLabel,
  statsForDate,
  tasksForDate,
  visibleCategories,
  visibleMains,
  visibleSubs,
} from '../lib/selectors';
import { useData } from '../lib/store';
import { useUi } from '../lib/ui';

/** Month grid plus a day panel for adding, editing and completing tasks. */
export function CalendarView() {
  const { data } = useData();
  const { dispatch, toggle, remove } = useActions();
  const { revealCategory, selection } = useUi();

  const [cursor, setCursor] = useState(() => today());
  const [selectedKey, setSelectedKey] = useState(() => toKey(today()));
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<TaskDraft>(() => emptyDraft());

  const map = useMemo(() => completionMap(data), [data]);
  const cells = useMemo(() => monthGrid(cursor), [cursor]);
  const todayKeyValue = toKey(today());
  const selectedDate = useMemo(() => fromKey(selectedKey), [selectedKey]);
  const dayTasks = useMemo(() => tasksForDate(data, selectedDate), [data, selectedDate]);
  const dayStats = useMemo(
    () => statsForDate(data, map, selectedDate),
    [data, map, selectedDate],
  );

  /** Which tasks fall on each visible date, so cells can be filled in one pass. */
  const byDate = useMemo(() => {
    const result = new Map<string, ReturnType<typeof tasksForDate>>();
    for (const cell of cells) result.set(toKey(cell), tasksForDate(data, cell));
    return result;
  }, [cells, data]);

  // New tasks need a home; fall back to the first category in the tree.
  const fallbackCategoryId = useMemo(() => {
    if (selection.categoryId) return selection.categoryId;
    const main = visibleMains(data)[0];
    const sub = main ? visibleSubs(data, main.id)[0] : undefined;
    return sub ? (visibleCategories(data, sub.id)[0]?.id ?? null) : null;
  }, [data, selection.categoryId]);

  const createTask = () => {
    if (!fallbackCategoryId || !draft.title.trim()) return;
    dispatch({
      type: 'addTask',
      input: {
        categoryId: fallbackCategoryId,
        title: draft.title,
        description: draft.description,
        priority: draft.priority,
        dueDate: draft.dueDate ?? selectedKey,
        estimatedMinutes: draft.estimatedMinutes,
        repeat: draft.repeat,
        repeatDays: draft.repeatDays.length ? draft.repeatDays : [weekdayIndex(selectedDate)],
        tags: draft.tags,
      },
    });
    setDraft(emptyDraft());
    setAdding(false);
  };

  const monthName = formatMonthYear(cursor);

  return (
    <div className="view view--pad scroll">
      <div className="view-head">
        <div>
          <h1 className="view-title">Calendar</h1>
          <p className="view-sub">{monthName}</p>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
            aria-label="Previous month"
          >
            <Icon name="left" size={13} />
          </button>
          <button
            type="button"
            className="btn btn--quiet btn--sm"
            onClick={() => {
              setCursor(today());
              setSelectedKey(todayKeyValue);
            }}
          >
            Today
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
            aria-label="Next month"
          >
            <Icon name="right" size={13} />
          </button>
        </div>
      </div>

      <div className="calendar">
        <div className="cal-grid" role="grid" aria-label={`${monthName} calendar`}>
          {DAY_LABELS.map((label) => (
            <div className="cal-grid__head" key={label} role="columnheader">
              {label}
            </div>
          ))}

          {cells.map((cell) => {
            const key = toKey(cell);
            const tasks = byDate.get(key) ?? [];
            const doneCount = tasks.filter((task) => isDone(map, task.id, key)).length;
            const outside = cell.getMonth() !== cursor.getMonth();
            const classes = [
              'cal-cell',
              outside ? 'cal-cell--out' : '',
              key === todayKeyValue ? 'cal-cell--today' : '',
            ]
              .filter(Boolean)
              .join(' ');

            return (
              <button
                type="button"
                key={key}
                className={classes}
                aria-pressed={key === selectedKey}
                aria-label={`${formatLongDate(cell)}, ${tasks.length} tasks, ${doneCount} complete`}
                onClick={() => {
                  setSelectedKey(key);
                  setAdding(false);
                }}
              >
                <span className="cal-cell__date">
                  <span>{cell.getDate()}</span>
                  {tasks.length > 0 && (
                    <span style={{ fontSize: 10, color: 'var(--text-faint)' }}>
                      {doneCount}/{tasks.length}
                    </span>
                  )}
                </span>
                {tasks.slice(0, 3).map((task) => (
                  <span
                    key={task.id}
                    className={
                      isDone(map, task.id, key) ? 'cal-pill cal-pill--done' : 'cal-pill'
                    }
                  >
                    {task.title}
                  </span>
                ))}
                {tasks.length > 3 && <span className="cal-more">+{tasks.length - 3} more</span>}
              </button>
            );
          })}
        </div>

        <aside className="card" aria-label="Selected day">
          <div className="card__head">
            <div>
              <h2 className="card__title">{formatLongDate(selectedDate)}</h2>
              <p className="card__hint">
                {dayStats.completed}/{dayStats.total} complete · {dayStats.percent}%
              </p>
            </div>
            <button
              type="button"
              className="btn btn--primary btn--sm"
              onClick={() => setAdding((value) => !value)}
              disabled={!fallbackCategoryId}
              title={
                fallbackCategoryId
                  ? 'Add a task on this date'
                  : 'Create a category first'
              }
            >
              <Icon name="plus" size={13} /> Add
            </button>
          </div>

          {adding && fallbackCategoryId && (
            <div style={{ marginBottom: 10 }}>
              <TaskForm
                draft={draft}
                onChange={setDraft}
                onSubmit={createTask}
                onCancel={() => setAdding(false)}
                submitLabel="Create Task"
              />
            </div>
          )}

          {dayTasks.length === 0 ? (
            <Empty icon="calendar" text="Nothing scheduled on this date." />
          ) : (
            <ul style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {dayTasks.map((task) => {
                const done = isDone(map, task.id, selectedKey);
                const path = pathForTask(data, task);
                return (
                  <li key={task.id}>
                    <div className={done ? 'task-row task-row--done' : 'task-row'}>
                      <Tick
                        done={done}
                        label={`Mark ${task.title} ${done ? 'incomplete' : 'complete'}`}
                        onToggle={() => toggle(task.id, selectedKey)}
                      />
                      <span className="task-row__main" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 0 }}>
                        <span className="task-row__title" style={{ cursor: 'default' }}>
                          {task.title}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>
                          {pathLabel(path)}
                        </span>
                      </span>
                      <span className="task-row__actions" style={{ opacity: 1 }}>
                        <button
                          type="button"
                          className="icon-btn icon-btn--sm"
                          aria-label={`Open ${task.title} in workspace`}
                          onClick={() => {
                            if (path.main && path.sub && path.category) {
                              revealCategory(path.main.id, path.sub.id, path.category.id);
                            }
                          }}
                        >
                          <Icon name="right" size={14} />
                        </button>
                        <button
                          type="button"
                          className="icon-btn icon-btn--sm"
                          aria-label={`Delete ${task.title}`}
                          onClick={() => remove('task', task.id, task.title)}
                        >
                          <Icon name="trash" size={14} />
                        </button>
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>
      </div>
    </div>
  );
}
