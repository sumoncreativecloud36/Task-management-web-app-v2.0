import { useCallback, useMemo } from 'react';
import { useToast } from '../components/Toast';
import { useData } from './store';
import type { EntityKind } from './types';

const LABEL: Record<EntityKind, string> = {
  main: 'Main category',
  sub: 'Subcategory',
  category: 'Category',
  task: 'Task',
};

/** Mutations shared across views, with an undo affordance for deletes. */
export function useActions() {
  const { dispatch } = useData();
  const { notify } = useToast();

  const remove = useCallback(
    (kind: EntityKind, id: string, name: string) => {
      dispatch({ type: 'softDelete', kind, id });
      notify(`${LABEL[kind]} “${name}” moved to Recycle Bin`, {
        label: 'Undo',
        run: () => dispatch({ type: 'restore', kind, id }),
      });
    },
    [dispatch, notify],
  );

  const rename = useCallback(
    (kind: EntityKind, id: string, name: string) => {
      if (kind === 'task') dispatch({ type: 'update', kind: 'task', id, patch: { title: name } });
      else if (kind === 'main') dispatch({ type: 'update', kind: 'main', id, patch: { name } });
      else if (kind === 'sub') dispatch({ type: 'update', kind: 'sub', id, patch: { name } });
      else dispatch({ type: 'update', kind: 'category', id, patch: { name } });
    },
    [dispatch],
  );

  const move = useCallback(
    (kind: EntityKind, id: string, targetId: string | null) =>
      dispatch({ type: 'move', kind, id, targetId }),
    [dispatch],
  );

  const toggle = useCallback(
    (taskId: string, dateKey: string) => dispatch({ type: 'toggleCompletion', taskId, dateKey }),
    [dispatch],
  );

  return useMemo(() => ({ dispatch, remove, rename, move, toggle, notify }), [
    dispatch,
    remove,
    rename,
    move,
    toggle,
    notify,
  ]);
}
