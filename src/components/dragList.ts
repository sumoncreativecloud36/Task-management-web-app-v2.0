import { useCallback, useState, type DragEvent } from 'react';

export interface DropState {
  id: string;
  side: 'before' | 'after';
}

/**
 * Minimal HTML5 reordering for a vertical list. The indicator line shows where
 * the row will land; dropping calls onMove(id, insertBeforeId | null).
 */
export function useDragList(ids: string[], onMove: (id: string, targetId: string | null) => void) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [drop, setDrop] = useState<DropState | null>(null);

  const reset = useCallback(() => {
    setDraggingId(null);
    setDrop(null);
  }, []);

  const getItemProps = useCallback(
    (id: string) => ({
      draggable: true,
      onDragStart: (event: DragEvent<HTMLElement>) => {
        setDraggingId(id);
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', id);
      },
      onDragEnd: reset,
      onDragOver: (event: DragEvent<HTMLElement>) => {
        if (!draggingId || draggingId === id) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        const rect = event.currentTarget.getBoundingClientRect();
        const side = event.clientY - rect.top < rect.height / 2 ? 'before' : 'after';
        setDrop((current) =>
          current?.id === id && current.side === side ? current : { id, side },
        );
      },
      onDragLeave: () => {
        setDrop((current) => (current?.id === id ? null : current));
      },
      onDrop: (event: DragEvent<HTMLElement>) => {
        event.preventDefault();
        const sourceId = draggingId ?? event.dataTransfer.getData('text/plain');
        if (!sourceId || sourceId === id) return reset();
        const side = drop?.id === id ? drop.side : 'before';
        const index = ids.indexOf(id);
        const targetId = side === 'before' ? id : (ids[index + 1] ?? null);
        onMove(sourceId, targetId === sourceId ? null : targetId);
        reset();
      },
      className:
        (draggingId === id ? ' row--dragging' : '') +
        (drop?.id === id ? (drop.side === 'before' ? ' row--drop-before' : ' row--drop-after') : ''),
    }),
    [draggingId, drop, ids, onMove, reset],
  );

  /** Alt+Arrow moves the focused row without a mouse. */
  const moveByKeyboard = useCallback(
    (id: string, direction: -1 | 1) => {
      const index = ids.indexOf(id);
      if (index < 0) return;
      const next = index + direction;
      if (next < 0 || next >= ids.length) return;
      const targetId = direction === -1 ? ids[next] : (ids[next + 1] ?? null);
      onMove(id, targetId);
    },
    [ids, onMove],
  );

  return { getItemProps, moveByKeyboard, draggingId };
}
