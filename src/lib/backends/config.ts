// Supabase connection.
//
// Environment variables take precedence (set VITE_SUPABASE_URL and
// VITE_SUPABASE_ANON_KEY to point at a different project). When they are not
// present — e.g. a Vercel deploy where the env vars weren't added — the app
// falls back to the constants below so it still runs in cloud mode and shows
// the login screen.
//
// These two values are safe to ship in the browser: the URL is public, and the
// publishable (anon) key grants nothing on its own because every table is
// guarded by row-level security. Never put the service_role/secret key here.
const FALLBACK_URL = 'https://xbtgmhnqsjnogaxhwoog.supabase.co';
const FALLBACK_ANON_KEY = 'sb_publishable_ds7Y-OH7OGIgk02uAsnzCQ_Oi4-rlSl';

const url = (import.meta.env.VITE_SUPABASE_URL ?? '').trim() || FALLBACK_URL;
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim() || FALLBACK_ANON_KEY;

export const supabaseConfig = url && anonKey ? { url, anonKey } : null;
export const isRemoteMode = supabaseConfig !== null;
