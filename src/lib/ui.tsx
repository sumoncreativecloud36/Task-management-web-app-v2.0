import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { addDays, startOfWeek, today } from './date';
import { useData } from './store';
import { visibleCategories, visibleMains, visibleSubs } from './selectors';
import type { ViewName } from './types';

export type Theme = 'light' | 'dark';

export interface Selection {
  mainId: string | null;
  subId: string | null;
  categoryId: string | null;
}

interface UiContextValue {
  view: ViewName;
  setView: (view: ViewName) => void;
  theme: Theme;
  toggleTheme: () => void;
  selection: Selection;
  selectMain: (id: string | null) => void;
  selectSub: (id: string | null) => void;
  selectCategory: (id: string | null) => void;
  /** Jumps the four columns straight to a task's own branch. */
  revealCategory: (mainId: string, subId: string, categoryId: string) => void;
  weekCursor: Date;
  goPrevWeek: () => void;
  goNextWeek: () => void;
  goThisWeek: () => void;
  setWeekCursor: (date: Date) => void;
  /** Which of the four columns is on screen in the mobile flow. */
  mobileColumn: number;
  setMobileColumn: (index: number) => void;
  searchOpen: boolean;
  setSearchOpen: (open: boolean) => void;
}

const UiContext = createContext<UiContextValue | null>(null);

export function useUi(): UiContextValue {
  const context = useContext(UiContext);
  if (!context) throw new Error('useUi must be used inside <UiProvider>');
  return context;
}

const VIEW_KEY = 'taskmanager.view';
const THEME_KEY = 'taskmanager.theme';

function initialTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    /* storage blocked — fall through to the default */
  }
  // The app was designed dark-first, so that stays the default.
  return 'dark';
}

export function UiProvider({ children }: { children: ReactNode }) {
  const { data, ready } = useData();
  const [view, setViewState] = useState<ViewName>(
    () => (localStorage.getItem(VIEW_KEY) as ViewName | null) ?? 'tasks',
  );
  const [theme, setTheme] = useState<Theme>(initialTheme);

  // Drive the palette from a data-theme attribute on the root element.
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'));
  }, []);
  const [selection, setSelection] = useState<Selection>({
    mainId: null,
    subId: null,
    categoryId: null,
  });
  const [weekCursor, setWeekCursorState] = useState<Date>(() => startOfWeek(today()));
  const [mobileColumn, setMobileColumn] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);

  const setView = useCallback((next: ViewName) => {
    setViewState(next);
    localStorage.setItem(VIEW_KEY, next);
  }, []);

  // Keep the selection valid: pick the first row of each column, and drop
  // selections whose row was deleted or whose parent changed.
  useEffect(() => {
    if (!ready) return;
    setSelection((current) => {
      const mains = visibleMains(data);
      const mainId = mains.some((m) => m.id === current.mainId)
        ? current.mainId
        : (mains[0]?.id ?? null);

      const subs = visibleSubs(data, mainId);
      const subId = subs.some((s) => s.id === current.subId)
        ? current.subId
        : (subs[0]?.id ?? null);

      const categories = visibleCategories(data, subId);
      const categoryId = categories.some((c) => c.id === current.categoryId)
        ? current.categoryId
        : (categories[0]?.id ?? null);

      if (
        mainId === current.mainId &&
        subId === current.subId &&
        categoryId === current.categoryId
      ) {
        return current;
      }
      return { mainId, subId, categoryId };
    });
  }, [data, ready]);

  // Mobile columns after the tree merge: 0 = Main+Sub tree, 1 = Category,
  // 2 = Tasks. Tapping a main keeps you in the tree (its subs are already
  // shown); tapping a sub advances to Category, a category to Tasks.
  const selectMain = useCallback(
    (id: string | null) => {
      const subs = visibleSubs(data, id);
      const subId = subs[0]?.id ?? null;
      const categoryId = visibleCategories(data, subId)[0]?.id ?? null;
      setSelection({ mainId: id, subId, categoryId });
      setMobileColumn(0);
    },
    [data],
  );

  const selectSub = useCallback(
    (id: string | null) => {
      const categoryId = visibleCategories(data, id)[0]?.id ?? null;
      setSelection((current) => ({ ...current, subId: id, categoryId }));
      setMobileColumn(1);
    },
    [data],
  );

  const selectCategory = useCallback((id: string | null) => {
    setSelection((current) => ({ ...current, categoryId: id }));
    setMobileColumn(2);
  }, []);

  const revealCategory = useCallback(
    (mainId: string, subId: string, categoryId: string) => {
      setSelection({ mainId, subId, categoryId });
      setView('tasks');
      setMobileColumn(2);
      setSearchOpen(false);
    },
    [setView],
  );

  const setWeekCursor = useCallback((date: Date) => setWeekCursorState(startOfWeek(date)), []);
  const goPrevWeek = useCallback(
    () => setWeekCursorState((current) => addDays(current, -7)),
    [],
  );
  const goNextWeek = useCallback(() => setWeekCursorState((current) => addDays(current, 7)), []);
  const goThisWeek = useCallback(() => setWeekCursorState(startOfWeek(today())), []);

  const value = useMemo<UiContextValue>(
    () => ({
      view,
      setView,
      theme,
      toggleTheme,
      selection,
      selectMain,
      selectSub,
      selectCategory,
      revealCategory,
      weekCursor,
      goPrevWeek,
      goNextWeek,
      goThisWeek,
      setWeekCursor,
      mobileColumn,
      setMobileColumn,
      searchOpen,
      setSearchOpen,
    }),
    [
      view,
      setView,
      theme,
      toggleTheme,
      selection,
      selectMain,
      selectSub,
      selectCategory,
      revealCategory,
      weekCursor,
      goPrevWeek,
      goNextWeek,
      goThisWeek,
      setWeekCursor,
      mobileColumn,
      searchOpen,
    ],
  );

  return <UiContext.Provider value={value}>{children}</UiContext.Provider>;
}
