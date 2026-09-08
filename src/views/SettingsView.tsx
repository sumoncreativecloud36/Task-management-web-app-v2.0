import { useRef, useState } from 'react';
import { Icon } from '../components/Icon';
import { Modal } from '../components/Modal';
import { useToast } from '../components/Toast';
import { isRemoteMode } from '../lib/backends/config';
import { migrate } from '../lib/reducer';
import { useData } from '../lib/store';
import { allActiveTasks } from '../lib/selectors';

/* Each colour has exactly one job — see the header of styles/global.css. */
const PALETTE = [
  { hex: '#092328', role: 'Ground' },
  { hex: '#12544F', role: 'Brand · selection' },
  { hex: '#2A835F', role: 'Completion' },
  { hex: '#8BBB92', role: 'Accent · today' },
  { hex: '#F5F7F4', role: 'Text' },
];

function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  hint: string;
}) {
  return (
    <label className="switch" style={{ justifyContent: 'space-between', width: '100%' }}>
      <span>
        <span style={{ display: 'block', fontSize: 13 }}>{label}</span>
        <span style={{ display: 'block', fontSize: 12, color: 'var(--text-muted)' }}>{hint}</span>
      </span>
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="switch__track">
        <span className="switch__thumb" />
      </span>
    </label>
  );
}

