import { type FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ErrorMessage } from '../components/ErrorMessage';
import { LoadingScreen } from '../components/LoadingScreen';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../services/supabaseClient';

function messageFor(err: unknown): string {
  // Never surface raw Supabase error internals (status codes, stack-ish
  // detail) — a short message is enough for every realistic failure here
  // (expired/invalid invitation session, a password rejected by the
  // project's own password policy, or a network issue).
  if (err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string') {
    return (err as { message: string }).message;
  }
  return 'Could not set your password. Please try again.';
}

/**
 * Best-effort, one-time check for whether this page was reached via a
 * Supabase invite/recovery link — those redirect back here with
 * `type=invite` (or `type=recovery`) in the URL hash or query string.
 *
 * This is *not* how the session itself gets established — that's entirely
 * automatic: the app's single Supabase client (services/supabaseClient.ts)
 * has detectSessionInUrl on (the library default, confirmed against the
 * installed @supabase/supabase-js — nothing here overrides it), so by the
 * time this component ever renders, supabase-js has already parsed the
 * tokens from the URL, established the session, stripped the tokens back
 * out of the address bar, and notified the existing AuthContext via its
 * onAuthStateChange subscription — the same path every other session
 * change already goes through. No token parsing happens here.
 *
 * This marker exists purely to answer a different question: distinguish
 * "this authenticated session is a fresh invite" from "the visitor was
 * already signed in and just navigated here" (see the component below) —
 * it never gates whether the invite flow itself works. Because supabase-js
 * begins consuming the URL as soon as its module loads (before this
 * component mounts), a slow first render could in principle lose the race
 * and find the marker already gone — so its absence is not proof this
 * isn't a fresh invite, only its presence is a reliable positive signal.
 */
function hadInviteOrRecoveryMarkerInUrl(): boolean {
  if (typeof window === 'undefined') return false;
  const marker = /type=(invite|recovery)/;
  return marker.test(window.location.hash) || marker.test(window.location.search);
}

export function AcceptInvitePage() {
  const { status } = useAuth();
  const navigate = useNavigate();
  const [hadMarker] = useState(hadInviteOrRecoveryMarkerInUrl);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Mirrors ProtectedRoute: don't show anything conclusive until the
  // existing AuthContext has finished resolving the session one way or
  // the other.
  if (status === 'loading') {
    return <LoadingScreen label="Verifying your invitation…" />;
  }

  if (status === 'unauthenticated') {
    return (
      <section>
        <h1>Invitation not found</h1>
        <p>This invitation link is invalid or has expired.</p>
        <Link to="/login">Go to Login</Link>
      </section>
    );
  }

  // status === 'authenticated' from here — but that alone doesn't mean
  // "fresh invite": someone already signed in could land on this URL too.
  // Never touch their password in that case.
  if (!hadMarker) {
    return (
      <section>
        <h1>You&apos;re already signed in</h1>
        <p>This link is for accepting a new invitation. You&apos;re already signed in to your account.</p>
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
      // The only Supabase call this page makes. No signUp(), no admin API,
      // no backend request — the invited user's auth account and profile
      // already exist (created by inviteUserByEmail + handle_new_user() +
      // the User Management API's provisioning step). This only sets the
      // password on the session already established above.
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      // The session is unchanged by updateUser (still authenticated), and
      // AuthContext already has the profile loaded from when the invite
      // session was first established — ProtectedRoute/RoleRoute take over
      // from here using that existing state, no role/destination assumed.
      navigate('/', { replace: true });
    } catch (err) {
      setServerError(messageFor(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="login-form" onSubmit={(event) => void handleSubmit(event)}>
      <h1>Set your password</h1>
      <p>You&apos;ve been invited to the Inspection Platform. Choose a password to finish setting up your account.</p>

      <label>
        Password
        <input
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      <label>
        Confirm password
        <input
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
        />
      </label>

      {fieldError && <p className="form-error">{fieldError}</p>}
      {serverError && <ErrorMessage title="Could not set your password" message={serverError} />}

      <button type="submit" disabled={submitting}>
        {submitting ? 'Setting password…' : 'Set password'}
      </button>
    </form>
  );
}
