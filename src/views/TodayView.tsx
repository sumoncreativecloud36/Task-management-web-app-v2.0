import { useMemo, useState } from 'react';
import { Empty } from '../components/Empty';
import { Icon } from '../components/Icon';
import { Menu } from '../components/Menu';
import { dueLabel, listForHash, readLastList } from '../components/QuickAdd';
import { TaskDetails } from '../components/TaskDetails';
import { Tick } from '../components/Tick';
import { useActions } from '../lib/actions';
import { addDays, formatLongDate, sameDay, toKey, today, weekdayIndex } from '../lib/date';
import { parseQuickAdd } from '../lib/quickAdd';
import { htmlToText } from '../lib/richText';
import {
  PRIORITY_ORDER,
  completionMap,
  currentStreak,
  isDone,
  overdueTasks,
  pathForTask,
  tasksForDate,
} from '../lib/selectors';
import { useData } from '../lib/store';
import { useUi } from '../lib/ui';
import type { Task } from '../lib/types';

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function encouragement(done: number, total: number): string {
  if (!total) return 'Nothing planned yet — add something below.';
  if (done === total) return 'All done. Great work!';
  const ratio = done / total;
  if (ratio === 0) return "Let's get the first one done.";
  if (ratio < 0.5) return 'Good start — keep going.';
  return 'Almost there.';
}

const byPriority = (a: Task, b: Task) =>
  PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || a.position - b.position;

/** One-off tasks can be rescheduled; repeating ones follow their days. */
const isOneOff = (task: Task) => task.repeat === 'none' && task.repeatDays.length === 0;

function ProgressRing({ percent }: { percent: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <svg className="ring" width="64" height="64" viewBox="0 0 64 64" aria-hidden="true">
      <circle className="ring__track" cx="32" cy="32" r={r} />
      <circle
        className="ring__fill"
        cx="32"
        cy="32"
        r={r}
        strokeDasharray={c}
        strokeDashoffset={c * (1 - percent / 100)}
      />
      <text x="32" y="36.5" textAnchor="middle" className="ring__text">
        {percent}%
      </text>
    </svg>
  );
}

