import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Empty } from '../components/Empty';
import { Icon } from '../components/Icon';
import { Menu } from '../components/Menu';
import { RichEditor } from '../components/RichEditor';
import { isRemoteMode } from '../lib/backends/config';
import { notesSyncReady } from '../lib/backends/supabase';
import { formatRelative } from '../lib/date';
import { uid } from '../lib/id';
import { htmlToText } from '../lib/richText';
import { useActions } from '../lib/actions';
import { noteFamily } from '../lib/reducer';
import { useData } from '../lib/store';
import type { Note } from '../lib/types';

const OPEN_KEY = 'taskmanager.openNote';
const FOLDED_KEY = 'taskmanager.foldedNotes';
const SIDE_KEY = 'taskmanager.notesSideHidden';

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function save(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

function readFolded(): Set<string> {
  try {
    return new Set(JSON.parse(read(FOLDED_KEY) ?? '[]') as string[]);
  } catch {
    return new Set();
  }
}

const sortNotes = (a: Note, b: Note) =>
  Number(b.pinned) - Number(a.pinned) || (a.updatedAt < b.updatedAt ? 1 : -1);

/** Documents: a searchable outline of notes and sub-notes on the left, a full page editor on the right. */
export function NotesView() {
  const { data, dispatch } = useData();
  const { notify } = useActions();
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(() => read(OPEN_KEY));
  // Phones show either the list or the page.
  const [mobilePage, setMobilePage] = useState(false);
  const [folded, setFolded] = useState(readFolded);
  const [sideHidden, setSideHidden] = useState(() => read(SIDE_KEY) === '1');

  const notes = useMemo(() => data.notes.slice().sort(sortNotes), [data.notes]);

  // Sub-notes grouped under their parent; a note whose parent is gone shows at the top level.
  const children = useMemo(() => {
    const ids = new Set(notes.map((n) => n.id));
    const map = new Map<string | null, Note[]>();
    for (const n of notes) {
      const parent = n.parentId && ids.has(n.parentId) ? n.parentId : null;
      map.set(parent, [...(map.get(parent) ?? []), n]);
    }
    return map;
  }, [notes]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return notes.filter(
      (n) => n.title.toLowerCase().includes(q) || htmlToText(n.content).toLowerCase().includes(q),
    );
  }, [notes, query]);

  const open = notes.find((n) => n.id === openId) ?? notes[0] ?? null;

  const select = useCallback((id: string | null) => {
    setOpenId(id);
    setMobilePage(Boolean(id));
    if (id) save(OPEN_KEY, id);
  }, []);

  const setFold = (id: string, fold: boolean) =>
    setFolded((prev) => {
      const next = new Set(prev);
      if (fold) next.add(id);
      else next.delete(id);
      save(FOLDED_KEY, JSON.stringify([...next]));
      return next;
    });

  const toggleSide = () =>
    setSideHidden((hidden) => {
      save(SIDE_KEY, hidden ? '0' : '1');
      return !hidden;
    });

  const create = (parentId: string | null = null) => {
    const id = uid();
    dispatch({ type: 'addNote', id, parentId });
    if (parentId) setFold(parentId, false);
    setQuery('');
    select(id);
  };

  const remove = (note: Note) => {
    const family = noteFamily(data.notes, note.id);
    const removed = data.notes.filter((n) => family.has(n.id));
    const subs = removed.length - 1;
    dispatch({ type: 'deleteNote', id: note.id });
    notify(
      `Deleted “${note.title || 'Untitled'}”${subs ? ` and ${subs} sub-note${subs === 1 ? '' : 's'}` : ''}`,
      { label: 'Undo', run: () => dispatch({ type: 'restoreNotes', notes: removed }) },
    );
    setMobilePage(false);
  };

  const renderTree = (parentId: string | null, depth: number) =>
    (children.get(parentId) ?? []).map((note) => {
      const kids = children.get(note.id);
      const isFolded = folded.has(note.id);
      return (
        <li key={note.id}>
          <NoteRow
            note={note}
            depth={depth}
            current={open?.id === note.id}
            hasKids={Boolean(kids)}
            folded={isFolded}
            onSelect={() => select(note.id)}
            onToggle={() => setFold(note.id, !isFolded)}
            onAddSub={() => create(note.id)}
          />
          {kids && !isFolded && <ul className="note-tree">{renderTree(note.id, depth + 1)}</ul>}
        </li>
      );
    });

  const localOnly = isRemoteMode && !notesSyncReady();

  return (
    <div className="notes" data-page={mobilePage ? 'true' : 'false'} data-side={sideHidden ? 'hidden' : 'shown'}>
      <aside className="notes__side">
        <div className="notes__side-head">
          <h1 className="notes__heading">Notes</h1>
          <button type="button" className="btn btn--primary btn--sm" onClick={() => create()}>
            <Icon name="plus" size={14} strokeWidth={2.4} />
            New note
          </button>
          <button
            type="button"
            className="icon-btn notes__side-toggle"
            aria-label="Close sidebar"
            title="Close sidebar"
            onClick={toggleSide}
          >
            <Icon name="sidebarClose" size={18} />
          </button>
        </div>
        <label className="notes__search">
          <Icon name="search" size={15} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search notes"
            aria-label="Search notes"
          />
        </label>

        <ul className="notes__list scroll">
          {matches
            ? matches.map((note) => (
                <li key={note.id}>
                  <NoteRow
                    note={note}
                    depth={0}
                    current={open?.id === note.id}
                    onSelect={() => select(note.id)}
                    onAddSub={() => create(note.id)}
                  />
                </li>
              ))
            : renderTree(null, 0)}
          {notes.length === 0 && (
            <li>
              <Empty icon="notes" text="No notes yet. Tap “New note” to start writing." />
            </li>
          )}
          {matches && notes.length > 0 && matches.length === 0 && (
            <li>
              <Empty icon="search" text={`No notes match “${query}”.`} />
            </li>
          )}
        </ul>

        {localOnly && (
          <p className="notes__warn">
            <Icon name="alert" size={13} />
            Notes are saved on this device only until the notes table is added in Supabase.
          </p>
        )}
      </aside>

      <section className="notes__main scroll">
        {open ? (
          <NotePage
            key={open.id}
            note={open}
            sideHidden={sideHidden}
            onShowSide={toggleSide}
            onBack={() => setMobilePage(false)}
            onAddSub={() => create(open.id)}
            onDelete={() => remove(open)}
          />
        ) : (
          <Empty
            icon="notes"
            text="Write anything — plans, ideas, meeting notes, journals. Headings, lists and checklists included."
            actionLabel="Create your first note"
            onAction={() => create()}
            pad
          />
        )}
      </section>
    </div>
  );
}

