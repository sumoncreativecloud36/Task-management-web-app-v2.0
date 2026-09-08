import { useMemo, useState } from 'react';
import { Empty } from '../components/Empty';
import { Icon } from '../components/Icon';
import { Tick } from '../components/Tick';
import { useActions } from '../lib/actions';
import { addDays, formatLongDate, formatShortDate, sameDay, toKey, today } from '../lib/date';
import {
  PRIORITY_ORDER,
  completionMap,
  isDone,
  pathForTask,
  pathLabel,
  statsForDate,
  tasksForDate,
} from '../lib/selectors';
import { useData } from '../lib/store';
import { useUi } from '../lib/ui';

/** A focused list of everything scheduled for one day, defaulting to today. */
export function TodayView() {
  const { data } = useData();
  const { toggle } = useActions();
  const { revealCategory } = useUi();
  const [offset, setOffset] = useState(0);

  const date = useMemo(() => addDays(today(), offset), [offset]);
  const dateKey = toKey(date);
  const map = useMemo(() => completionMap(data), [data]);
  const stats = useMemo(() => statsForDate(data, map, date), [data, map, date]);

  const tasks = useMemo(
    () =>
      tasksForDate(data, date).sort((a, b) => {
        const doneA = isDone(map, a.id, dateKey) ? 1 : 0;
        const doneB = isDone(map, b.id, dateKey) ? 1 : 0;
        if (doneA !== doneB) return doneA - doneB;
        const priority = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
        if (priority) return priority;
        return a.position - b.position;
      }),
    [data, date, dateKey, map],
  );

  const isToday = sameDay(date, today());

  return (
    <div className="view view--pad scroll">
      <div className="view-head">
        <div>
          <h1 className="view-title">{isToday ? 'Today' : formatShortDate(date)}</h1>
          <p className="view-sub">{formatLongDate(date)}</p>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => setOffset((value) => value - 1)}
          >
            <Icon name="left" size={13} /> Previous day
          </button>
          {!isToday && (
            <button type="button" className="btn btn--quiet btn--sm" onClick={() => setOffset(0)}>
              Today
            </button>
          )}
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => setOffset((value) => value + 1)}
          >
            Next day <Icon name="right" size={13} />
          </button>
        </div>
      </div>

      <div className="stat-grid">
        <div className="card">
          <div className="card__label">Tasks</div>
          <div className="card__value">{stats.total}</div>
          <div className="card__hint">scheduled for this day</div>
        </div>
        <div className="card">
          <div className="card__label">Completed</div>
          <div className="card__value" style={{ color: 'var(--accent)' }}>
            {stats.completed}
          </div>
          <div className="card__hint">ticked off</div>
        </div>
        <div className="card">
          <div className="card__label">Remaining</div>
          <div className="card__value">{stats.remaining}</div>
          <div className="card__hint">still open</div>
        </div>
        <div className="card">
          <div className="card__label">Complete</div>
          <div className="card__value">{stats.percent}%</div>
          <div className="bar" style={{ marginTop: 8 }}>
            <div className="bar__fill" style={{ width: `${stats.percent}%` }} />
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 8 }}>
        {tasks.length === 0 ? (
          <Empty
            icon="today"
            text={`Nothing is scheduled for ${isToday ? 'today' : formatShortDate(date)}.`}
            pad
          />
        ) : (
          <ul style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {tasks.map((task) => {
              const done = isDone(map, task.id, dateKey);
              const path = pathForTask(data, task);
              return (
                <li key={task.id}>
                  <div className={done ? 'task-row task-row--done' : 'task-row'}>
                    <span className={`prio prio--${task.priority}`} />
                    <Tick
                      done={done}
                      today={isToday}
                      label={`Mark ${task.title} ${done ? 'incomplete' : 'complete'}`}
                      onToggle={() => toggle(task.id, dateKey)}
                    />
                    <span className="task-row__main">
                      <span
                        className="task-row__title"
                        style={{ textDecoration: done ? 'line-through' : undefined }}
                      >
                        {task.title}
                      </span>
                      <span className="task-row__meta">
                        {task.estimatedMinutes ? (
                          <span className="chip">
                            <Icon name="clock" size={10} />
                            {task.estimatedMinutes}m
                          </span>
                        ) : null}
                        {task.tags.map((tag) => (
                          <span className="chip chip--accent" key={tag}>
                            #{tag}
                          </span>
                        ))}
                      </span>
                    </span>
                    <button
                      type="button"
                      className="chip"
                      style={{ marginLeft: 'auto', cursor: 'pointer' }}
                      onClick={() => {
                        if (path.main && path.sub && path.category) {
                          revealCategory(path.main.id, path.sub.id, path.category.id);
                        }
                      }}
                      title="Open in the four-column workspace"
                    >
                      {pathLabel(path)}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