export function SettingsView() {
  const { data, dispatch, sync, syncError, userEmail, signOut, loadSample, clearAll, importData } =
    useData();
  const { notify } = useToast();
  const [confirmClear, setConfirmClear] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const settings = data.settings;
  const taskCount = allActiveTasks(data).length;
  const tickCount = data.completions.filter((c) => c.completed).length;

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `task-manager-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    notify('Exported your data as JSON');
  };

  const importJson = async (file: File) => {
    try {
      const parsed = JSON.parse(await file.text());
      importData(migrate(parsed));
      notify('Data imported');
    } catch {
      notify('That file could not be read as Task Manager JSON');
    }
  };

  return (
    <div className="view view--pad scroll">
      <div className="view-head">
        <div>
          <h1 className="view-title">Settings</h1>
          <p className="view-sub">Preferences, storage and your data.</p>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card__head">
            <h2 className="card__title">Interface</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Toggle
              label="Show the weekly grid on task rows"
              hint="Saturday to Friday checkboxes inline in the Tasks column."
              checked={settings.showWeekGrid}
              onChange={(value) => dispatch({ type: 'setSettings', patch: { showWeekGrid: value } })}
            />
            <Toggle
              label="Hide tasks completed for the week"
              hint="Rows whose scheduled days are all ticked drop out of the list."
              checked={settings.hideCompleted}
              onChange={(value) => dispatch({ type: 'setSettings', patch: { hideCompleted: value } })}
            />
            <Toggle
              label="Reduce motion"
              hint="Turns off transitions and the completion animation."
              checked={settings.reducedMotion}
              onChange={(value) => dispatch({ type: 'setSettings', patch: { reducedMotion: value } })}
            />
            <div className="field">
              <label className="field__label" htmlFor="density">
                Row density
              </label>
              <select
                id="density"
                className="select"
                value={settings.density}
                onChange={(event) =>
                  dispatch({
                    type: 'setSettings',
                    patch: { density: event.target.value as 'compact' | 'comfortable' },
                  })
                }
              >
                <option value="compact">Compact — more rows on screen</option>
                <option value="comfortable">Comfortable — roomier rows</option>
              </select>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card__head">
            <h2 className="card__title">Storage</h2>
            <span className={sync === 'error' ? 'chip chip--danger' : 'chip chip--accent'}>
              {sync === 'local' ? 'This browser' : sync === 'syncing' ? 'Syncing' : sync === 'error' ? 'Error' : 'Synced'}
            </span>
          </div>
          <p style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.55 }}>
            {isRemoteMode ? (
              <>
                Signed in as <strong style={{ color: 'var(--text)' }}>{userEmail}</strong>. Your rows
                live in Supabase Postgres, isolated by row-level security, and are cached locally so
                the app stays usable offline.
              </>
            ) : (
              <>
                Running in local mode: everything is stored in this browser only. Set
                <code style={{ fontFamily: 'var(--mono)', fontSize: 12 }}> VITE_SUPABASE_URL </code>
                and
                <code style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>
                  {' '}
                  VITE_SUPABASE_ANON_KEY{' '}
                </code>
                to sync to Postgres with per-user row-level security instead.
              </>
            )}
          </p>
          {syncError && <p className="auth__error">{syncError}</p>}

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
            <button type="button" className="btn btn--ghost btn--sm" onClick={exportJson}>
              <Icon name="download" size={13} /> Export JSON
            </button>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => fileRef.current?.click()}
            >
              <Icon name="upload" size={13} /> Import JSON
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void importJson(file);
                event.target.value = '';
              }}
            />
            {userEmail && (
              <button type="button" className="btn btn--ghost btn--sm" onClick={() => void signOut()}>
                <Icon name="logout" size={13} /> Sign out
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card__head">
            <h2 className="card__title">Your data</h2>
          </div>
          <div className="stat-grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
            <div>
              <div className="card__label">Tasks</div>
              <div className="card__value" style={{ fontSize: 20 }}>
                {taskCount}
              </div>
            </div>
            <div>
              <div className="card__label">Completed days</div>
              <div className="card__value" style={{ fontSize: 20 }}>
                {tickCount}
              </div>
            </div>
            <div>
              <div className="card__label">Categories</div>
              <div className="card__value" style={{ fontSize: 20 }}>
                {data.categories.filter((c) => !c.deletedAt).length}
              </div>
            </div>
            <div>
              <div className="card__label">In the bin</div>
              <div className="card__value" style={{ fontSize: 20 }}>
                {
                  [...data.mainCategories, ...data.subcategories, ...data.categories, ...data.tasks].filter(
                    (r) => r.deletedAt,
                  ).length
                }
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12 }}>
            <button type="button" className="btn btn--ghost btn--sm" onClick={loadSample}>
              <Icon name="restore" size={13} /> Load sample data
            </button>
            <button
              type="button"
              className="btn btn--danger btn--sm"
              onClick={() => setConfirmClear(true)}
            >
              <Icon name="trash" size={13} /> Delete everything
            </button>
          </div>
        </div>

        <div className="card">
          <div className="card__head">
            <h2 className="card__title">Keyboard</h2>
          </div>
          <ul style={{ display: 'grid', gap: 6, fontSize: 12.5, color: 'var(--text-dim)' }}>
            {[
              ['Ctrl / ⌘ + K', 'Open search'],
              ['Enter', 'Create the task or category being typed'],
              ['Escape', 'Cancel editing, close dialogs'],
              ['Space', 'Toggle the focused day checkbox'],
              ['↑ ↓', 'Move between rows in a column'],
              ['Alt + ↑ ↓', 'Reorder the focused row'],
              ['F2', 'Rename the focused category'],
              ['1 – 6', 'Jump to Dashboard … Analytics'],
            ].map(([keys, what]) => (
              <li
                key={keys}
                style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}
              >
                <span style={{ color: 'var(--text)' }}>{what}</span>
                <kbd
                  style={{
                    fontFamily: 'var(--font)',
                    fontSize: 11,
                    border: '1px solid var(--border)',
                    borderRadius: 4,
                    padding: '0 5px',
                    color: 'var(--text-muted)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {keys}
                </kbd>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="card">
        <div className="card__head">
          <h2 className="card__title">Palette</h2>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {PALETTE.map((entry) => (
            <div key={entry.hex} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 7,
                  background: entry.hex,
                  border: '1px solid var(--border-strong)',
                }}
              />
              <span style={{ fontSize: 12 }}>
                <span style={{ display: 'block' }}>{entry.role}</span>
                <span style={{ color: 'var(--text-faint)', fontFamily: 'var(--mono)', fontSize: 11 }}>
                  {entry.hex}
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>

      {confirmClear && (
        <Modal
          title="Delete everything?"
          onClose={() => setConfirmClear(false)}
          footer={
            <>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => setConfirmClear(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn--danger btn--sm"
                onClick={() => {
                  clearAll();
                  setConfirmClear(false);
                  notify('All data deleted');
                }}
              >
                Delete all data
              </button>
            </>
          }
        >
          <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>
            Every category, task and completion record is removed, including the history in the
            Recycle Bin. Export a JSON backup first if you might want it back.
          </p>
        </Modal>
      )}
    </div>
  );
}
