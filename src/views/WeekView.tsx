import { Fragment, useMemo, useState } from 'react';
import { Empty } from '../components/Empty';
import { Icon } from '../components/Icon';
import { Tick } from '../components/Tick';
import { useActions } from '../lib/actions';
import {
  DAY_LABELS,
  DAY_LABELS_FULL,
  formatWeekRange,
  startOfWeek,
  toKey,
  today,
  weekDates as weekDatesOf,
} from '../lib/date';
import {
  allActiveTasks,
  completionMap,
  isDone,
  pathForTask,
  scheduledDaysInWeek,
  statsForWeek,
  visibleMains,
} from '../lib/selectors';
import { useData } from '../lib/store';
import { useUi } from '../lib/ui';
import type { WeekdayIndex } from '../lib/types';

/** The spreadsheet: every task as a row, Saturday→Friday as columns. */
export function WeekView() {
  const { data } = useData();
  const { toggle } = useActions();
  const { weekCursor, goPrevWeek, goNextWeek, goThisWeek, revealCategory } = useUi();
  const [mainFilter, setMainFilter] = useState<string>('all');

  const map = useMemo(() => completionMap(data), [data]);
  const dates = useMemo(() => weekDatesOf(weekCursor), [weekCursor]);
  const keys = useMemo(() => dates.map(toKey), [dates]);
  const todayKeyValue = toKey(today());
  const isThisWeek = toKey(startOfWeek(today())) === toKey(weekCursor);
  const mains = useMemo(() => visibleMains(data), [data]);
  const stats = useMemo(() => statsForWeek(data, map, weekCursor), [data, map, weekCursor]);

  /** Rows are grouped by their Main / Sub / Category path so context is never lost. */
  const groups = useMemo(() => {
    const tasks = allActiveTasks(data)
      .map((task) => ({ task, path: pathForTask(data, task) }))
      .filter(({ path }) => mainFilter === 'all' || path.main?.id === mainFilter)
      .filter(({ task }) => scheduledDaysInWeek(task, weekCursor).length > 0);

    const buckets = new Map<string, { label: string; ids: string[]; rows: typeof tasks }>();
    for (const entry of tasks) {
      const key = entry.path.category?.id ?? 'none';
      const label = [entry.path.main?.name, entry.path.sub?.name, entry.path.category?.name]
        .filter(Boolean)
        .join('  /  ');
      const bucket = buckets.get(key) ?? {
        label,
        ids: [
          entry.path.main?.id ?? '',
          entry.path.sub?.id ?? '',
          entry.path.category?.id ?? '',
        ],
        rows: [],
      };
      bucket.rows.push(entry);
      buckets.set(key, bucket);
    }
    return [...buckets.values()];
  }, [data, mainFilter, weekCursor]);

  const rowCount = groups.reduce((sum, group) => sum + group.rows.length, 0);

  return (
    <div className="view view--pad scroll">
      <div className="view-head">
        <div>
          <h1 className="view-title">Week</h1>
          <p className="view-sub">
            {formatWeekRange(weekCursor)} · {stats.completed}/{stats.total} scheduled days complete (
            {stats.percent}%)
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            className="select"
            style={{ width: 176, height: 26, fontSize: 12.5 }}
            value={mainFilter}
            onChange={(event) => setMainFilter(event.target.value)}
            aria-label="Filter by main category"
          >
            <option value="all">All main categories</option>
            {mains.map((main) => (
              <option key={main.id} value={main.id}>
                {main.name}
              </option>
            ))}
          </select>
          <button type="button" className="btn btn--ghost btn--sm" onClick={goPrevWeek}>
            <Icon name="left" size={13} /> Prev
          </button>
          {!isThisWeek && (
            <button type="button" className="btn btn--quiet btn--sm" onClick={goThisWeek}>
              This week
            </button>
          )}
          <button type="button" className="btn btn--ghost btn--sm" onClick={goNextWeek}>
            Next <Icon name="right" size={13} />
          </button>
        </div>
      </div>

      <div className="bar">
        <div className="bar__fill" style={{ width: `${stats.percent}%` }} />
      </div>

      {rowCount === 0 ? (
        <div className="card">
          <Empty
            icon="week"
            text="No tasks have scheduled days in this week. Add days to a task to see it here."
            pad
          />
        </div>
      ) : (
        <div className="sheet-wrap">
          <div className="sheet-scroll scroll">
            <table className="sheet">
              <caption className="sr-only">
                Weekly completion grid, Saturday to Friday, for {formatWeekRange(weekCursor)}
              </caption>
              <thead>
                <tr>
                  <th className="sheet__task" scope="col">
                    Task
                  </th>
                  {DAY_LABELS.map((label, index) => (
                    <th
                      key={label}
                      scope="col"
                      className={
                        keys[index] === todayKeyValue ? 'sheet__day sheet__day--today' : 'sheet__day'
                      }
                      title={`${DAY_LABELS_FULL[index]} ${dates[index].getDate()}`}
                    >
                      {label}
                      <div style={{ fontSize: 9, opacity: 0.65, fontWeight: 500 }}>
                        {dates[index].getDate()}
                      </div>
                    </th>
                  ))}
                  <th className="sheet__num" scope="col">
                    Done
                  </th>
                </tr>
              </thead>
              <tbody>
                {groups.map((group) => (
                  <Fragment key={group.label}>
                    <tr className="sheet__group">
                      <td colSpan={9}>
                        <button
                          type="button"
                          style={{ color: 'inherit', font: 'inherit', letterSpacing: 'inherit' }}
                          onClick={() =>
                            group.ids[0] && revealCategory(group.ids[0], group.ids[1], group.ids[2])
                          }
                          title="Open in the four-column workspace"
                        >
                          {group.label}
                        </button>
                      </td>
                    </tr>
                    {group.rows.map(({ task }) => {
                      const days = scheduledDaysInWeek(task, weekCursor);
                      const done = days.filter((day) => isDone(map, task.id, keys[day])).length;
                      return (
                        <tr key={task.id}>
                          <th scope="row" className="sheet__task">
                            <span className="sheet__title">
                              <span className={`prio prio--${task.priority}`} style={{ height: 14 }} />
                              <span>{task.title}</span>
                            </span>
                          </th>
                          {keys.map((key, index) => {
                            const scheduled = days.includes(index as WeekdayIndex);
                            const isTicked = isDone(map, task.id, key);
                            return (
                              <td
                                key={key}
                                className={
                                  key === todayKeyValue ? 'sheet__day sheet__day--today' : 'sheet__day'
                                }
                              >
                                <span className="sheet__cellwrap">
                                  <Tick
                                    done={isTicked}
                                    today={key === todayKeyValue}
                                    future={key > todayKeyValue}
                                    disabled={!scheduled && !isTicked}
                                    label={`${task.title} — ${DAY_LABELS_FULL[index]}`}
                                    onToggle={() => toggle(task.id, key)}
                                  />
                                </span>
                              </td>
                            );
                          })}
                          <td className="sheet__num">
                            {done}/{days.length}
                          </td>
                        </tr>
                      );
                    })}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
