import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useActions } from '../lib/actions';
import { DAY_LABELS } from '../lib/date';
import { INBOX_NAME, inboxCategoryId } from '../lib/reducer';
import { completionMap, isDone } from '../lib/selectors';
import { useData } from '../lib/store';
import type { Priority, RepeatMode, Task, WeekdayIndex } from '../lib/types';
import { Icon } from './Icon';
import { dueLabel, listOptions } from './QuickAdd';
import { RichEditor } from './RichEditor';
import { Tick } from './Tick';

const PRIORITIES: { value: Priority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

const REPEATS: { value: RepeatMode; label: string }[] = [
  { value: 'none', label: 'Does not repeat' },
  { value: 'daily', label: 'Every day' },
  { value: 'weekly', label: 'Every week' },
  { value: 'custom', label: 'Custom days' },
];

interface TaskDetailsProps {
  taskId: string;
  /** The day whose checkbox the header tick controls. */
  dateKey: string;
  onClose: () => void;
}

/**
 * The task page: name first, then notes (a full document editor), then the
 * scheduling details. Every change saves on its own — there is no Save button.
 */
export function TaskDetails({ taskId, dateKey, onClose }: TaskDetailsProps) {
  const { data } = useData();
  const task = data.tasks.find((t) => t.id === taskId);

  useEffect(() => {
    if (!task) onClose();
  }, [task, onClose]);

  if (!task) return null;
  return <TaskDetailsPanel task={task} dateKey={dateKey} onClose={onClose} />;
}

function TaskDetailsPanel({ task, dateKey, onClose }: { task: Task; dateKey: string; onClose: () => void }) {
  const { data, dispatch } = useData();
  const { toggle, remove } = useActions();
  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.description);
  const [tagText, setTagText] = useState(task.tags.join(', '));
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const pending = useRef<Partial<Task>>({});
  const timer = useRef<number | null>(null);

  const map = useMemo(() => completionMap(data), [data]);
  const done = isDone(map, task.id, dateKey);
  const lists = useMemo(() => listOptions(data), [data]);
  const inbox = inboxCategoryId(data);

  const save = useCallback(
    (patch: Partial<Task>) => dispatch({ type: 'update', kind: 'task', id: task.id, patch }),
    [dispatch, task.id],
  );

  const flush = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
    const patch = pending.current;
    pending.current = {};
    if (patch.title !== undefined && !patch.title.trim()) delete patch.title;
    if (Object.keys(patch).length) save(patch);
  }, [save]);

  const queue = (patch: Partial<Task>) => {
    pending.current = { ...pending.current, ...patch };
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(flush, 500);
  };

  const close = useCallback(() => {
    flush();
    onClose();
  }, [flush, onClose]);

  useEffect(() => flush, [flush]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [close]);

  // The title grows with its text instead of scrolling.
  useLayoutEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [title]);

  const setRepeat = (repeat: RepeatMode) => {
    if (repeat === 'daily') save({ repeat, repeatDays: [0, 1, 2, 3, 4, 5, 6] });
    else if (repeat === 'none') save({ repeat, repeatDays: [] });
    else save({ repeat, repeatDays: task.repeatDays.length && task.repeatDays.length < 7 ? task.repeatDays : [] });
  };

  const toggleDay = (day: WeekdayIndex) => {
    const has = task.repeatDays.includes(day);
    const repeatDays = (has ? task.repeatDays.filter((d) => d !== day) : [...task.repeatDays, day]).sort(
      (a, b) => a - b,
    );
    const repeat: RepeatMode =
      repeatDays.length === 7 ? 'daily' : repeatDays.length > 1 ? 'custom' : repeatDays.length ? 'weekly' : 'none';
    save({ repeatDays, repeat });
  };

  const numberField = (value: number | null, onChange: (v: number | null) => void, label: string) => (
    <input
      type="number"
      min={0}
      step={5}
      inputMode="numeric"
      className="input"
      value={value ?? ''}
      placeholder="—"
      aria-label={label}
      onChange={(event) => onChange(event.target.value === '' ? null : Math.max(0, Number(event.target.value)))}
    />
  );

  const showDays = task.repeat === 'weekly' || task.repeat === 'custom';

  return createPortal(
    <div
      className="sheet-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div className="sheet" role="dialog" aria-modal="true" aria-label={`Task: ${task.title}`}>
        <header className="sheet__bar">
          <label className="sheet__list" title="List">
            <Icon name="folder" size={14} />
            <select
              value={task.categoryId}
              onChange={(event) => save({ categoryId: event.target.value })}
              aria-label="List"
            >
              {inbox && <option value={inbox}>📥 {INBOX_NAME}</option>}
              {lists.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label} — {o.hint}
                </option>
              ))}
            </select>
          </label>
          <span className="sheet__saved">
            <Icon name="check" size={12} strokeWidth={2.4} />
            Saved
          </span>
          <button
            type="button"
            className="icon-btn"
            aria-label="Delete task"
            title="Delete task"
            onClick={() => {
              remove('task', task.id, task.title);
              onClose();
            }}
          >
            <Icon name="trash" size={16} />
          </button>
          <button type="button" className="icon-btn" aria-label="Close" onClick={close}>
            <Icon name="close" size={17} />
          </button>
        </header>

        <div className="sheet__body scroll">
          <div className="sheet__head">
            <Tick
              done={done}
              label={`Mark ${task.title} ${done ? 'not done' : 'done'} for ${dueLabel(dateKey)}`}
              onToggle={() => toggle(task.id, dateKey)}
            />
            <textarea
              ref={titleRef}
              className={`sheet__title${done ? ' sheet__title--done' : ''}`}
              value={title}
              rows={1}
              aria-label="Task name"
              placeholder="Task name"
              onChange={(event) => {
                const value = event.target.value.replace(/\n/g, ' ');
                setTitle(value);
                queue({ title: value });
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.preventDefault();
              }}
              onBlur={flush}
            />
          </div>

          <section className="sheet__notes">
            <h3 className="sheet__label">
              <Icon name="notes" size={14} />
              Notes
            </h3>
            <RichEditor
              value={notes}
              onChange={(html) => {
                setNotes(html);
                queue({ description: html });
              }}
              ariaLabel="Task notes"
              placeholder="Add notes, links, steps or a checklist…"
              compact
            />
          </section>

          <section className="sheet__details">
            <h3 className="sheet__label">
              <Icon name="settings" size={14} />
              Details
            </h3>

            <div className="detail-row">
              <span className="detail-row__label">
                <Icon name="calendar" size={15} />
                Date
              </span>
              <div className="detail-row__value">
                <input
                  type="date"
                  className="input"
                  value={task.dueDate ?? ''}
                  onChange={(event) => save({ dueDate: event.target.value || null })}
                  aria-label="Date"
                />
                {task.dueDate && (
                  <button type="button" className="btn btn--quiet btn--sm" onClick={() => save({ dueDate: null })}>
                    Clear
                  </button>
                )}
              </div>
            </div>

            <div className="detail-row">
              <span className="detail-row__label">
                <Icon name="flag" size={15} />
                Priority
              </span>
              <div className="detail-row__value">
                <div className="qa-prio" role="radiogroup" aria-label="Priority">
                  {PRIORITIES.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      role="radio"
                      aria-checked={task.priority === p.value}
                      className={`qa-prio__btn qa-prio__btn--${p.value}`}
                      onClick={() => save({ priority: p.value })}
                    >
                      <Icon name="flag" size={12} />
                      <span>{p.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="detail-row">
              <span className="detail-row__label">
                <Icon name="repeat" size={15} />
                Repeat
              </span>
              <div className="detail-row__value detail-row__value--stack">
                <select
                  className="select"
                  value={task.repeat}
                  onChange={(event) => setRepeat(event.target.value as RepeatMode)}
                  aria-label="Repeat"
                >
                  {REPEATS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
                {showDays && (
                  <div className="day-picks" role="group" aria-label="Repeat on">
                    {DAY_LABELS.map((label, index) => (
                      <button
                        key={label}
                        type="button"
                        className="day-pick"
                        aria-pressed={task.repeatDays.includes(index as WeekdayIndex)}
                        onClick={() => toggleDay(index as WeekdayIndex)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="detail-row">
              <span className="detail-row__label">
                <Icon name="clock" size={15} />
                Time (min)
              </span>
              <div className="detail-row__value detail-row__value--pair">
                <label>
                  <span>Estimate</span>
                  {numberField(task.estimatedMinutes, (v) => save({ estimatedMinutes: v }), 'Estimated minutes')}
                </label>
                <label>
                  <span>Actual</span>
                  {numberField(task.actualMinutes, (v) => save({ actualMinutes: v }), 'Actual minutes')}
                </label>
              </div>
            </div>

            <div className="detail-row">
              <span className="detail-row__label">
                <Icon name="tag" size={15} />
                Tags
              </span>
              <div className="detail-row__value">
                <input
                  className="input"
                  value={tagText}
                  placeholder="home, errands"
                  aria-label="Tags, separated by commas"
                  onChange={(event) => setTagText(event.target.value)}
                  onBlur={() =>
                    save({
                      tags: tagText
                        .split(',')
                        .map((t) => t.trim().replace(/^#/, ''))
                        .filter(Boolean),
                    })
                  }
                />
              </div>
            </div>
          </section>
        </div>

        <footer className="sheet__foot">
          <span>Changes save automatically</span>
          <button type="button" className="btn btn--primary" onClick={close}>
            Done
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
