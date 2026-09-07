import { type FormEvent, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { supabase } from '../services/supabaseClient';

export function LoginPage() {
  const { status, login } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);

  if (status === 'authenticated') {
    const from = (location.state as { from?: { pathname: string } } | null)?.from;
    return <Navigate to={from?.pathname ?? '/'} replace />;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setSubmitting(false);
    }
  }

  if (forgotPasswordOpen) {
    return <ForgotPasswordForm onBack={() => setForgotPasswordOpen(false)} />;
  }

  return (
    <form className="login-form" onSubmit={(event) => void handleSubmit(event)}>
      <h1>Sign in</h1>
      <label>
        Email
        <input
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </label>
      <label>
        Password
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </label>
      {error && <p className="form-error">{error}</p>}
      <button type="submit" disabled={submitting}>
        {submitting ? 'Signing in…' : 'Sign in'}
      </button>
      <button type="button" className="link-button" onClick={() => setForgotPasswordOpen(true)}>
        Forgot password?
      </button>
    </form>
  );
}

/**
 * Requests a Supabase password-reset email. Deliberately shows the same
 * confirmation message whether or not the email is registered — Supabase's
 * own resetPasswordForEmail already doesn't error for an unknown address,
 * and we don't add a distinguishing message on top of that, so this can't
 * be used to enumerate which emails have accounts.
 */
function ForgotPasswordForm({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
    } catch {
      // Ignored deliberately — same outcome shown regardless of success or
      // failure, see the enumeration note above.
    } finally {
      setSubmitting(false);
      setSent(true);
    }
  }

  if (sent) {
    return (
      <section className="login-form">
        <h1>Check your email</h1>
        <p>If an account exists for that email address, we&apos;ve sent a link to reset your password.</p>
        <button type="button" onClick={onBack}>
          Back to sign in
        </button>
      </section>
    );
  }

  return (
    <form className="login-form" onSubmit={(event) => void handleSubmit(event)}>
      <h1>Reset your password</h1>
      <p>Enter your email address and we&apos;ll send you a link to reset your password.</p>
      <label>
        Email
        <input
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </label>
      <button type="submit" disabled={submitting}>
        {submitting ? 'Sending…' : 'Send reset link'}
      </button>
      <button type="button" className="link-button" onClick={onBack}>
        Back to sign in
      </button>
    </form>
  );
}