/** One line in the sidebar: fold arrow, title, and a quick “add sub-note” button. */
function NoteRow({
  note,
  depth,
  current,
  hasKids = false,
  folded = false,
  onSelect,
  onToggle,
  onAddSub,
}: {
  note: Note;
  depth: number;
  current: boolean;
  hasKids?: boolean;
  folded?: boolean;
  onSelect: () => void;
  onToggle?: () => void;
  onAddSub: () => void;
}) {
  const title = note.title || 'Untitled';
  return (
    <div
      className="note-item"
      aria-current={current ? 'true' : undefined}
      style={{ ['--depth' as string]: depth }}
    >
      {hasKids && onToggle ? (
        <button
          type="button"
          className="note-item__fold"
          aria-expanded={!folded}
          aria-label={folded ? `Expand ${title}` : `Collapse ${title}`}
          onClick={onToggle}
        >
          <Icon name={folded ? 'right' : 'down'} size={14} strokeWidth={2.2} />
        </button>
      ) : (
        <span className="note-item__fold" aria-hidden="true" />
      )}
      <button type="button" className="note-item__title" onClick={onSelect} title={title}>
        {note.pinned && <Icon name="pin" size={12} />}
        <span>{title}</span>
      </button>
      <button
        type="button"
        className="note-item__add"
        aria-label={`Add sub-note to ${title}`}
        title="Add sub-note"
        onClick={onAddSub}
      >
        <Icon name="plus" size={14} strokeWidth={2.2} />
      </button>
    </div>
  );
}

function NotePage({
  note,
  sideHidden,
  onShowSide,
  onBack,
  onAddSub,
  onDelete,
}: {
  note: Note;
  sideHidden: boolean;
  onShowSide: () => void;
  onBack: () => void;
  onAddSub: () => void;
  onDelete: () => void;
}) {
  const { dispatch } = useData();
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const pending = useRef<{ title?: string; content?: string }>({});
  const timer = useRef<number | null>(null);

  // Typing is saved in small batches rather than on every keystroke.
  const flush = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
    const patch = pending.current;
    pending.current = {};
    if (Object.keys(patch).length) dispatch({ type: 'updateNote', id: note.id, patch });
  }, [dispatch, note.id]);

  const queue = (patch: { title?: string; content?: string }) => {
    pending.current = { ...pending.current, ...patch };
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(flush, 500);
  };

  useEffect(() => flush, [flush]);

  const words = useMemo(() => {
    const text = htmlToText(content).trim();
    return text ? text.split(/\s+/).length : 0;
  }, [content]);

  return (
    <article className="note-page">
      <div className="note-page__bar">
        {sideHidden && (
          <button
            type="button"
            className="icon-btn note-page__show-side"
            aria-label="Open sidebar"
            title="Open sidebar"
            onClick={onShowSide}
          >
            <Icon name="sidebarOpen" size={18} />
          </button>
        )}
        <button type="button" className="btn btn--quiet btn--sm note-page__back" onClick={onBack}>
          <Icon name="left" size={14} />
          Notes
        </button>
        <span className="note-page__meta">
          Edited {formatRelative(note.updatedAt)} · {words} word{words === 1 ? '' : 's'}
        </span>
        <button
          type="button"
          className="icon-btn"
          aria-pressed={note.pinned}
          aria-label={note.pinned ? 'Unpin note' : 'Pin note'}
          title={note.pinned ? 'Unpin' : 'Pin to top'}
          onClick={() => dispatch({ type: 'updateNote', id: note.id, patch: { pinned: !note.pinned } })}
        >
          <Icon name="pin" size={16} />
        </button>
        <Menu
          label="Note actions"
          className="icon-btn"
          items={[
            { label: 'Add sub-note', icon: 'plus', onSelect: onAddSub },
            { label: note.pinned ? 'Unpin' : 'Pin to top', icon: 'pin', onSelect: () => dispatch({ type: 'updateNote', id: note.id, patch: { pinned: !note.pinned } }) },
            { label: 'Delete note', icon: 'trash', danger: true, onSelect: onDelete },
          ]}
        >
          <Icon name="more" size={16} strokeWidth={2.4} />
        </Menu>
      </div>

      <div className="note-page__paper">
        <input
          className="note-page__title"
          value={title}
          placeholder="Untitled"
          aria-label="Note title"
          onChange={(event) => {
            setTitle(event.target.value);
            queue({ title: event.target.value });
          }}
          onBlur={flush}
          autoFocus={!note.title && !note.content}
        />
        <RichEditor
          value={content}
          onChange={(html) => {
            setContent(html);
            queue({ content: html });
          }}
          ariaLabel="Note"
          placeholder="Start writing… Type # for a heading, - for a list, [] for a checklist."
          className="note-page__editor"
        />
      </div>
    </article>
  );
}
