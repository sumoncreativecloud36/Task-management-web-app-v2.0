import { useEffect, useMemo, useRef, useState } from 'react';
import { useActions } from '../lib/actions';
import { taskCounts, visibleMains, visibleSubs } from '../lib/selectors';
import { useData } from '../lib/store';
import { useUi } from '../lib/ui';
import type { MainCategory, Subcategory } from '../lib/types';
import { Empty } from './Empty';
import { InlineAdd } from './InlineAdd';
import { Menu } from './Menu';
import { useDragList } from './dragList';

const ICON_CHOICES = ['💼', '🎨', '📚', '👤', '💰', '🏠', '🎯', '⚡', '🧠', '🩺', '✈️', '📁'];

// Palette a main category can be tinted with. First entry matches the app's
// default green so existing categories look unchanged.
const COLOR_CHOICES: { name: string; value: string }[] = [
  { name: 'Green', value: '#2a835f' },
  { name: 'Teal', value: '#12544f' },
  { name: 'Sky', value: '#3b82f6' },
  { name: 'Violet', value: '#7c5cff' },
  { name: 'Amber', value: '#d98a3d' },
  { name: 'Rose', value: '#d9566f' },
];

interface Renaming {
  kind: 'main' | 'sub';
  id: string;
}

/**
 * The merged first column: every main category is always shown as a bold, boxed
 * header with its subcategories nested beneath it. Selecting a main or a sub
 * drives the Category and Tasks columns to its right.
 */
export function CategoryTree({ mobileActive }: { mobileActive: boolean }) {
  const { data, dispatch } = useData();
  const { remove, rename, move } = useActions();
  const { selection, selectMain, selectSub } = useUi();

  const mains = useMemo(() => visibleMains(data), [data]);
  const counts = useMemo(() => taskCounts(data), [data]);
  const subsByMain = useMemo(() => {
    const map = new Map<string, Subcategory[]>();
    for (const main of mains) map.set(main.id, visibleSubs(data, main.id));
    return map;
  }, [data, mains]);

  const mainIds = useMemo(() => mains.map((m) => m.id), [mains]);
  const mainDrag = useDragList(mainIds, (id, targetId) => move('main', id, targetId));

  const [renaming, setRenaming] = useState<Renaming | null>(null);

  return (
    <section className="column" data-active={mobileActive ? 'true' : 'false'} aria-label="Categories">
      <header className="column__head">
        <h2 className="column__title">Categories</h2>
        <span className="column__count">{mains.length || ''}</span>
      </header>

      <div className="column__body scroll">
        {mains.length === 0 ? (
          <Empty icon="folder" text="No main categories yet. Add one below to get started." />
        ) : (
          <ul className="tree">
            {mains.map((main) => (
              <MainNode
                key={main.id}
                main={main}
                subs={subsByMain.get(main.id) ?? []}
                subCount={counts.perMain.get(main.id) ?? 0}
                countsPerSub={counts.perSub}
                selectedMainId={selection.mainId}
                selectedSubId={selection.subId}
                onSelectMain={selectMain}
                onSelectSub={selectSub}
                onAddSub={(name) => dispatch({ type: 'addSub', mainCategoryId: main.id, name })}
                onRename={rename}
                onRemove={remove}
                onMoveMain={(dir) => mainDrag.moveByKeyboard(main.id, dir)}
                onMoveSub={(id, targetId) => move('sub', id, targetId)}
                onChangeIcon={() => {
                  const next =
                    ICON_CHOICES[(ICON_CHOICES.indexOf(main.icon) + 1) % ICON_CHOICES.length];
                  dispatch({ type: 'update', kind: 'main', id: main.id, patch: { icon: next } });
                }}
                onSetColor={(color) =>
                  dispatch({ type: 'update', kind: 'main', id: main.id, patch: { color } })
                }
                renaming={renaming}
                setRenaming={setRenaming}
                mainDragProps={mainDrag.getItemProps(main.id)}
              />
            ))}
          </ul>
        )}
      </div>

      <div className="column__foot">
        <InlineAdd
          label="Add Main Category"
          placeholder="Enter main category name…"
          onSubmit={(name) => dispatch({ type: 'addMain', name })}
        />
      </div>
    </section>
  );
}

interface MainNodeProps {
  main: MainCategory;
  subs: Subcategory[];
  subCount: number;
  countsPerSub: Map<string, number>;
  selectedMainId: string | null;
  selectedSubId: string | null;
  onSelectMain: (id: string) => void;
  onSelectSub: (id: string) => void;
  onAddSub: (name: string) => void;
  onRename: (kind: 'main' | 'sub', id: string, name: string) => void;
  onRemove: (kind: 'main' | 'sub', id: string, name: string) => void;
  onMoveMain: (dir: -1 | 1) => void;
  onMoveSub: (id: string, targetId: string | null) => void;
  onChangeIcon: () => void;
  onSetColor: (color: string) => void;
  renaming: Renaming | null;
  setRenaming: (value: Renaming | null) => void;
  mainDragProps: Record<string, unknown> & { className?: string };
}

