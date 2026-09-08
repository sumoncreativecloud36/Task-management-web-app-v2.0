import { useMemo, useRef, useState } from 'react';
import { CategoryTree } from '../components/CategoryTree';
import { ColumnList } from '../components/ColumnList';
import { Empty } from '../components/Empty';
import { Icon } from '../components/Icon';
import { TaskRow } from '../components/TaskRow';
import { TaskForm, emptyDraft, type TaskDraft } from '../components/TaskForm';
import { useDragList } from '../components/dragList';
import { useActions } from '../lib/actions';
import {
  DAY_LABELS,
  DAY_LABELS_FULL,
  formatWeekRange,
  startOfWeek,
  toKey,
  today,
  weekdayIndex,
  weekDates as weekDatesOf,
} from '../lib/date';
import {
  completionMap,
  isWeekComplete,
  taskCounts,
  visibleCategories,
  visibleMains,
  visibleSubs,
  visibleTasks,
} from '../lib/selectors';
import { useData } from '../lib/store';
import { useUi } from '../lib/ui';

export function TasksView() {
  const { data } = useData();
  const { dispatch, remove, rename, move, toggle } = useActions();
  const {
    selection,
    selectCategory,
    weekCursor,
    goPrevWeek,
    goNextWeek,
    goThisWeek,
    mobileColumn,
    setMobileColumn,
  } = useUi();

  const [composerOpen, setComposerOpen] = useState(false);
  const [draft, setDraft] = useState<TaskDraft>(() => emptyDraft(weekdayIndex(today())));
  const [quickTitle, setQuickTitle] = useState('');
  const quickRef = useRef<HTMLInputElement>(null);

  const mains = useMemo(() => visibleMains(data), [data]);
  const subs = useMemo(() => visibleSubs(data, selection.mainId), [data, selection.mainId]);
  const categories = useMemo(
    () => visibleCategories(data, selection.subId),
    [data, selection.subId],
  );
  const tasks = useMemo(
    () => visibleTasks(data, selection.categoryId),
    [data, selection.categoryId],
  );
  const counts = useMemo(() => taskCounts(data), [data]);
  const map = useMemo(() => completionMap(data), [data]);
  const settings = data.settings;

  const shownTasks = useMemo(() => {
    if (!settings.hideCompleted) return tasks;
    return tasks.filter((task) => !isWeekComplete(task, map, weekCursor));
  }, [tasks, settings.hideCompleted, map, weekCursor]);

  const dates = useMemo(() => weekDatesOf(weekCursor), [weekCursor]);
  const todayKeyValue = toKey(today());
  const isThisWeek = toKey(startOfWeek(today())) === toKey(weekCursor);

  // New tasks land on today when the current week is open, and on the first day
  // of the week otherwise, so a freshly created task is never invisible.
  const landingDay = isThisWeek ? weekdayIndex(today()) : 0;

  const taskIds = useMemo(() => shownTasks.map((task) => task.id), [shownTasks]);
  const { getItemProps, moveByKeyboard } = useDragList(taskIds, (id, targetId) =>
    move('task', id, targetId),
  );

  const mainName = mains.find((m) => m.id === selection.mainId)?.name;
  const subName = subs.find((s) => s.id === selection.subId)?.name;
  const categoryName = categories.find((c) => c.id === selection.categoryId)?.name;

  const createQuick = () => {
    const title = quickTitle.trim();
    if (!title || !selection.categoryId) return;
    dispatch({
      type: 'addTask',
      input: { categoryId: selection.categoryId, title, repeatDays: [landingDay] },
    });
    setQuickTitle('');
    quickRef.current?.focus();
  };

  const createFromDraft = () => {
    if (!selection.categoryId || !draft.title.trim()) return;
    dispatch({
      type: 'addTask',
      input: {
        categoryId: selection.categoryId,
        title: draft.title,
        description: draft.description,
        priority: draft.priority,
        dueDate: draft.dueDate,
        estimatedMinutes: draft.estimatedMinutes,
        repeat: draft.repeat,
        repeatDays: draft.repeatDays,
        tags: draft.tags,
      },
    });
    setDraft(emptyDraft(landingDay));
    setComposerOpen(false);
  };

  const mobileTitles = ['Categories', 'Category', 'Tasks'];
  const mobileTrail = [
    [mainName, subName].filter(Boolean).join(' / '),
    categoryName,
  ]
    .filter(Boolean)
    .slice(0, mobileColumn)
    .join(' / ');

  return (
    <div className="view">
      {/* Mobile drill-down header: the columns become a flow with a back button. */}
      <div className="crumb-nav">
        {mobileColumn > 0 && (
          <button
            type="button"
            className="btn btn--quiet btn--sm"
            onClick={() => setMobileColumn(mobileColumn - 1)}
          >
            <Icon name="back" size={14} /> Back
          </button>
        )}
        <div>
          <div className="crumb-nav__title">{mobileTitles[mobileColumn]}</div>
          <div className="crumb-nav__sub">
            {mobileTrail || 'Choose where the work lives'}
          </div>
        </div>
        <div className="steps" aria-hidden="true">
          {[0, 1, 2].map((index) => (
            <span
              key={index}
              className={index === mobileColumn ? 'step-dot step-dot--on' : 'step-dot'}
            />
          ))}
        </div>
      </div>

      <div className="workspace">
        <CategoryTree mobileActive={mobileColumn === 0} />

        <ColumnList
          title="Category"
          mobileActive={mobileColumn === 1}
          items={categories.map((category) => ({
            id: category.id,
            name: category.name,
            count: counts.perCategory.get(category.id) ?? 0,
          }))}
          selectedId={selection.categoryId}
          onSelect={selectCategory}
          onAdd={(name) =>
            selection.subId && dispatch({ type: 'addCategory', subcategoryId: selection.subId, name })
          }
          onRename={(id, name) => rename('category', id, name)}
          onDelete={(id) =>
            remove('category', id, categories.find((c) => c.id === id)?.name ?? '')
          }
          onMove={(id, targetId) => move('category', id, targetId)}
          addLabel="Add Category"
          addPlaceholder="Enter category name…"
          emptyText="No categories yet."
          disabled={!selection.subId}
          disabledText="Pick a subcategory first."
        />

        {/* ----------------------------------------------------------- tasks */}
        <section className="column" data-active={mobileColumn === 2} aria-label="Tasks">
          <header className="column__head">
            <h2 className="column__title">Tasks</h2>
            <span className="column__count">{tasks.length || ''}</span>
            <div className="column__tools">
              <button
                type="button"
                className="btn btn--quiet btn--sm"
                onClick={() =>
                  dispatch({
                    type: 'setSettings',
                    patch: { hideCompleted: !settings.hideCompleted },
                  })
                }
                aria-pressed={settings.hideCompleted}
                title="Hide tasks whose scheduled days are all done"
              >
                <Icon name="check" size={13} />
                {settings.hideCompleted ? 'Show all' : 'Hide done'}
              </button>
            </div>
          </header>

          <div className="tasks-head">
            <div className="breadcrumb">
              {mainName ? (
                <>
                  <strong>{mainName}</strong>
                  {subName && (
                    <>
                      <span className="breadcrumb__sep">/</span>
                      <strong>{subName}</strong>
                    </>
                  )}
                  {categoryName && (
                    <>
                      <span className="breadcrumb__sep">/</span>
                      <strong>{categoryName}</strong>
                    </>
                  )}
                </>
              ) : (
                <span>Nothing selected</span>
              )}
            </div>

            <div className="week-bar">
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={goPrevWeek}
                aria-label="Previous week"
              >
                <Icon name="left" size={13} /> Prev
              </button>
              <span className="week-bar__label" aria-live="polite">
                {formatWeekRange(weekCursor)}
              </span>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={goNextWeek}
                aria-label="Next week"
              >
                Next <Icon name="right" size={13} />
              </button>
              {!isThisWeek && (
                <button type="button" className="btn btn--quiet btn--sm" onClick={goThisWeek}>
                  This week
                </button>
              )}

              <span className="week-bar__spacer" />
            </div>

            {selection.categoryId && !composerOpen && (
              <form
                className="inline-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  createQuick();
                }}
              >
                <input
                  ref={quickRef}
                  className="input"
                  placeholder="Write a task…"
                  value={quickTitle}
                  onChange={(event) => setQuickTitle(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') setQuickTitle('');
                  }}
                  aria-label="Quick add task"
                />
                <button type="submit" className="btn btn--primary btn--sm" disabled={!quickTitle.trim()}>
                  Add
                </button>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() => {
                    setDraft({ ...emptyDraft(landingDay), title: quickTitle });
                    setComposerOpen(true);
                  }}
                  title="Open the full task editor"
                >
                  <Icon name="plus" size={13} /> Add Task
                </button>
              </form>
            )}
          </div>

          <div className="task-list scroll">
            {composerOpen && (
              <TaskForm
                draft={draft}
                onChange={setDraft}
                onSubmit={createFromDraft}
                onCancel={() => {
                  setComposerOpen(false);
                  setDraft(emptyDraft(landingDay));
                }}
                submitLabel="Create Task"
              />
            )}

            {settings.showWeekGrid && shownTasks.length > 0 && (
              <div className="task-sheet-head">
                <span className="task-sheet-head__grow">Task</span>
                <span className="day-head">
                  {DAY_LABELS.map((label, index) => (
                    <abbr
                      key={label}
                      title={`${DAY_LABELS_FULL[index]} ${dates[index].getDate()}`}
                      style={{ textDecoration: 'none' }}
                      className={
                        toKey(dates[index]) === todayKeyValue
                          ? 'day-head__cell day-head__cell--today'
                          : 'day-head__cell'
                      }
                    >
                      {label}
                    </abbr>
                  ))}
                </span>
                <span className="task-sheet-head__end" aria-hidden="true" />
              </div>
            )}

            {!selection.categoryId ? (
              <Empty
                icon="folder"
                text="Choose a main category, subcategory and category to see its tasks."
                pad
              />
            ) : shownTasks.length === 0 ? (
              <Empty
                icon="inbox"
                text={
                  tasks.length
                    ? 'Every task here is complete for this week.'
                    : 'No tasks yet.'
                }
                actionLabel={tasks.length ? undefined : 'Create Your First Task'}
                onAction={tasks.length ? undefined : () => setComposerOpen(true)}
                pad
              />
            ) : (
              <ul>
                {shownTasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    weekDates={dates}
                    completions={map}
                    showGrid={settings.showWeekGrid}
                    onToggle={(dateKey) => toggle(task.id, dateKey)}
                    onSave={(next) =>
                      dispatch({
                        type: 'update',
                        kind: 'task',
                        id: task.id,
                        patch: {
                          title: next.title,
                          description: next.description,
                          priority: next.priority,
                          dueDate: next.dueDate,
                          estimatedMinutes: next.estimatedMinutes,
                          actualMinutes: next.actualMinutes,
                          repeat: next.repeat,
                          repeatDays: next.repeatDays,
                          tags: next.tags,
                        },
                      })
                    }
                    onDelete={() => remove('task', task.id, task.title)}
                    onDuplicate={() => dispatch({ type: 'duplicateTask', id: task.id })}
                    onMoveUp={() => moveByKeyboard(task.id, -1)}
                    onMoveDown={() => moveByKeyboard(task.id, 1)}
                    dragProps={getItemProps(task.id)}
                  />
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