/** A calm daily list: overdue first, then what's left, then what's done. */
export function TodayView() {
  const { data, dispatch } = useData();
  const { toggle, remove, notify } = useActions();
  const { revealCategory, openQuickAdd } = useUi();
  const [offset, setOffset] = useState(0);
  const [showDone, setShowDone] = useState(false);
  const [text, setText] = useState('');
  const [openTask, setOpenTask] = useState<{ id: string; dateKey: string } | null>(null);

  const date = useMemo(() => addDays(today(), offset), [offset]);
  const dateKey = toKey(date);
  const isToday = sameDay(date, today());
  const map = useMemo(() => completionMap(data), [data]);

  const scheduled = useMemo(() => tasksForDate(data, date), [data, date]);
  const open = scheduled.filter((t) => !isDone(map, t.id, dateKey)).sort(byPriority);
  const done = scheduled.filter((t) => isDone(map, t.id, dateKey)).sort(byPriority);
  const overdue = useMemo(
    // Only one-off tasks can fall behind; repeating ones simply come round again.
    () => (isToday ? overdueTasks(data, map).filter(isOneOff).sort(byPriority) : []),
    [data, map, isToday],
  );
  const streak = useMemo(() => currentStreak(data, map), [data, map]);

  const total = scheduled.length;
  const percent = total ? Math.round((done.length / total) * 100) : 0;

  const reschedule = (task: Task, key: string) => {
    const from = task.dueDate;
    dispatch({ type: 'update', kind: 'task', id: task.id, patch: { dueDate: key } });
    notify(`Moved “${task.title}” to ${dueLabel(key)}`, {
      label: 'Undo',
      run: () => dispatch({ type: 'update', kind: 'task', id: task.id, patch: { dueDate: from } }),
    });
  };

  const addFromText = () => {
    const parsed = parseQuickAdd(text);
    const title = parsed.title || text.trim();
    if (!title) return;
    const hashList = parsed.hashes.map((h) => ({ h, id: listForHash(data, h) })).find((x) => x.id);
    let repeatDays = parsed.repeatDays;
    if (parsed.repeat === 'weekly' && !repeatDays?.length) repeatDays = [weekdayIndex(date)];
    dispatch({
      type: 'addQuickTask',
      input: {
        categoryId: hashList?.id ?? readLastList(),
        title,
        priority: parsed.priority ?? 'medium',
        dueDate: parsed.dueDate ?? (parsed.repeat ? null : dateKey),
        estimatedMinutes: parsed.estimatedMinutes ?? null,
        repeat: parsed.repeat ?? 'none',
        repeatDays,
        tags: parsed.hashes.filter((h) => h !== hashList?.h),
      },
    });
    if (parsed.dueDate && parsed.dueDate !== dateKey) notify(`Added to ${dueLabel(parsed.dueDate)}`);
    setText('');
  };

  const row = (task: Task, opts: { done: boolean; overdue?: boolean }) => {
    const path = pathForTask(data, task);
    const tickKey = opts.overdue && task.dueDate ? task.dueDate : dateKey;
    const nextDay = toKey(addDays(date, 1));
    const canMove = isOneOff(task) && !opts.done;
    const high = task.priority === 'high' || task.priority === 'urgent';

    return (
      <li key={task.id} className={`day-task${opts.done ? ' day-task--done' : ''}`}>
        <Tick
          done={opts.done}
          today={isToday}
          label={`Mark ${task.title} ${opts.done ? 'not done' : 'done'}`}
          onToggle={() => toggle(task.id, tickKey)}
        />
        <button
          type="button"
          className="day-task__body"
          onClick={() => setOpenTask({ id: task.id, dateKey: tickKey })}
          title="Open task"
        >
          <span className="day-task__title">{task.title}</span>
          <span className="day-task__meta">
            {opts.overdue && task.dueDate && (
              <span className="day-task__late">{dueLabel(task.dueDate)}</span>
            )}
            {path.category && (
              <span className="day-task__list">
                <span className="day-task__dot" style={{ background: path.main?.color }} />
                {path.category.name}
              </span>
            )}
            {!isOneOff(task) && <Icon name="repeat" size={11} />}
            {htmlToText(task.description).trim() && (
              <span className="day-task__info" title="Has notes">
                <Icon name="notes" size={11} />
              </span>
            )}
            {task.estimatedMinutes ? (
              <span className="day-task__info">
                <Icon name="clock" size={11} />
                {task.estimatedMinutes}m
              </span>
            ) : null}
            {task.tags.map((tag) => (
              <span className="day-task__info" key={tag}>
                #{tag}
              </span>
            ))}
          </span>
        </button>
        {high && (
          <span className={`day-task__flag day-task__flag--${task.priority}`} title={`${task.priority} priority`}>
            <Icon name="flag" size={13} />
          </span>
        )}
        {canMove && (
          <button
            type="button"
            className="day-task__move"
            onClick={() => reschedule(task, opts.overdue ? toKey(today()) : nextDay)}
            title={opts.overdue ? 'Move to today' : 'Move to tomorrow'}
          >
            {opts.overdue ? 'Today' : 'Tomorrow'}
            <Icon name="right" size={12} />
          </button>
        )}
        <Menu
          label={`Actions for ${task.title}`}
          items={[
            { label: 'Open', icon: 'edit', onSelect: () => setOpenTask({ id: task.id, dateKey: tickKey }) },
            ...(canMove
              ? [
                  { label: 'Move to today', icon: 'today' as const, onSelect: () => reschedule(task, toKey(today())) },
                  { label: 'Move to tomorrow', icon: 'right' as const, onSelect: () => reschedule(task, nextDay) },
                  {
                    label: 'Move to next week',
                    icon: 'week' as const,
                    onSelect: () => reschedule(task, toKey(addDays(date, 7))),
                  },
                ]
              : []),
            {
              label: 'Open in list',
              icon: 'folder',
              onSelect: () => {
                if (path.main && path.sub && path.category) {
                  revealCategory(path.main.id, path.sub.id, path.category.id);
                }
              },
            },
            { label: 'Delete', icon: 'trash', danger: true, onSelect: () => remove('task', task.id, task.title) },
          ]}
        />
      </li>
    );
  };

  return (
    <div className="view scroll">
      <div className="today">
        <header className="today__head">
          <div>
            <p className="today__eyebrow">{isToday ? greeting() : formatLongDate(date)}</p>
            <h1 className="today__title">{isToday ? 'Today' : dueLabel(dateKey)}</h1>
            {isToday && <p className="view-sub">{formatLongDate(date)}</p>}
          </div>
          <div className="today__nav">
            <button type="button" className="icon-btn" onClick={() => setOffset((v) => v - 1)} aria-label="Previous day">
              <Icon name="left" size={16} />
            </button>
            <button
              type="button"
              className="today__pill"
              onClick={() => setOffset(0)}
              disabled={isToday}
            >
              Today
            </button>
            <button type="button" className="icon-btn" onClick={() => setOffset((v) => v + 1)} aria-label="Next day">
              <Icon name="right" size={16} />
            </button>
          </div>
        </header>

        <section className="today-hero">
          <ProgressRing percent={percent} />
          <div className="today-hero__text">
            <strong>
              {done.length} of {total} done
            </strong>
            <span>{encouragement(done.length, total)}</span>
          </div>
          {streak > 0 && (
            <span className="today-hero__streak" title="Days in a row with everything done">
              <Icon name="flame" size={14} />
              {streak}
            </span>
          )}
        </section>

        <form
          className="today-add"
          onSubmit={(event) => {
            event.preventDefault();
            addFromText();
          }}
        >
          <Icon name="plus" size={16} />
          <input
            className="today-add__input"
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={`Add a task for ${isToday ? 'today' : dueLabel(dateKey)}…`}
            aria-label="Add a task"
            enterKeyHint="done"
          />
          {text.trim() ? (
            <button type="submit" className="btn btn--primary btn--sm">
              Add
            </button>
          ) : (
            <button
              type="button"
              className="btn btn--quiet btn--sm"
              onClick={() => openQuickAdd({ date: dateKey })}
              title="More options"
            >
              Options
            </button>
          )}
        </form>

        {overdue.length > 0 && (
          <section className="today-sec today-sec--late">
            <div className="today-sec__head">
              <h2>Overdue</h2>
              <span className="today-sec__count">{overdue.length}</span>
              {overdue.some(isOneOff) && (
                <button
                  type="button"
                  className="today-sec__action"
                  onClick={() => {
                    const moved = overdue.filter(isOneOff);
                    const before = moved.map((t) => [t.id, t.dueDate] as const);
                    for (const t of moved) {
                      dispatch({ type: 'update', kind: 'task', id: t.id, patch: { dueDate: dateKey } });
                    }
                    notify(`Moved ${moved.length} task${moved.length === 1 ? '' : 's'} to today`, {
                      label: 'Undo',
                      run: () =>
                        before.forEach(([id, dueDate]) =>
                          dispatch({ type: 'update', kind: 'task', id, patch: { dueDate } }),
                        ),
                    });
                  }}
                >
                  Move all to today
                </button>
              )}
            </div>
            <ul className="day-list">{overdue.map((t) => row(t, { done: false, overdue: true }))}</ul>
          </section>
        )}

        <section className="today-sec">
          <div className="today-sec__head">
            <h2>To do</h2>
            <span className="today-sec__count">{open.length}</span>
          </div>
          {open.length ? (
            <ul className="day-list">{open.map((t) => row(t, { done: false }))}</ul>
          ) : (
            <Empty
              icon={total ? 'check' : 'today'}
              text={
                total
                  ? 'Everything for this day is done. Enjoy the rest of it!'
                  : `Nothing planned for ${isToday ? 'today' : dueLabel(dateKey)}.`
              }
              actionLabel="Add a task"
              onAction={() => openQuickAdd({ date: dateKey })}
              pad
            />
          )}
        </section>

        {done.length > 0 && (
          <section className="today-sec">
            <button
              type="button"
              className="today-sec__head today-sec__toggle"
              onClick={() => setShowDone((v) => !v)}
              aria-expanded={showDone}
            >
              <h2>Completed</h2>
              <span className="today-sec__count">{done.length}</span>
              <Icon name={showDone ? 'down' : 'right'} size={14} />
            </button>
            {showDone && <ul className="day-list">{done.map((t) => row(t, { done: true }))}</ul>}
          </section>
        )}
      </div>

      {openTask && (
        <TaskDetails taskId={openTask.id} dateKey={openTask.dateKey} onClose={() => setOpenTask(null)} />
      )}
    </div>
  );
}
