import { useState } from 'react';
import {
  DAY_LABELS,
  DAY_LABELS_FULL,
  formatMinutes,
  formatShortDate,
  fromKey,
  toKey,
  todayKey,
} from '../lib/date';
import {
  hasSchedule,
  isDone,
  scheduledDaysInWeek,
  weekProgress,
  type CompletionMap,
} from '../lib/selectors';
import type { Task, WeekdayIndex } from '../lib/types';
import { Icon } from './Icon';
import { Menu } from './Menu';
import { Tick } from './Tick';
import { TaskForm, draftFromTask, type TaskDraft } from './TaskForm';

interface TaskRowProps {
  task: Task;
  weekDates: Date[];
  completions: CompletionMap;
  showGrid: boolean;
  onToggle: (dateKey: string) => void;
  onSave: (draft: TaskDraft) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  dragProps?: Record<string, unknown> & { className?: string };
  /** Path shown when the row appears outside its own category column. */
  contextLabel?: string;
}

export function TaskRow({
  task,
  weekDates,
  completions,
  showGrid,
  onToggle,
  onSave,
  onDelete,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  dragProps,
  contextLabel,
}: TaskRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<TaskDraft>(() => draftFromTask(task));

  const days = scheduledDaysInWeek(task, weekDates[0]);
  // A task with no schedule at all stays tickable on any day rather than
  // becoming a dead row.
  const openEnded = !hasSchedule(task);
  const progress = weekProgress(task, completions, weekDates[0]);
  const allDone = progress.total > 0 && progress.done === progress.total;
  const overdue = Boolean(task.dueDate && task.dueDate < todayKey());
  const key = todayKey();

  const startEdit = () => {
    setDraft(draftFromTask(task));
    setEditing(true);
    setExpanded(true);
  };

  if (editing) {
    return (
      <li>
        <TaskForm
          draft={draft}
          onChange={setDraft}
          onSubmit={() => {
            onSave(draft);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
          submitLabel="Save changes"
          showActual
        />
      </li>
    );
  }

  const rowClass = [
    'task-row',
    allDone ? 'task-row--done' : '',
    expanded ? 'task-row--expanded' : '',
    dragProps?.className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <li>
      <div {...(dragProps ?? {})} className={rowClass} data-task-id={task.id}>
        <span className={`prio prio--${task.priority}`} title={`${task.priority} priority`} />

        <span className="task-row__main">
          <button
            type="button"
            className="task-row__title"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
            title={task.description || task.title}
          >
            {task.title}
          </button>

          <span className="task-row__meta">
            {contextLabel && <span className="chip">{contextLabel}</span>}
            {task.repeat !== 'none' && (
              <span className="chip chip--accent" title={`Repeats ${task.repeat}`}>
                <Icon name="repeat" size={10} />
                {task.repeat === 'daily' ? 'Daily' : task.repeat === 'weekly' ? 'Weekly' : 'Custom'}
              </span>
            )}
            {task.dueDate && (
              <span
                className={overdue && !allDone ? 'chip chip--danger' : 'chip'}
                title={`Due ${task.dueDate}`}
              >
                <Icon name="calendar" size={10} />
                {formatShortDate(fromKey(task.dueDate))}
              </span>
            )}
            {task.estimatedMinutes ? (
              <span className="chip" title="Estimated time">
                <Icon name="clock" size={10} />
                {formatMinutes(task.estimatedMinutes)}
              </span>
            ) : null}
            {task.description && (
              <span className="chip" title={task.description}>
                <Icon name="note" size={10} />
              </span>
            )}
            {task.tags.map((tag) => (
              <span className="chip chip--accent" key={tag}>
                #{tag}
              </span>
            ))}
          </span>
        </span>

        {showGrid && (
          <span className="task-row__grid" role="group" aria-label={`Weekly progress for ${task.title}`}>
            {weekDates.map((date, index) => {
              const dateKey = toKey(date);
              const scheduled = openEnded || days.includes(index as WeekdayIndex);
              return (
                <span className="tick-cell" key={dateKey}>
                  <Tick
                    done={isDone(completions, task.id, dateKey)}
                    today={dateKey === key}
                    future={dateKey > key}
                    disabled={!scheduled && !isDone(completions, task.id, dateKey)}
                    label={`${task.title} — ${DAY_LABELS_FULL[index]} ${formatShortDate(date)}${
                      scheduled ? '' : ' (not scheduled)'
                    }`}
                    onToggle={() => onToggle(dateKey)}
                  />
                  <span
                    className={
                      dateKey === key ? 'tick-cell__label tick-cell__label--today' : 'tick-cell__label'
                    }
                    aria-hidden="true"
                  >
                    {DAY_LABELS[index]}
                  </span>
                </span>
              );
            })}
          </span>
        )}

        <span className="task-row__end">
          <span className="task-row__stat" title="Completed scheduled days this week">
            {progress.done}/{progress.total || '—'}
          </span>
          <span className="task-row__actions">
          <button
            type="button"
            className="icon-btn icon-btn--sm"
            onClick={startEdit}
            aria-label={`Edit ${task.title}`}
          >
            <Icon name="edit" size={14} />
          </button>
          <Menu
            label={`Actions for ${task.title}`}
            items={[
              { label: expanded ? 'Hide details' : 'Show details', icon: 'note', onSelect: () => setExpanded((v) => !v) },
              { label: 'Edit task', icon: 'edit', onSelect: startEdit },
              { label: 'Duplicate', icon: 'copy', onSelect: onDuplicate },
              { label: 'Move up', icon: 'left', hint: 'Alt ↑', onSelect: onMoveUp },
              { label: 'Move down', icon: 'right', hint: 'Alt ↓', onSelect: onMoveDown },
              { label: 'Delete', icon: 'trash', danger: true, onSelect: onDelete },
            ]}
          />
          </span>
        </span>
      </div>

      {expanded && (
        <div className="task-detail">
          {task.description && <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>{task.description}</p>}
          <div className="detail-facts">
            <span className="chip">
              <Icon name="flag" size={10} /> {task.priority}
            </span>
            <span className="chip">
              <Icon name="repeat" size={10} />{' '}
              {days.length
                ? days.map((d) => DAY_LABELS[d]).join(' · ')
                : openEnded
                  ? 'Any day'
                  : 'Not scheduled this week'}
            </span>
            <span className="chip">
              <Icon name="clock" size={10} /> Est {formatMinutes(task.estimatedMinutes)}
            </span>
            <span className="chip">
              <Icon name="clock" size={10} /> Actual {formatMinutes(task.actualMinutes)}
            </span>
            {task.dueDate && (
              <span className="chip">
                <Icon name="calendar" size={10} /> Due {formatShortDate(fromKey(task.dueDate))}
              </span>
            )}
            <span className="chip chip--primary">
              {progress.done}/{progress.total} this week
            </span>
          </div>
        </div>
      )}
    </li>
  );
}
