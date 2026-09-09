import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { clearLocal, loadLocal, saveLocal } from './backends/local';
import { isRemoteMode } from './backends/config';
import { getSupabase, pullAll, pushDiff } from './backends/supabase';
import { emptyData, reducer, type Action } from './reducer';
import { seedData } from './seed';
import type { AppData } from './types';

export type SyncState = 'local' | 'idle' | 'syncing' | 'error' | 'offline';

interface DataContextValue {
  data: AppData;
  dispatch: (action: Action) => void;
  ready: boolean;
  sync: SyncState;
  syncError: string | null;
  userEmail: string | null;
  signOut: () => Promise<void>;
  loadSample: () => void;
  clearAll: () => void;
  importData: (data: AppData) => void;
}

const DataContext = createContext<DataContextValue | null>(null);

export function useData(): DataContextValue {
  const context = useContext(DataContext);
  if (!context) throw new Error('useData must be used inside <DataProvider>');
  return context;
}

const FIRST_RUN_KEY = 'taskmanager.seeded.v1';

export function DataProvider({
  userId,
  userEmail,
  onSignOut,
  children,
}: {
  userId: string | null;
  userEmail: string | null;
  onSignOut: () => Promise<void>;
  children: ReactNode;
}) {
  const [data, dispatch] = useReducer(reducer, emptyData());
  const [ready, setReady] = useState(false);
  const [sync, setSync] = useState<SyncState>(isRemoteMode ? 'idle' : 'local');
  const [syncError, setSyncError] = useState<string | null>(null);

  const lastSynced = useRef<AppData>(emptyData());
  const pushTimer = useRef<number | null>(null);
  const pushing = useRef(false);

  // The background pull must finish before write-through starts, so a slow
  // network can't race an early edit into the server before we've reconciled.
  const pulled = useRef(!isRemoteMode);

  // Initial load: paint instantly from the browser's cached copy, then (in
  // cloud mode) reconcile with Supabase in the background. The user never waits
  // on the network to see and use their data.
  useEffect(() => {
    let cancelled = false;
    async function boot() {
      // 1) Instant paint from the local cache (kept in sync on every change).
      const cached = loadLocal();
      if (cached) {
        dispatch({ type: 'hydrate', data: cached });
        // Treat the cache as the sync baseline so it isn't re-pushed as a diff.
        lastSynced.current = cached;
      } else if (!isRemoteMode && !localStorage.getItem(FIRST_RUN_KEY)) {
        // A brand-new local install gets sample content, not five empty columns.
        localStorage.setItem(FIRST_RUN_KEY, '1');
        dispatch({ type: 'hydrate', data: seedData() });
      }
      if (!cancelled) setReady(true);

      // 2) Cloud mode: fetch the authoritative copy without blocking the UI.
      if (isRemoteMode && userId) {
        setSync('syncing');
        try {
          const remote = await pullAll(userId);
          if (cancelled) return;
          lastSynced.current = remote;
          dispatch({ type: 'hydrate', data: remote });
          setSync('idle');
          setSyncError(null);
        } catch (error) {
          if (cancelled) return;
          setSync('error');
          setSyncError(error instanceof Error ? error.message : 'Sync failed');
        } finally {
          pulled.current = true;
        }
      }
    }
    void boot();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Persist locally on every change; localStorage doubles as the offline cache.
  useEffect(() => {
    if (!ready) return;
    saveLocal(data);
  }, [data, ready]);

  // Debounced write-through to Supabase.
  useEffect(() => {
    if (!ready || !isRemoteMode || !userId) return;
    if (pushTimer.current) window.clearTimeout(pushTimer.current);
    pushTimer.current = window.setTimeout(() => {
      void (async () => {
        // Wait until the initial background pull has set the true baseline.
        if (pushing.current || !pulled.current) return;
        const previous = lastSynced.current;
        if (JSON.stringify(previous) === JSON.stringify(data)) return;
        pushing.current = true;
        setSync('syncing');
        try {
          await pushDiff(previous, data, userId);
          lastSynced.current = data;
          setSync('idle');
          setSyncError(null);
        } catch (error) {
          setSync('error');
          setSyncError(error instanceof Error ? error.message : 'Sync failed');
        } finally {
          pushing.current = false;
        }
      })();
    }, 600);
    return () => {
      if (pushTimer.current) window.clearTimeout(pushTimer.current);
    };
  }, [data, ready, userId]);

  const loadSample = useCallback(() => {
    dispatch({ type: 'reset', data: seedData() });
  }, []);

  const clearAll = useCallback(() => {
    dispatch({ type: 'reset' });
    clearLocal();
  }, []);

  const importData = useCallback((incoming: AppData) => {
    dispatch({ type: 'hydrate', data: incoming });
  }, []);

  const value = useMemo<DataContextValue>(
    () => ({
      data,
      dispatch,
      ready,
      sync,
      syncError,
      userEmail,
      signOut: onSignOut,
      loadSample,
      clearAll,
      importData,
    }),
    [data, ready, sync, syncError, userEmail, onSignOut, loadSample, clearAll, importData],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export interface AuthState {
  status: 'loading' | 'signed-in' | 'signed-out' | 'local';
  userId: string | null;
  email: string | null;
}

/** Supabase Auth when configured; a single implicit local user otherwise. */
export function useAuth() {
  const [state, setState] = useState<AuthState>(
    isRemoteMode
      ? { status: 'loading', userId: null, email: null }
      : { status: 'local', userId: 'local-user', email: null },
  );

  useEffect(() => {
    if (!isRemoteMode) return;
    let unsubscribe: (() => void) | undefined;
    void (async () => {
      const supabase = await getSupabase();
      const { data: session } = await supabase.auth.getSession();
      const user = session.session?.user ?? null;
      setState(
        user
          ? { status: 'signed-in', userId: user.id, email: user.email ?? null }
          : { status: 'signed-out', userId: null, email: null },
      );
      const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
        const nextUser = nextSession?.user ?? null;
        setState(
          nextUser
            ? { status: 'signed-in', userId: nextUser.id, email: nextUser.email ?? null }
            : { status: 'signed-out', userId: null, email: null },
        );
      });
      unsubscribe = () => listener.subscription.unsubscribe();
    })();
    return () => unsubscribe?.();
  }, []);

  const signOut = useCallback(async () => {
    if (!isRemoteMode) return;
    const supabase = await getSupabase();
    await supabase.auth.signOut();
  }, []);

  return { ...state, signOut };
}