function MainNode({
  main,
  subs,
  subCount,
  countsPerSub,
  selectedMainId,
  selectedSubId,
  onSelectMain,
  onSelectSub,
  onAddSub,
  onRename,
  onRemove,
  onMoveMain,
  onMoveSub,
  onChangeIcon,
  onSetColor,
  renaming,
  setRenaming,
  mainDragProps,
}: MainNodeProps) {
  const subIds = useMemo(() => subs.map((s) => s.id), [subs]);
  const subDrag = useDragList(subIds, onMoveSub);
  const renameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renaming) renameRef.current?.select();
  }, [renaming]);

  const mainSelected = main.id === selectedMainId;

  const renameForm = (kind: 'main' | 'sub', id: string, current: string) => (
    <form
      className="inline-form"
      style={{ padding: '2px 0' }}
      onSubmit={(event) => {
        event.preventDefault();
        const value = renameRef.current?.value.trim();
        if (value) onRename(kind, id, value);
        setRenaming(null);
      }}
    >
      <input
        ref={renameRef}
        className="input"
        style={{ height: 26, fontSize: 12.5 }}
        defaultValue={current}
        onBlur={(event) => {
          const value = event.target.value.trim();
          if (value) onRename(kind, id, value);
          setRenaming(null);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            setRenaming(null);
          }
        }}
        aria-label={`Rename ${current}`}
      />
    </form>
  );

  return (
    <li className="tree__group">
      {renaming?.kind === 'main' && renaming.id === main.id ? (
        renameForm('main', main.id, main.name)
      ) : (
        <div
          {...mainDragProps}
          role="option"
          aria-selected={mainSelected}
          tabIndex={0}
          className={`tree__main drag-handle${mainDragProps.className ?? ''}`}
          style={mainSelected ? { background: main.color, borderColor: main.color } : undefined}
          onClick={() => onSelectMain(main.id)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onSelectMain(main.id);
            } else if (event.key === 'F2') {
              event.preventDefault();
              setRenaming({ kind: 'main', id: main.id });
            } else if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
              event.preventDefault();
              onMoveMain(event.key === 'ArrowUp' ? -1 : 1);
            }
          }}
        >
          <span className="tree__icon" aria-hidden="true">
            {main.icon}
          </span>
          <span className="tree__name">{main.name}</span>
          <span className="tree__count">{subCount || ''}</span>
          <span className="row__more">
            <Menu
              label={`Actions for ${main.name}`}
              items={[
                { label: 'Rename', icon: 'edit', hint: 'F2', onSelect: () => setRenaming({ kind: 'main', id: main.id }) },
                { label: 'Change icon', icon: 'tag', onSelect: onChangeIcon },
                ...COLOR_CHOICES.map((c) => ({
                  label: c.name,
                  swatch: c.value,
                  onSelect: () => onSetColor(c.value),
                })),
                { label: 'Move up', icon: 'left', hint: 'Alt ↑', onSelect: () => onMoveMain(-1) },
                { label: 'Move down', icon: 'right', hint: 'Alt ↓', onSelect: () => onMoveMain(1) },
                { label: 'Delete', icon: 'trash', danger: true, onSelect: () => onRemove('main', main.id, main.name) },
              ]}
            />
          </span>
        </div>
      )}

      <ul className="tree__subs">
        {subs.map((sub) =>
          renaming?.kind === 'sub' && renaming.id === sub.id ? (
            <li key={sub.id}>{renameForm('sub', sub.id, sub.name)}</li>
          ) : (
            <li key={sub.id}>
              {(() => {
                const dragProps = subDrag.getItemProps(sub.id);
                const selected = sub.id === selectedSubId && mainSelected;
                return (
                  <div
                    {...dragProps}
                    role="option"
                    aria-selected={selected}
                    tabIndex={-1}
                    className={`tree__sub drag-handle${dragProps.className ?? ''}`}
                    onClick={() => onSelectSub(sub.id)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onSelectSub(sub.id);
                      } else if (event.key === 'F2') {
                        event.preventDefault();
                        setRenaming({ kind: 'sub', id: sub.id });
                      } else if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
                        event.preventDefault();
                        subDrag.moveByKeyboard(sub.id, event.key === 'ArrowUp' ? -1 : 1);
                      }
                    }}
                  >
                    <span className="tree__sub-name">{sub.name}</span>
                    <span className="row__count">{countsPerSub.get(sub.id) || ''}</span>
                    <span className="row__more">
                      <Menu
                        label={`Actions for ${sub.name}`}
                        items={[
                          { label: 'Rename', icon: 'edit', hint: 'F2', onSelect: () => setRenaming({ kind: 'sub', id: sub.id }) },
                          { label: 'Move up', icon: 'left', hint: 'Alt ↑', onSelect: () => subDrag.moveByKeyboard(sub.id, -1) },
                          { label: 'Move down', icon: 'right', hint: 'Alt ↓', onSelect: () => subDrag.moveByKeyboard(sub.id, 1) },
                          { label: 'Delete', icon: 'trash', danger: true, onSelect: () => onRemove('sub', sub.id, sub.name) },
                        ]}
                      />
                    </span>
                  </div>
                );
              })()}
            </li>
          ),
        )}

        <li className="tree__addsub">
          <InlineAdd
            label="Subcategory"
            placeholder="Subcategory name…"
            keepOpen={false}
            onSubmit={onAddSub}
          />
        </li>
      </ul>
    </li>
  );
}
