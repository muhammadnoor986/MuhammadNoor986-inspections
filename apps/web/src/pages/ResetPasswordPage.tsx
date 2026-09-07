import { type FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ErrorMessage } from '../components/ErrorMessage';
import { LoadingScreen } from '../components/LoadingScreen';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../services/supabaseClient';

function messageFor(err: unknown): string {
  // Never surface raw Supabase error internals — a short message is enough
  // for every realistic failure here (expired/invalid reset link, a
  // password rejected by the project's own password policy, or a network
  // issue).
  if (err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string') {
    return (err as { message: string }).message;
  }
  return 'Could not reset your password. Please try again.';
}

/**
 * Best-effort, one-time check for whether this page was reached via a
 * Supabase password-recovery link — those redirect back here with
 * `type=recovery` in the URL hash or query string.
 *
 * As with AcceptInvitePage, this is not how the session itself gets
 * established (supabase-js's detectSessionInUrl already did that before
 * this component ever renders) — it only distinguishes "this authenticated
 * session came from a fresh recovery link" from "the visitor was already
 * signed in and just navigated here", so an already-authenticated user
 * can't have their password silently changed by landing on this URL.
 */
function hadRecoveryMarkerInUrl(): boolean {
  if (typeof window === 'undefined') return false;
  const marker = /type=recovery/;
  return marker.test(window.location.hash) || marker.test(window.location.search);
}

export function ResetPasswordPage() {
  const { status } = useAuth();
  const navigate = useNavigate();
  const [hadMarker] = useState(hadRecoveryMarkerInUrl);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (status === 'loading') {
    return <LoadingScreen label="Verifying your reset link…" />;
  }

  if (status === 'unauthenticated') {
    return (
      <section>
        <h1>Reset link not found</h1>
        <p>This password reset link is invalid or has expired. Request a new one from the login page.</p>
        <Link to="/login">Go to Login</Link>
      </section>
    );
  }

  // status === 'authenticated' from here — but that alone doesn't mean
  // "fresh recovery link": someone already signed in could land on this URL
  // too. Never touch their password in that case.
  if (!hadMarker) {
    return (
      <section>
        <h1>You&apos;re already signed in</h1>
        <p>This link is for resetting a password. You&apos;re already signed in to your account.</p>
        <Link to="/">Go to the app</Link>
      </section>
    );
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setServerError(null);

    if (!password) {
      setFieldError('Password is required.');
      return;
    }
    if (!confirmPassword) {
      setFieldError('Please confirm your password.');
      return;
    }
    if (password !== confirmPassword) {
      setFieldError('Passwords do not match.');
      return;
    }
    setFieldError(null);
    setSubmitting(true);

    try {
      // The only Supabase call this page makes — the official
      // password-recovery mechanism. No custom backend, no token/password
      // storage in our own database.
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      navigate('/', { replace: true });
    } catch (err) {
      setServerError(messageFor(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="login-form" onSubmit={(event) => void handleSubmit(event)}>
      <h1>Reset your password</h1>
      <p>Choose a new password for your account.</p>

      <label>
        New password
        <input
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      <label>
        Confirm new password
        <input
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
        />
      </label>

      {fieldError && <p className="form-error">{fieldError}</p>}
      {serverError && <ErrorMessage title="Could not reset your password" message={serverError} />}

      <button type="submit" disabled={submitting}>
        {submitting ? 'Resetting password…' : 'Reset password'}
      </button>
    </form>
  );
}
