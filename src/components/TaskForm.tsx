import { useEffect, useRef, useState } from 'react';
import { DAY_LABELS } from '../lib/date';
import type { Priority, RepeatMode, Task, WeekdayIndex } from '../lib/types';
import { Icon } from './Icon';

export interface TaskDraft {
  title: string;
  description: string;
  priority: Priority;
  dueDate: string | null;
  estimatedMinutes: number | null;
  actualMinutes: number | null;
  repeat: RepeatMode;
  repeatDays: WeekdayIndex[];
  tags: string[];
}

export function draftFromTask(task: Task): TaskDraft {
  return {
    title: task.title,
    description: task.description,
    priority: task.priority,
    dueDate: task.dueDate,
    estimatedMinutes: task.estimatedMinutes,
    actualMinutes: task.actualMinutes,
    repeat: task.repeat,
    repeatDays: task.repeatDays,
    tags: task.tags,
  };
}

export function emptyDraft(defaultDay?: WeekdayIndex): TaskDraft {
  return {
    title: '',
    description: '',
    priority: 'medium',
    dueDate: null,
    estimatedMinutes: null,
    actualMinutes: null,
    repeat: 'none',
    repeatDays: defaultDay === undefined ? [] : [defaultDay],
    tags: [],
  };
}

const PRIORITIES: Priority[] = ['low', 'medium', 'high', 'urgent'];
const REPEATS: { value: RepeatMode; label: string }[] = [
  { value: 'none', label: 'No repeat' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'custom', label: 'Custom days' },
];

interface TaskFormProps {
  draft: TaskDraft;
  onChange: (draft: TaskDraft) => void;
  onSubmit: () => void;
  onCancel: () => void;
  submitLabel: string;
  /** Extra fields only make sense once a task exists. */
  showActual?: boolean;
  autoFocus?: boolean;
}

/**
 * The inline task editor. Typing a title and pressing Enter is enough — every
 * other field stays optional so quick capture is never slowed down.
 */
export function TaskForm({
  draft,
  onChange,
  onSubmit,
  onCancel,
  submitLabel,
  showActual,
  autoFocus = true,
}: TaskFormProps) {
  const titleRef = useRef<HTMLInputElement>(null);
  const [tagText, setTagText] = useState(draft.tags.join(', '));

  useEffect(() => {
    if (autoFocus) titleRef.current?.focus();
  }, [autoFocus]);

  const patch = (next: Partial<TaskDraft>) => onChange({ ...draft, ...next });

  const toggleDay = (day: WeekdayIndex) => {
    const has = draft.repeatDays.includes(day);
    const repeatDays = (has
      ? draft.repeatDays.filter((d) => d !== day)
      : [...draft.repeatDays, day]
    ).sort((a, b) => a - b);
    // Picking days by hand implies a custom schedule.
    const repeat: RepeatMode =
      repeatDays.length === 7 ? 'daily' : repeatDays.length > 1 ? 'custom' : draft.repeat === 'daily' ? 'none' : draft.repeat;
    patch({ repeatDays, repeat });
  };

  const setRepeat = (repeat: RepeatMode) => {
    if (repeat === 'daily') patch({ repeat, repeatDays: [0, 1, 2, 3, 4, 5, 6] });
    else patch({ repeat });
  };

  return (
    <form
      className="composer"
      onSubmit={(event) => {
        event.preventDefault();
        if (draft.title.trim()) onSubmit();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          onCancel();
        }
      }}
    >
      <div className="field">
        <label className="field__label" htmlFor="task-title">
          Task name
        </label>
        <input
          id="task-title"
          ref={titleRef}
          className="input"
          placeholder="Write a task…"
          value={draft.title}
          onChange={(event) => patch({ title: event.target.value })}
        />
      </div>

      <div className="grid-4">
        <div className="field">
          <label className="field__label" htmlFor="task-priority">
            Priority
          </label>
          <select
            id="task-priority"
            className="select"
            value={draft.priority}
            onChange={(event) => patch({ priority: event.target.value as Priority })}
          >
            {PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {priority[0].toUpperCase() + priority.slice(1)}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="task-due">
            Due date
          </label>
          <input
            id="task-due"
            type="date"
            className="input"
            value={draft.dueDate ?? ''}
            onChange={(event) => patch({ dueDate: event.target.value || null })}
          />
        </div>

        <div className="field">
          <label className="field__label" htmlFor="task-estimate">
            Estimated (min)
          </label>
          <input
            id="task-estimate"
            type="number"
            min={0}
            step={5}
            className="input"
            placeholder="—"
            value={draft.estimatedMinutes ?? ''}
            onChange={(event) =>
              patch({ estimatedMinutes: event.target.value ? Number(event.target.value) : null })
            }
          />
        </div>

        {showActual ? (
          <div className="field">
            <label className="field__label" htmlFor="task-actual">
              Actual (min)
            </label>
            <input
              id="task-actual"
              type="number"
              min={0}
              step={5}
              className="input"
              placeholder="—"
              value={draft.actualMinutes ?? ''}
              onChange={(event) =>
                patch({ actualMinutes: event.target.value ? Number(event.target.value) : null })
              }
            />
          </div>
        ) : (
          <div className="field">
            <label className="field__label" htmlFor="task-repeat">
              Repeat
            </label>
            <select
              id="task-repeat"
              className="select"
              value={draft.repeat}
              onChange={(event) => setRepeat(event.target.value as RepeatMode)}
            >
              {REPEATS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {showActual && (
        <div className="field">
          <label className="field__label" htmlFor="task-repeat-2">
            Repeat
          </label>
          <select
            id="task-repeat-2"
            className="select"
            value={draft.repeat}
            onChange={(event) => setRepeat(event.target.value as RepeatMode)}
          >
            {REPEATS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      )}

      <fieldset className="field" style={{ border: 'none', margin: 0, padding: 0 }}>
        <legend className="field__label" style={{ padding: 0 }}>
          Scheduled days
        </legend>
        <div className="day-toggle">
          {DAY_LABELS.map((label, index) => (
            <button
              key={label}
              type="button"
              className="day-toggle__item"
              aria-pressed={draft.repeatDays.includes(index as WeekdayIndex)}
              onClick={() => toggleDay(index as WeekdayIndex)}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="grid-2">
        <div className="field">
          <label className="field__label" htmlFor="task-tags">
            Tags
          </label>
          <input
            id="task-tags"
            className="input"
            placeholder="design, urgent"
            value={tagText}
            onChange={(event) => {
              setTagText(event.target.value);
              patch({
                tags: event.target.value
                  .split(',')
                  .map((tag) => tag.trim())
                  .filter(Boolean),
              });
            }}
          />
        </div>
        <div className="field">
          <label className="field__label" htmlFor="task-notes">
            Notes
          </label>
          <input
            id="task-notes"
            className="input"
            placeholder="Optional detail"
            value={draft.description}
            onChange={(event) => patch({ description: event.target.value })}
          />
        </div>
      </div>

      <div className="composer__actions">
        <span className="composer__hint">
          <Icon name="check" size={11} /> Enter to save · Esc to cancel
        </span>
        <button type="button" className="btn btn--ghost btn--sm" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn--primary btn--sm" disabled={!draft.title.trim()}>
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
