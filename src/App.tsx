import { useEffect } from 'react';
import { Header } from './components/Header';
import { SearchDialog } from './components/SearchDialog';
import { ToastProvider } from './components/Toast';
import { isRemoteMode } from './lib/backends/config';
import { DataProvider, useAuth, useData } from './lib/store';
import { UiProvider, useUi } from './lib/ui';
import { AnalyticsView } from './views/AnalyticsView';
import { AuthView } from './views/AuthView';
import { CalendarView } from './views/CalendarView';
import { DashboardView } from './views/DashboardView';
import { RecycleBinView } from './views/RecycleBinView';
import { SettingsView } from './views/SettingsView';
import { TasksView } from './views/TasksView';
import { TodayView } from './views/TodayView';
import { WeekView } from './views/WeekView';
import type { ViewName } from './lib/types';

const SHORTCUT_VIEWS: ViewName[] = ['dashboard', 'tasks', 'today', 'week', 'calendar', 'analytics'];

function isTypingTarget(target: EventTarget | null): boolean {
  const node = target as HTMLElement | null;
  if (!node) return false;
  return (
    node.tagName === 'INPUT' ||
    node.tagName === 'TEXTAREA' ||
    node.tagName === 'SELECT' ||
    node.isContentEditable
  );
}

function Workspace() {
  const { view, setView, setSearchOpen } = useUi();
  const { data, ready } = useData();

  // Density and motion are applied on the root so CSS tokens can react to them.
  useEffect(() => {
    document.documentElement.dataset.density = data.settings.density;
    document.documentElement.dataset.reducedMotion = String(data.settings.reducedMotion);
  }, [data.settings.density, data.settings.reducedMotion]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setSearchOpen(true);
        return;
      }
      if (isTypingTarget(event.target) || event.metaKey || event.ctrlKey || event.altKey) return;
      const index = Number(event.key);
      if (index >= 1 && index <= SHORTCUT_VIEWS.length) {
        setView(SHORTCUT_VIEWS[index - 1]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setSearchOpen, setView]);

  if (!ready) {
    return (
      <div className="app">
        <Header />
        <main className="main">
          <div className="empty empty--pad">
            <p className="empty__text">Loading your workspace…</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="app">
      <Header />
      <main className="main">
        {view === 'dashboard' && <DashboardView />}
        {view === 'tasks' && <TasksView />}
        {view === 'today' && <TodayView />}
        {view === 'week' && <WeekView />}
        {view === 'calendar' && <CalendarView />}
        {view === 'analytics' && <AnalyticsView />}
        {view === 'recycle' && <RecycleBinView />}
        {view === 'settings' && <SettingsView />}
      </main>
      <SearchDialog />
    </div>
  );
}

export function App() {
  const auth = useAuth();

  if (isRemoteMode && auth.status === 'loading') {
    return (
      <div className="auth">
        <p className="auth__note">Connecting…</p>
      </div>
    );
  }

  if (isRemoteMode && auth.status === 'signed-out') {
    return <AuthView />;
  }

  return (
    <ToastProvider>
      <DataProvider userId={auth.userId} userEmail={auth.email} onSignOut={auth.signOut}>
        <UiProvider>
          <Workspace />
        </UiProvider>
      </DataProvider>
    </ToastProvider>
  );
}
