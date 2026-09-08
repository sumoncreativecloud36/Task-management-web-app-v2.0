import { useMemo, useState } from 'react';
import { Empty } from '../components/Empty';
import { Icon } from '../components/Icon';
import { Modal } from '../components/Modal';
import { useActions } from '../lib/actions';
import { formatRelative } from '../lib/date';
import { descendantIds } from '../lib/reducer';
import { useData } from '../lib/store';
import type { EntityKind } from '../lib/types';

interface BinRow {
  kind: EntityKind;
  id: string;
  name: string;
  deletedAt: string;
  detail: string;
}

const KIND_LABEL: Record<EntityKind, string> = {
  main: 'Main category',
  sub: 'Subcategory',
  category: 'Category',
  task: 'Task',
};

export function RecycleBinView() {
  const { data } = useData();
  const { dispatch, notify } = useActions();
  const [confirmEmpty, setConfirmEmpty] = useState(false);

  const rows = useMemo<BinRow[]>(() => {
    const list: BinRow[] = [];

    for (const main of data.mainCategories.filter((r) => r.deletedAt)) {
      const { subIds, categoryIds, taskIds } = descendantIds(data, 'main', main.id);
      list.push({
        kind: 'main',
        id: main.id,
        name: `${main.icon} ${main.name}`,
        deletedAt: main.deletedAt!,
        detail: `${subIds.size} subcategories · ${categoryIds.size} categories · ${taskIds.size} tasks`,
      });
    }
    for (const sub of data.subcategories.filter((r) => r.deletedAt)) {
      const { categoryIds, taskIds } = descendantIds(data, 'sub', sub.id);
      list.push({
        kind: 'sub',
        id: sub.id,
        name: sub.name,
        deletedAt: sub.deletedAt!,
        detail: `${categoryIds.size} categories · ${taskIds.size} tasks`,
      });
    }
    for (const category of data.categories.filter((r) => r.deletedAt)) {
      const { taskIds } = descendantIds(data, 'category', category.id);
      list.push({
        kind: 'category',
        id: category.id,
        name: category.name,
        deletedAt: category.deletedAt!,
        detail: `${taskIds.size} tasks`,
      });
    }
    for (const task of data.tasks.filter((r) => r.deletedAt)) {
      const ticks = data.completions.filter((c) => c.taskId === task.id && c.completed).length;
      list.push({
        kind: 'task',
        id: task.id,
        name: task.title,
        deletedAt: task.deletedAt!,
        detail: `${ticks} completed days recorded`,
      });
    }

    return list.sort((a, b) => (a.deletedAt < b.deletedAt ? 1 : -1));
  }, [data]);

  return (
    <div className="view view--pad scroll">
      <div className="view-head">
        <div>
          <h1 className="view-title">Recycle Bin</h1>
          <p className="view-sub">
            Deleted items keep their history. Restore them, or delete permanently to free the space.
          </p>
        </div>
        {rows.length > 0 && (
          <button type="button" className="btn btn--danger btn--sm" onClick={() => setConfirmEmpty(true)}>
            <Icon name="trash" size={13} /> Empty bin
          </button>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="card">
          <Empty icon="trash" text="The Recycle Bin is empty." pad />
        </div>
      ) : (
        <div className="card" style={{ padding: 8 }}>
          <ul style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {rows.map((row) => (
              <li key={`${row.kind}-${row.id}`}>
                <div className="task-row">
                  <span className="chip">{KIND_LABEL[row.kind]}</span>
                  <span className="task-row__main">
                    <span className="task-row__title" style={{ cursor: 'default' }}>
                      {row.name}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-faint)' }}>{row.detail}</span>
                  </span>
                  <span className="chip" style={{ marginLeft: 'auto' }}>
                    {formatRelative(row.deletedAt)}
                  </span>
                  <button
                    type="button"
                    className="btn btn--ghost btn--sm"
                    onClick={() => {
                      dispatch({ type: 'restore', kind: row.kind, id: row.id });
                      notify(`Restored “${row.name}”`);
                    }}
                  >
                    <Icon name="restore" size={13} /> Restore
                  </button>
                  <button
                    type="button"
                    className="btn btn--danger btn--sm"
                    onClick={() => {
                      dispatch({ type: 'purge', kind: row.kind, id: row.id });
                      notify(`Deleted “${row.name}” permanently`);
                    }}
                  >
                    <Icon name="trash" size={13} /> Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {confirmEmpty && (
        <Modal
          title="Empty the Recycle Bin?"
          onClose={() => setConfirmEmpty(false)}
          footer={
            <>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => setConfirmEmpty(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn--danger btn--sm"
                onClick={() => {
                  dispatch({ type: 'emptyBin' });
                  setConfirmEmpty(false);
                  notify('Recycle Bin emptied');
                }}
              >
                Delete {rows.length} item{rows.length === 1 ? '' : 's'} permanently
              </button>
            </>
          }
        >
          <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>
            This permanently removes {rows.length} item{rows.length === 1 ? '' : 's'} and every task
            and completion record beneath them. It cannot be undone.
          </p>
        </Modal>
      )}
    </div>
  );
}
