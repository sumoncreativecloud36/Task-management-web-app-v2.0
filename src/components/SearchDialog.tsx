import { useEffect, useMemo, useRef, useState } from 'react';
import { KIND_LABEL, searchAll, type SearchHit } from '../lib/search';
import { useData } from '../lib/store';
import { useUi } from '../lib/ui';
import type { EntityKind } from '../lib/types';
import { Icon, type IconName } from './Icon';
import { Modal } from './Modal';

const ICONS: Record<EntityKind, IconName> = {
  main: 'folder',
  sub: 'folder',
  category: 'inbox',
  task: 'check',
};

const ORDER: EntityKind[] = ['main', 'sub', 'category', 'task'];

/** Highlights the matched run so the reason for a hit is obvious. */
function Highlight({ text, query }: { text: string; query: string }) {
  const needle = query.trim().toLowerCase();
  const index = needle ? text.toLowerCase().indexOf(needle) : -1;
  if (index < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, index)}
      <mark>{text.slice(index, index + needle.length)}</mark>
      {text.slice(index + needle.length)}
    </>
  );
}

export function SearchDialog() {
  const { data } = useData();
  const { searchOpen, setSearchOpen, revealCategory, setView } = useUi();
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  // Debounced so typing stays smooth on large datasets.
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query), 110);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!searchOpen) {
      setQuery('');
      setDebounced('');
      setActive(0);
    }
  }, [searchOpen]);

  const hits = useMemo(() => searchAll(data, debounced), [data, debounced]);

  const grouped = useMemo(() => {
    const map = new Map<EntityKind, SearchHit[]>();
    for (const hit of hits) {
      const list = map.get(hit.kind) ?? [];
      list.push(hit);
      map.set(hit.kind, list);
    }
    return ORDER.filter((kind) => map.has(kind)).map((kind) => ({
      kind,
      items: map.get(kind)!,
    }));
  }, [hits]);

  const flat = useMemo(() => grouped.flatMap((group) => group.items), [grouped]);

  useEffect(() => setActive(0), [debounced]);

  const open = (hit: SearchHit) => {
    revealCategory(hit.mainId, hit.subId ?? '', hit.categoryId ?? '');
    setView('tasks');
    setSearchOpen(false);
  };

  if (!searchOpen) return null;

  return (
    <Modal title="Search everything" onClose={() => setSearchOpen(false)}>
      <div
        className="inline-form"
        style={{ borderBottom: '1px solid var(--border)', paddingBottom: 8, marginTop: -4 }}
      >
        <Icon name="search" size={16} />
        <input
          className="input search-input"
          placeholder="Search categories and tasks…"
          value={query}
          autoFocus
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setActive((index) => Math.min(index + 1, flat.length - 1));
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setActive((index) => Math.max(index - 1, 0));
            } else if (event.key === 'Enter' && flat[active]) {
              event.preventDefault();
              open(flat[active]);
            }
          }}
          aria-label="Search categories and tasks"
          aria-controls="search-results"
        />
      </div>

      <div id="search-results" ref={listRef}>
        {!debounced.trim() ? (
          <p style={{ fontSize: 12.5, color: 'var(--text-muted)', padding: '4px 2px' }}>
            Type to search main categories, subcategories, categories and tasks. Use ↑ ↓ then Enter.
          </p>
        ) : flat.length === 0 ? (
          <p style={{ fontSize: 12.5, color: 'var(--text-muted)', padding: '4px 2px' }}>
            No matches for “{debounced}”.
          </p>
        ) : (
          grouped.map((group) => (
            <div className="result-group" key={group.kind}>
              <div className="result-group__label">{KIND_LABEL[group.kind]}</div>
              {group.items.map((hit) => {
                const index = flat.indexOf(hit);
                return (
                  <button
                    key={`${hit.kind}-${hit.id}`}
                    type="button"
                    className="result"
                    data-active={index === active}
                    onMouseEnter={() => setActive(index)}
                    onClick={() => open(hit)}
                  >
                    <Icon name={ICONS[hit.kind]} size={14} />
                    <span className="result__body">
                      <span className="result__title">
                        <Highlight text={hit.title} query={debounced} />
                      </span>
                      <span className="result__path">{hit.path}</span>
                    </span>
                    <Icon name="right" size={13} />
                  </button>
                );
              })}
            </div>
          ))
        )}
      </div>
    </Modal>
  );
}
