import { useMemo } from 'react';
import { formatShortDate, fromKey, today } from '../lib/date';
import {
  completionMap,
  overdueTasks,
  pathForTask,
  statsForDate,
} from '../lib/selectors';
import { useData } from '../lib/store';
import { useUi } from '../lib/ui';
import type { ViewName } from '../lib/types';
import { Icon, type IconName } from './Icon';
import { Menu, type MenuItem } from './Menu';

/** The four everyday screens; the rest live under "More". */
export const NAV: { view: ViewName; label: string; icon: IconName }[] = [
  { view: 'today', label: 'Today', icon: 'today' },
  { view: 'tasks', label: 'Lists', icon: 'tasks' },
  { view: 'calendar', label: 'Calendar', icon: 'calendar' },
  { view: 'dashboard', label: 'Insights', icon: 'dashboard' },
];

const MORE: { view: ViewName; label: string; icon: IconName }[] = [
  { view: 'week', label: 'Week sheet', icon: 'week' },
  { view: 'analytics', label: 'Analytics', icon: 'analytics' },
];

export function Header() {
  const { data, sync, syncError, userEmail, signOut } = useData();
  const { view, setView, setSearchOpen, revealCategory, theme, toggleTheme, openQuickAdd } = useUi();

  const map = useMemo(() => completionMap(data), [data]);
  const overdue = useMemo(() => overdueTasks(data, map), [data, map]);
  const todayStats = useMemo(() => statsForDate(data, map, today()), [data, map]);
  const binCount =
    data.mainCategories.filter((r) => r.deletedAt).length +
    data.subcategories.filter((r) => r.deletedAt).length +
    data.categories.filter((r) => r.deletedAt).length +
    data.tasks.filter((r) => r.deletedAt).length;

  const notifications: MenuItem[] = useMemo(() => {
    const items: MenuItem[] = [];
    if (todayStats.remaining > 0) {
      items.push({
        label: `${todayStats.remaining} task${todayStats.remaining === 1 ? '' : 's'} left today`,
        icon: 'today',
        onSelect: () => setView('today'),
      });
    }
    for (const task of overdue.slice(0, 6)) {
      const { main, sub, category } = pathForTask(data, task);
      items.push({
        label: `Overdue: ${task.title}`,
        icon: 'alert',
        hint: task.dueDate ? formatShortDate(fromKey(task.dueDate)) : undefined,
        onSelect: () => {
          if (main && sub && category) revealCategory(main.id, sub.id, category.id);
        },
      });
    }
    if (!items.length) {
      items.push({ label: 'Nothing needs attention', icon: 'check', onSelect: () => setView('today') });
    }
    return items;
  }, [overdue, todayStats.remaining, data, setView, revealCategory]);

  const syncLabel =
    sync === 'local'
      ? 'Saved in this browser'
      : sync === 'syncing'
        ? 'Syncing…'
        : sync === 'error'
          ? `Sync error: ${syncError ?? 'unknown'}`
          : 'Synced';

  const moreItems: MenuItem[] = MORE.map((item) => ({
    label: item.label,
    icon: item.icon,
    onSelect: () => setView(item.view),
  }));

  const profileItems: MenuItem[] = [
    { label: userEmail ?? 'Local profile', icon: 'cloud', onSelect: () => setView('settings') },
    // On phones the header nav is replaced by the bottom bar, so the extra
    // screens are reachable from here.
    ...moreItems,
    { label: syncLabel, icon: sync === 'error' ? 'alert' : 'check', onSelect: () => setView('settings') },
    { label: 'Settings', icon: 'settings', onSelect: () => setView('settings') },
    {
      label: `Recycle Bin${binCount ? ` (${binCount})` : ''}`,
      icon: 'trash',
      onSelect: () => setView('recycle'),
    },
    ...(userEmail
      ? [{ label: 'Sign out', icon: 'logout' as IconName, danger: true, onSelect: () => void signOut() }]
      : []),
  ];

  return (
    <header className="header">
      <div className="brand">
        <span className="brand__mark">
          <Icon name="logo" size={15} strokeWidth={2} />
        </span>
        <span className="brand__name">Task Manager</span>
      </div>

      <nav className="nav" aria-label="Main">
        {NAV.map((item) => (
          <button
            key={item.view}
            type="button"
            className="nav__item"
            aria-current={view === item.view ? 'page' : undefined}
            onClick={() => setView(item.view)}
          >
            <Icon name={item.icon} size={14} />
            {item.label}
          </button>
        ))}
        <Menu
          label="More screens"
          items={moreItems}
          className={`nav__item${MORE.some((m) => m.view === view) ? ' nav__item--on' : ''}`}
        >
          <>
            {MORE.find((m) => m.view === view)?.label ?? 'More'}
            <Icon name="down" size={12} />
          </>
        </Menu>
      </nav>

      <div className="header__right">
        <button type="button" className="btn btn--primary header-add" onClick={() => openQuickAdd()}>
          <Icon name="plus" size={14} strokeWidth={2.4} />
          New task
          <kbd>N</kbd>
        </button>

        <button
          type="button"
          className="search-trigger"
          onClick={() => setSearchOpen(true)}
          aria-label="Search (Ctrl+K)"
        >
          <Icon name="search" size={14} />
          <span>Search…</span>
          <kbd>Ctrl K</kbd>
        </button>

        <button
          type="button"
          className="icon-btn"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
        >
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={16} />
        </button>

        <Menu label="Notifications" items={notifications} className="icon-btn">
          <>
            <Icon name="bell" size={16} />
            {(overdue.length > 0 || todayStats.remaining > 0) && <span className="dot-badge" />}
          </>
        </Menu>

        <Menu label="Profile and settings" items={profileItems} className="avatar">
          <>{(userEmail ?? 'me').slice(0, 2)}</>
        </Menu>
      </div>
    </header>
  );
}

/** Phone navigation: four tabs around a central "add" button. */
export function BottomNav() {
  const { view, setView, openQuickAdd } = useUi();
  const [left, right] = [NAV.slice(0, 2), NAV.slice(2)];
  const tab = (item: (typeof NAV)[number]) => (
    <button
      key={item.view}
      type="button"
      className="bottom-nav__tab"
      aria-current={view === item.view ? 'page' : undefined}
      onClick={() => setView(item.view)}
    >
      <Icon name={item.icon} size={20} />
      <span>{item.label}</span>
    </button>
  );
  return (
    <nav className="bottom-nav" aria-label="Main">
      {left.map(tab)}
      <button type="button" className="bottom-nav__add" onClick={() => openQuickAdd()} aria-label="Add a task">
        <Icon name="plus" size={24} strokeWidth={2.4} />
      </button>
      {right.map(tab)}
    </nav>
  );
}
