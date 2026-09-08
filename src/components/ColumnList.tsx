import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Menu, type MenuItem } from './Menu';
import { Empty } from './Empty';
import { InlineAdd } from './InlineAdd';
import { useDragList } from './dragList';

export interface ColumnItem {
  id: string;
  name: string;
  icon?: string;
  count?: number;
}

interface ColumnListProps {
  title: string;
  items: ColumnItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, targetId: string | null) => void;
  addLabel: string;
  addPlaceholder: string;
  emptyText: string;
  /** Extra per-row menu entries (icon picker for main categories, say). */
  extraMenuItems?: (item: ColumnItem) => MenuItem[];
  /** Rendered before the list, e.g. a filter box. */
  disabled?: boolean;
  disabledText?: string;
  footer?: ReactNode;
  mobileActive?: boolean;
}

export function ColumnList({
  title,
  items,
  selectedId,
  onSelect,
  onAdd,
  onRename,
  onDelete,
  onMove,
  addLabel,
  addPlaceholder,
  emptyText,
  extraMenuItems,
  disabled,
  disabledText,
  footer,
  mobileActive,
}: ColumnListProps) {
  const [filter, setFilter] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const listRef = useRef<HTMLUListElement>(null);
  const renameRef = useRef<HTMLInputElement>(null);

  const ids = useMemo(() => items.map((item) => item.id), [items]);
  const { getItemProps, moveByKeyboard } = useDragList(ids, onMove);

  const shown = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((item) => item.name.toLowerCase().includes(needle));
  }, [items, filter]);

  useEffect(() => {
    if (renamingId) renameRef.current?.select();
  }, [renamingId]);

  const startRename = (item: ColumnItem) => {
    setRenamingId(item.id);
    setRenameValue(item.name);
  };

  const commitRename = () => {
    if (renamingId && renameValue.trim()) onRename(renamingId, renameValue.trim());
    setRenamingId(null);
  };

  /** Up/Down walks the column; Alt+Up/Down reorders. */
  const onListKeyDown = (event: React.KeyboardEvent<HTMLUListElement>, id: string) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const direction = event.key === 'ArrowDown' ? 1 : -1;
    if (event.altKey) {
      moveByKeyboard(id, direction as -1 | 1);
      return;
    }
    const index = shown.findIndex((item) => item.id === id);
    const next = shown[index + direction];
    if (!next) return;
    onSelect(next.id);
    const node = listRef.current?.querySelector<HTMLElement>(`[data-row-id="${next.id}"]`);
    node?.focus();
  };

  return (
    <section className="column" data-active={mobileActive ? 'true' : 'false'} aria-label={title}>
      <header className="column__head">
        <h2 className="column__title">{title}</h2>
        <span className="column__count">{items.length || ''}</span>
      </header>

      {items.length > 6 && !disabled && (
        <div className="column__filter">
          <input
            className="input"
            style={{ height: 26, fontSize: 12.5 }}
            placeholder={`Filter ${title.toLowerCase()}…`}
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            aria-label={`Filter ${title.toLowerCase()}`}
          />
        </div>
      )}

      <div className="column__body scroll">
        {disabled ? (
          <Empty icon="folder" text={disabledText ?? 'Select an item on the left.'} />
        ) : items.length === 0 ? (
          <Empty icon="folder" text={emptyText} />
        ) : shown.length === 0 ? (
          <Empty icon="search" text={`Nothing matches “${filter}”.`} />
        ) : (
          <ul ref={listRef}>
            {shown.map((item) => {
              const dragProps = getItemProps(item.id);
              const selected = item.id === selectedId;

              if (renamingId === item.id) {
                return (
                  <li key={item.id}>
                    <form
                      className="inline-form"
                      style={{ padding: '2px 0' }}
                      onSubmit={(event) => {
                        event.preventDefault();
                        commitRename();
                      }}
                    >
                      <input
                        ref={renameRef}
                        className="input"
                        style={{ height: 26, fontSize: 12.5 }}
                        value={renameValue}
                        onChange={(event) => setRenameValue(event.target.value)}
                        onBlur={commitRename}
                        onKeyDown={(event) => {
                          if (event.key === 'Escape') {
                            event.preventDefault();
                            setRenamingId(null);
                          }
                        }}
                        aria-label={`Rename ${item.name}`}
                      />
                    </form>
                  </li>
                );
              }

              return (
                <li key={item.id}>
                  <div
                    {...dragProps}
                    data-row-id={item.id}
                    role="option"
                    tabIndex={selected ? 0 : -1}
                    aria-selected={selected}
                    className={`row drag-handle${dragProps.className}`}
                    onClick={() => onSelect(item.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onSelect(item.id);
                        return;
                      }
                      if (event.key === 'F2') {
                        event.preventDefault();
                        startRename(item);
                        return;
                      }
                      onListKeyDown(event as unknown as React.KeyboardEvent<HTMLUListElement>, item.id);
                    }}
                  >
                    {item.icon ? (
                      <span className="row__icon" aria-hidden="true">
                        {selected ? '●' : item.icon}
                      </span>
                    ) : selected ? (
                      <span className="row__bullet" aria-hidden="true" />
                    ) : null}

                    <span className="row__name">{item.name}</span>
                    {item.count !== undefined && <span className="row__count">{item.count}</span>}

                    <span className="row__more">
                      <Menu
                        label={`Actions for ${item.name}`}
                        items={[
                          { label: 'Rename', icon: 'edit', hint: 'F2', onSelect: () => startRename(item) },
                          ...(extraMenuItems?.(item) ?? []),
                          {
                            label: 'Move up',
                            icon: 'left',
                            hint: 'Alt ↑',
                            onSelect: () => moveByKeyboard(item.id, -1),
                          },
                          {
                            label: 'Move down',
                            icon: 'right',
                            hint: 'Alt ↓',
                            onSelect: () => moveByKeyboard(item.id, 1),
                          },
                          {
                            label: 'Delete',
                            icon: 'trash',
                            danger: true,
                            onSelect: () => onDelete(item.id),
                          },
                        ]}
                      />
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {!disabled && (
        <div className="column__foot">
          <InlineAdd label={addLabel} placeholder={addPlaceholder} onSubmit={onAdd} />
          {footer}
        </div>
      )}
    </section>
  );
}
