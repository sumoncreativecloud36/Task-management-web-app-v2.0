import { useMemo } from 'react';
import { Empty } from '../components/Empty';
import { Icon } from '../components/Icon';
import { useActions } from '../lib/actions';
import {
  DAY_LABELS,
  addDays,
  formatLongDate,
  formatRelative,
  formatShortDate,
  formatWeekRange,
  fromKey,
  startOfWeek,
  toKey,
  today,
} from '../lib/date';
import {
  completionMap,
  completionsByDay,
  currentStreak,
  isDone,
  overdueTasks,
  pathForTask,
  recentActivity,
  statsForDate,
  statsForWeek,
  tasksForDate,
} from '../lib/selectors';
import { useData } from '../lib/store';
import { useUi } from '../lib/ui';

export function DashboardView() {
  const { data } = useData();
  const { toggle } = useActions();
  const { setView, revealCategory } = useUi();

  const map = useMemo(() => completionMap(data), [data]);
  const now = today();
  const weekStart = useMemo(() => startOfWeek(now), [now]);
  const todayStats = useMemo(() => statsForDate(data, map, now), [data, map, now]);
  const weekStats = useMemo(() => statsForWeek(data, map, weekStart), [data, map, weekStart]);
  const streak = useMemo(() => currentStreak(data, map), [data, map]);
  const overdue = useMemo(() => overdueTasks(data, map), [data, map]);
  const activity = useMemo(() => recentActivity(data), [data]);
  const perDay = useMemo(() => completionsByDay(data, weekStart), [data, weekStart]);
  const peak = Math.max(1, ...perDay);
  const todayKeyValue = toKey(now);

  const todayTasks = useMemo(
    () =>
      tasksForDate(data, now)
        .slice()
        .sort((a, b) => {
          const doneA = isDone(map, a.id, todayKeyValue) ? 1 : 0;
          const doneB = isDone(map, b.id, todayKeyValue) ? 1 : 0;
          return doneA - doneB || a.position - b.position;
        })
        .slice(0, 6),
    [data, map, now, todayKeyValue],
  );

  return (
    <div className="view view--pad scroll">
      <div className="view-head">
        <div>
          <h1 className="view-title">Dashboard</h1>
          <p className="view-sub">{formatLongDate(now)} · week of {formatWeekRange(weekStart)}</p>
        </div>
        <button type="button" className="btn btn--primary btn--sm" onClick={() => setView('tasks')}>
          <Icon name="tasks" size={13} /> Open workspace
        </button>
      </div>

      <div className="stat-grid">
        <div className="card">
          <div className="card__label">Today</div>
          <div className="card__value">
            {todayStats.completed} / {todayStats.total}
          </div>
          <div className="card__hint">completed</div>
          <div className="bar" style={{ marginTop: 8 }}>
            <div className="bar__fill" style={{ width: `${todayStats.percent}%` }} />
          </div>
        </div>

        <div className="card">
          <div className="card__label">Week</div>
          <div className="card__value">
            {weekStats.completed} / {weekStats.total}
          </div>
          <div className="card__hint">completed</div>
          <div className="bar" style={{ marginTop: 8 }}>
            <div className="bar__fill" style={{ width: `${weekStats.percent}%` }} />
          </div>
        </div>

        <div className="card">
          <div className="card__label">Current streak</div>
          <div className="card__value" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <Icon name="flame" size={18} />
            {streak}
          </div>
          <div className="card__hint">{streak === 1 ? 'day' : 'days'} fully complete</div>
        </div>

        <div className="card">
          <div className="card__label">Overdue</div>
          <div
            className="card__value"
            style={{ color: overdue.length ? 'var(--danger)' : 'var(--accent)' }}
          >
            {overdue.length}
          </div>
          <div className="card__hint">
            {overdue.length ? 'past their due date' : 'nothing is late'}
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card__head">
            <h2 className="card__title">Weekly progress</h2>
            <span className="chip chip--primary">{weekStats.percent}%</span>
          </div>
          <div className="chart">
            {perDay.map((count, index) => {
              const date = addDays(weekStart, index);
              const key = toKey(date);
              return (
                <div className="chart__col" key={key}>
                  <span className="chart__value">{count || ''}</span>
                  <span className="chart__track">
                    <span
                      className={key > todayKeyValue ? 'chart__bar chart__bar--muted' : 'chart__bar'}
                      style={{ height: `${Math.round((count / peak) * 100)}%` }}
                    />
                  </span>
                  <span
                    className={
                      key === todayKeyValue ? 'chart__label chart__label--today' : 'chart__label'
                    }
                  >
                    {DAY_LABELS[index]}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="card__hint" style={{ marginTop: 8 }}>
            Tasks ticked off each day this week.
          </p>
        </div>

        <div className="card" style={{ order: -1 }}>
          <div className="card__head">
            <h2 className="card__title">Today&apos;s tasks</h2>
            <button type="button" className="btn btn--quiet btn--sm" onClick={() => setView('today')}>
              View all <Icon name="right" size={12} />
            </button>
          </div>
          {todayTasks.length === 0 ? (
            <Empty icon="today" text="Nothing is scheduled for today." />
          ) : (
            <ul style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {todayTasks.map((task) => {
                const done = isDone(map, task.id, todayKeyValue);
                return (
                  <li key={task.id}>
                    <div className="row" style={{ cursor: 'default' }}>
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={done}
                        aria-label={`Mark ${task.title} ${done ? 'incomplete' : 'complete'}`}
                        className={done ? 'tick tick--done' : 'tick'}
                        onClick={() => toggle(task.id, todayKeyValue)}
                      >
                        {done && <Icon name="check" size={11} strokeWidth={3} />}
                      </button>
                      <span
                        className="row__name"
                        style={{
                          textDecoration: done ? 'line-through' : undefined,
                          opacity: done ? 0.6 : 1,
                        }}
                      >
                        {task.title}
                      </span>
                      <span className="row__count">{task.estimatedMinutes ? `${task.estimatedMinutes}m` : ''}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card__head">
            <h2 className="card__title">Overdue tasks</h2>
            {overdue.length > 0 && <span className="chip chip--danger">{overdue.length}</span>}
          </div>
          {overdue.length === 0 ? (
            <Empty icon="check" text="Nothing is past its due date." />
          ) : (
            <ul style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {overdue.slice(0, 6).map((task) => {
                const path = pathForTask(data, task);
                return (
                  <li key={task.id}>
                    <button
                      type="button"
                      className="row"
                      onClick={() => {
                        if (path.main && path.sub && path.category) {
                          revealCategory(path.main.id, path.sub.id, path.category.id);
                        }
                      }}
                    >
                      <Icon name="alert" size={13} />
                      <span className="row__name">{task.title}</span>
                      <span className="chip chip--danger">
                        {task.dueDate ? formatShortDate(fromKey(task.dueDate)) : ''}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="card" style={{ order: -1 }}>
          <div className="card__head">
            <h2 className="card__title">Recent activity</h2>
          </div>
          {activity.length === 0 ? (
            <Empty icon="clock" text="Completed tasks will show up here." />
          ) : (
            <ul style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {activity.map((item) => (
                <li key={`${item.taskId}-${item.dateKey}`}>
                  <div className="row" style={{ cursor: 'default' }}>
                    <Icon name="check" size={13} />
                    <span className="row__name">{item.title}</span>
                    <span className="row__count" style={{ minWidth: 60 }}>
                      {formatRelative(item.at)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
