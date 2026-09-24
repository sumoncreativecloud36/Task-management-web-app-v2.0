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
import { useData } from '../lib/store';
import type { Note } from '../lib/types';

const OPEN_KEY = 'taskmanager.openNote';

function readOpen(): string | null {
  try {
    return localStorage.getItem(OPEN_KEY);
  } catch {
    return null;
  }
}

const sortNotes = (a: Note, b: Note) =>
  Number(b.pinned) - Number(a.pinned) || (a.updatedAt < b.updatedAt ? 1 : -1);

/** Documents: a searchable list on the left, a full page editor on the right. */
export function NotesView() {
  const { data, dispatch } = useData();
  const { notify } = useActions();
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(readOpen);
  // Phones show either the list or the page.
  const [mobilePage, setMobilePage] = useState(false);

  const notes = useMemo(() => data.notes.slice().sort(sortNotes), [data.notes]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter(
      (n) => n.title.toLowerCase().includes(q) || htmlToText(n.content).toLowerCase().includes(q),
    );
  }, [notes, query]);

  const open = notes.find((n) => n.id === openId) ?? notes[0] ?? null;

  const select = useCallback((id: string | null) => {
    setOpenId(id);
    setMobilePage(Boolean(id));
    try {
      if (id) localStorage.setItem(OPEN_KEY, id);
    } catch {
      /* ignore */
    }
  }, []);

  const create = () => {
    const id = uid();
    dispatch({ type: 'addNote', id });
    setQuery('');
    select(id);
  };

  const remove = (note: Note) => {
    dispatch({ type: 'deleteNote', id: note.id });
    notify(`Deleted “${note.title || 'Untitled'}”`, {
      label: 'Undo',
      run: () => dispatch({ type: 'restoreNote', note }),
    });
    setMobilePage(false);
  };

  const localOnly = isRemoteMode && !notesSyncReady();

  return (
    <div className="notes" data-page={mobilePage ? 'true' : 'false'}>
      <aside className="notes__side">
        <div className="notes__side-head">
          <h1 className="notes__heading">Notes</h1>
          <button type="button" className="btn btn--primary btn--sm" onClick={create}>
            <Icon name="plus" size={14} strokeWidth={2.4} />
            New note
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
          {filtered.map((note) => {
            const preview = htmlToText(note.content).replace(/\s+/g, ' ').slice(0, 90);
            return (
              <li key={note.id}>
                <button
                  type="button"
                  className="note-item"
                  aria-current={open?.id === note.id ? 'true' : undefined}
                  onClick={() => select(note.id)}
                >
                  <span className="note-item__title">
                    {note.pinned && <Icon name="pin" size={12} />}
                    {note.title || 'Untitled'}
                  </span>
                  <span className="note-item__preview">{preview || 'No content yet'}</span>
                  <span className="note-item__time">{formatRelative(note.updatedAt)}</span>
                </button>
              </li>
            );
          })}
          {notes.length === 0 && (
            <li>
              <Empty icon="notes" text="No notes yet. Tap “New note” to start writing." />
            </li>
          )}
          {notes.length > 0 && filtered.length === 0 && (
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
          <NotePage key={open.id} note={open} onBack={() => setMobilePage(false)} onDelete={() => remove(open)} />
        ) : (
          <Empty
            icon="notes"
            text="Write anything — plans, ideas, meeting notes, journals. Headings, lists and checklists included."
            actionLabel="Create your first note"
            onAction={create}
            pad
          />
        )}
      </section>
    </div>
  );
}

function NotePage({ note, onBack, onDelete }: { note: Note; onBack: () => void; onDelete: () => void }) {
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
