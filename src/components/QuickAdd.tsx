import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useToast } from './Toast';
import { Icon } from './Icon';
import { DAY_LABELS, addDays, formatShortDate, fromKey, startOfWeek, toKey, today, weekdayIndex } from '../lib/date';
import { parseQuickAdd } from '../lib/quickAdd';
import { INBOX_NAME, inboxCategoryId } from '../lib/reducer';
import { visibleCategories, visibleMains, visibleSubs } from '../lib/selectors';
import { useData } from '../lib/store';
import { useUi } from '../lib/ui';
import type { AppData, Priority, WeekdayIndex } from '../lib/types';

const LAST_LIST_KEY = 'taskmanager.lastList';

const PRIORITIES: { value: Priority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

interface ListOption {
  id: string;
  label: string;
  hint: string;
}

/** Every list a task can live in, as "Category" with its "Main / Sub" path. */
function listOptions(data: AppData): ListOption[] {
  const inbox = inboxCategoryId(data);
  const options: ListOption[] = [];
  for (const main of visibleMains(data)) {
    for (const sub of visibleSubs(data, main.id)) {
      for (const category of visibleCategories(data, sub.id)) {
        if (category.id === inbox) continue;
        options.push({ id: category.id, label: category.name, hint: `${main.name} / ${sub.name}` });
      }
    }
  }
  return options;
}

const squash = (text: string) => text.toLowerCase().replace(/[\s_-]+/g, '');

/** "#work" → the first list whose category, sub or main name matches. */
export function listForHash(data: AppData, hash: string): string | null {
  const wanted = squash(hash);
  const category = visibleMains(data)
    .flatMap((m) => visibleSubs(data, m.id))
    .flatMap((s) => visibleCategories(data, s.id))
    .find((c) => squash(c.name) === wanted);
  if (category) return category.id;
  for (const main of visibleMains(data)) {
    for (const sub of visibleSubs(data, main.id)) {
      if (squash(sub.name) === wanted || squash(main.name) === wanted) {
        const first = visibleCategories(data, sub.id)[0];
        if (first) return first.id;
      }
    }
  }
  return null;
}

/** "Today", "Tomorrow", "Fri", or "Sep 30". */
export function dueLabel(key: string | null): string {
  if (!key) return 'No date';
  const now = today();
  if (key === toKey(now)) return 'Today';
  if (key === toKey(addDays(now, 1))) return 'Tomorrow';
  if (key === toKey(addDays(now, -1))) return 'Yesterday';
  const date = fromKey(key);
  const diff = Math.round((date.getTime() - now.getTime()) / 86_400_000);
  if (diff > 1 && diff < 7) return DAY_LABELS[weekdayIndex(date)];
  return formatShortDate(date);
}

export function readLastList(): string | null {
  try {
    return localStorage.getItem(LAST_LIST_KEY);
  } catch {
    return null;
  }
}

/**
 * Add a task in one line from anywhere. Typing "Pay rent fri !high #home"
 * already sets the date, priority and list; the chips show what was understood
 * and can be tapped to change it.
 */
export function QuickAdd() {
  const { quickAdd, closeQuickAdd } = useUi();
  if (!quickAdd) return null;
  return <QuickAddSheet initialDate={quickAdd.date} initialList={quickAdd.categoryId} onClose={closeQuickAdd} />;
}

function QuickAddSheet({
  initialDate,
  initialList,
  onClose,
}: {
  initialDate?: string | null;
  initialList?: string | null;
  onClose: () => void;
}) {
  const { data, dispatch } = useData();
  const { notify } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const dateRef = useRef<HTMLInputElement>(null);

  const options = useMemo(() => listOptions(data), [data]);
  const validList = (id: string | null | undefined) =>
    id && options.some((o) => o.id === id) ? id : '';

  const [text, setText] = useState('');
  // User choices made with the chips win over what the text implies.
  const [dateChoice, setDateChoice] = useState<string | null | undefined>(undefined);
  const [priorityChoice, setPriorityChoice] = useState<Priority | undefined>(undefined);
  const [listChoice, setListChoice] = useState<string | undefined>(undefined);

  const baseDate = initialDate === undefined ? toKey(today()) : initialDate;
  const baseList = validList(initialList) || validList(readLastList());

  const parsed = useMemo(() => parseQuickAdd(text), [text]);
  const hashList = useMemo(() => {
    for (const hash of parsed.hashes) {
      const id = listForHash(data, hash);
      if (id) return { id, hash };
    }
    return null;
  }, [data, parsed.hashes]);

  const repeating = Boolean(parsed.repeat);
  const date =
    dateChoice !== undefined ? dateChoice : (parsed.dueDate ?? (repeating ? null : baseDate));
  const priority = priorityChoice ?? parsed.priority ?? 'medium';
  const list = listChoice ?? hashList?.id ?? baseList;
  const tags = parsed.hashes.filter((h) => h !== hashList?.hash);

  let repeatDays: WeekdayIndex[] | undefined = parsed.repeatDays;
  if (parsed.repeat === 'weekly' && !repeatDays?.length) {
    repeatDays = [weekdayIndex(date ? fromKey(date) : today())];
  }

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = () => {
    const title = parsed.title || text.trim();
    if (!title) {
      inputRef.current?.focus();
      return;
    }
    dispatch({
      type: 'addQuickTask',
      input: {
        categoryId: list || null,
        title,
        priority,
        dueDate: date,
        estimatedMinutes: parsed.estimatedMinutes ?? null,
        repeat: parsed.repeat ?? 'none',
        repeatDays,
        tags,
      },
    });
    try {
      if (listChoice !== undefined) localStorage.setItem(LAST_LIST_KEY, listChoice);
    } catch {
      /* ignore */
    }
    const listName = options.find((o) => o.id === list)?.label ?? INBOX_NAME;
    notify(`Added to ${repeating ? listName : `${dueLabel(date)} · ${listName}`}`);
    onClose();
  };

  const now = today();
  const dateChips: { label: string; value: string | null }[] = [
    { label: 'Today', value: toKey(now) },
    { label: 'Tomorrow', value: toKey(addDays(now, 1)) },
    { label: 'Next week', value: toKey(addDays(startOfWeek(now), 7)) },
    { label: 'No date', value: null },
  ];
  const customDate = date !== null && !dateChips.some((c) => c.value === date);

  const repeatText =
    parsed.repeat === 'daily'
      ? 'Every day'
      : repeatDays?.length
        ? `Every ${repeatDays.map((d) => DAY_LABELS[d]).join(', ')}`
        : null;

  return createPortal(
    <div
      className="qa-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <form
        className="qa"
        role="dialog"
        aria-modal="true"
        aria-label="Add a task"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <div className="qa__top">
          <span className="qa__ring" aria-hidden="true" />
          <input
            ref={inputRef}
            className="qa__input"
            placeholder="What do you need to do?"
            value={text}
            onChange={(event) => setText(event.target.value)}
            aria-label="Task"
            enterKeyHint="done"
            autoComplete="off"
          />
        </div>

        {(repeatText || parsed.estimatedMinutes || tags.length > 0) && (
          <div className="qa__detected">
            {repeatText && (
              <span className="chip chip--accent">
                <Icon name="repeat" size={10} />
                {repeatText}
              </span>
            )}
            {parsed.estimatedMinutes ? (
              <span className="chip">
                <Icon name="clock" size={10} />
                {parsed.estimatedMinutes}m
              </span>
            ) : null}
            {tags.map((tag) => (
              <span className="chip" key={tag}>
                #{tag}
              </span>
            ))}
          </div>
        )}

        {/* A repeating task is scheduled by its days, so it needs no date. */}
        {!repeating && (
        <div className="qa__group" role="group" aria-label="Date">
          {dateChips.map((chip) => (
              <button
                key={chip.label}
                type="button"
                className="qa-chip"
                aria-pressed={date === chip.value}
                onClick={() => setDateChoice(chip.value)}
              >
                {chip.label}
              </button>
            ))}
          <button
            type="button"
            className="qa-chip"
            aria-pressed={customDate}
            onClick={() => {
              const input = dateRef.current;
              if (!input) return;
              if (typeof input.showPicker === 'function') input.showPicker();
              else input.click();
            }}
          >
            <Icon name="calendar" size={13} />
            {customDate ? dueLabel(date) : 'Pick date'}
          </button>
          <input
            ref={dateRef}
            type="date"
            className="qa__date"
            tabIndex={-1}
            aria-hidden="true"
            value={date ?? ''}
            onChange={(event) => setDateChoice(event.target.value || null)}
          />
        </div>
        )}

        <div className="qa__group qa__group--split">
          <div className="qa-prio" role="radiogroup" aria-label="Priority">
            {PRIORITIES.map((p) => (
              <button
                key={p.value}
                type="button"
                role="radio"
                aria-checked={priority === p.value}
                className={`qa-prio__btn qa-prio__btn--${p.value}`}
                onClick={() => setPriorityChoice(p.value)}
              >
                <Icon name="flag" size={12} />
                <span>{p.label}</span>
              </button>
            ))}
          </div>

          <label className="qa-list">
            <Icon name="folder" size={13} />
            <select
              value={list}
              onChange={(event) => setListChoice(event.target.value)}
              aria-label="List"
            >
              <option value="">📥 {INBOX_NAME}</option>
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label} — {o.hint}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="qa__foot">
          <p className="qa__tip">
            Try: <b>tomorrow</b>, <b>fri</b>, <b>30/9</b>, <b>every mon</b>, <b>!high</b>, <b>30m</b>,{' '}
            <b>#list</b>
          </p>
          <button type="button" className="btn btn--quiet" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={!text.trim()}>
            Add task
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
