import { useState } from 'react';
import { Icon } from '../components/Icon';
import { getSupabase } from '../lib/backends/supabase';

type Mode = 'signin' | 'signup';

/** Shown only when Supabase is configured; local mode skips authentication. */
export function AuthView() {
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const supabase = await getSupabase();
      const credentials = { email: email.trim(), password };

      if (mode === 'signup') {
        const { data, error: signUpError } = await supabase.auth.signUp(credentials);

        // Email confirmation is expected to be OFF, so a fresh sign-up returns a
        // session and the user is in immediately.
        if (data.session) return;

        if (signUpError) {
          // Someone re-registering an existing address: just sign them in.
          if (/already|registered|exists/i.test(signUpError.message)) {
            const { error: signInError } = await supabase.auth.signInWithPassword(credentials);
            if (signInError) throw new Error('That email is already registered — check your password.');
            return;
          }
          throw signUpError;
        }

        // No error but also no session means "Confirm email" is still enabled on
        // the Supabase project. Try to sign in; if it is blocked, say why.
        const { error: signInError } = await supabase.auth.signInWithPassword(credentials);
        if (signInError) {
          throw new Error(
            'Account created, but this project still requires email confirmation. Turn off ' +
              '“Confirm email” in Supabase → Authentication → Sign In / Providers → Email.',
          );
        }
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword(credentials);
      if (signInError) {
        if (/confirm/i.test(signInError.message)) {
          throw new Error(
            'This project still requires email confirmation. Turn off “Confirm email” in ' +
              'Supabase → Authentication → Sign In / Providers → Email, then try again.',
          );
        }
        throw new Error('Wrong email or password.');
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth">
      <form className="auth__card" onSubmit={submit}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <span className="brand__mark">
            <Icon name="logo" size={15} strokeWidth={2} />
          </span>
          <h1 className="auth__title">Task Manager</h1>
        </div>

        <p className="auth__note">
          {mode === 'signin'
            ? 'Sign in to load your categories, tasks and weekly history.'
            : 'Create an account with just an email and password — no confirmation email. Your data is your own, isolated by row-level security so nobody else can read it.'}
        </p>

        <div className="field">
          <label className="field__label" htmlFor="auth-email">
            Email
          </label>
          <input
            id="auth-email"
            className="input"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>

        <div className="field">
          <label className="field__label" htmlFor="auth-password">
            Password
          </label>
          <input
            id="auth-password"
            className="input"
            type="password"
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            required
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>

        {error && <p className="auth__error">{error}</p>}
        {notice && <p className="auth__ok">{notice}</p>}

        <button type="submit" className="btn btn--primary btn--block" disabled={busy}>
          {busy ? 'Working…' : mode === 'signin' ? 'Sign in' : 'Create account'}
        </button>

        <button
          type="button"
          className="btn btn--quiet btn--sm"
          onClick={() => {
            setMode(mode === 'signin' ? 'signup' : 'signin');
            setError(null);
            setNotice(null);
          }}
        >
          {mode === 'signin' ? 'Need an account? Sign up' : 'Already have an account? Sign in'}
        </button>
      </form>
    </div>
  );
}
