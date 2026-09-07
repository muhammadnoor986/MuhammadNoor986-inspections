import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AcceptInvitePage } from '../src/pages/AcceptInvitePage';

const updateUserMock = vi.fn();
const signUpMock = vi.fn();
const signInWithPasswordMock = vi.fn();
const adminInviteMock = vi.fn();

vi.mock('../src/services/supabaseClient', () => ({
  supabase: {
    auth: {
      updateUser: (...args: unknown[]) => updateUserMock(...args),
      signUp: (...args: unknown[]) => signUpMock(...args),
      signInWithPassword: (...args: unknown[]) => signInWithPasswordMock(...args),
      admin: { inviteUserByEmail: (...args: unknown[]) => adminInviteMock(...args) },
    },
  },
}));

const useAuthMock = vi.fn();
vi.mock('../src/hooks/useAuth', () => ({ useAuth: () => useAuthMock() }));

function setUrlMarker(marker: string | null) {
  window.history.replaceState(null, '', marker ? `/accept-invite${marker}` : '/accept-invite');
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/accept-invite']}>
      <Routes>
        <Route path="/accept-invite" element={<AcceptInvitePage />} />
        <Route path="/" element={<div>App Home</div>} />
        <Route path="/login" element={<div>Login Page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  updateUserMock.mockReset();
  signUpMock.mockReset();
  signInWithPasswordMock.mockReset();
  adminInviteMock.mockReset();
  setUrlMarker('#access_token=fake-token&refresh_token=fake-refresh&type=invite');
});

afterEach(() => {
  setUrlMarker(null);
});

describe('AcceptInvitePage rendering', () => {
  it('shows a loading state while the session is being determined', () => {
    useAuthMock.mockReturnValue({ status: 'loading' });
    renderPage();
    expect(screen.getByText(/verifying your invitation/i)).toBeInTheDocument();
  });

  it('shows the password form once an invite session is available', () => {
    useAuthMock.mockReturnValue({ status: 'authenticated' });
    renderPage();
    expect(screen.getByRole('heading', { name: /set your password/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
  });

  it('shows an invalid/expired state with no password form when there is no session', () => {
    useAuthMock.mockReturnValue({ status: 'unauthenticated' });
    renderPage();
    expect(screen.getByText(/invitation link is invalid or has expired/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/^password$/i)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /go to login/i })).toBeInTheDocument();
  });

  it('does not show the password form for an already-authenticated visitor with no invite marker in the URL', () => {
    setUrlMarker(null);
    useAuthMock.mockReturnValue({ status: 'authenticated' });
    renderPage();
    expect(screen.getByRole('heading', { name: /already signed in/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/^password$/i)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /go to the app/i })).toBeInTheDocument();
  });

  it('shows the password form when the URL marker uses a query string instead of a hash', () => {
    setUrlMarker('?type=recovery');
    useAuthMock.mockReturnValue({ status: 'authenticated' });
    renderPage();
    expect(screen.getByRole('heading', { name: /set your password/i })).toBeInTheDocument();
  });
});

describe('AcceptInvitePage validation', () => {
  beforeEach(() => {
    useAuthMock.mockReturnValue({ status: 'authenticated' });
  });

  it('rejects an empty password', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /set password/i }));
    expect(screen.getByText('Password is required.')).toBeInTheDocument();
    expect(updateUserMock).not.toHaveBeenCalled();
  });

  it('rejects an empty confirmation', () => {
    renderPage();
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'correct-horse-1' } });
    fireEvent.click(screen.getByRole('button', { name: /set password/i }));
    expect(screen.getByText('Please confirm your password.')).toBeInTheDocument();
    expect(updateUserMock).not.toHaveBeenCalled();
  });

  it('rejects mismatched passwords', () => {
    renderPage();
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'correct-horse-1' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'different-1' } });
    fireEvent.click(screen.getByRole('button', { name: /set password/i }));
    expect(screen.getByText('Passwords do not match.')).toBeInTheDocument();
    expect(updateUserMock).not.toHaveBeenCalled();
  });

  it('accepts a valid matching password and calls updateUser', async () => {
    updateUserMock.mockResolvedValue({ data: { user: {} }, error: null });
    renderPage();
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'correct-horse-1' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'correct-horse-1' } });
    fireEvent.click(screen.getByRole('button', { name: /set password/i }));

    await waitFor(() => expect(updateUserMock).toHaveBeenCalledWith({ password: 'correct-horse-1' }));
  });
});

describe('AcceptInvitePage Supabase interaction and security', () => {
  beforeEach(() => {
    useAuthMock.mockReturnValue({ status: 'authenticated' });
  });

  it('calls only supabase.auth.updateUser — never signUp, signInWithPassword, or an admin method', async () => {
    updateUserMock.mockResolvedValue({ data: { user: {} }, error: null });
    renderPage();
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'correct-horse-1' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'correct-horse-1' } });
    fireEvent.click(screen.getByRole('button', { name: /set password/i }));

    await waitFor(() => expect(updateUserMock).toHaveBeenCalledTimes(1));
    expect(signUpMock).not.toHaveBeenCalled();
    expect(signInWithPasswordMock).not.toHaveBeenCalled();
    expect(adminInviteMock).not.toHaveBeenCalled();
  });

  it('never sends the password to the backend API', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }));
    updateUserMock.mockResolvedValue({ data: { user: {} }, error: null });
    renderPage();
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'correct-horse-1' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'correct-horse-1' } });
    fireEvent.click(screen.getByRole('button', { name: /set password/i }));

    await waitFor(() => expect(updateUserMock).toHaveBeenCalledTimes(1));
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('never renders the password value as visible text, and never puts it in the URL', async () => {
    renderPage();
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'super-secret-1' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'super-secret-1' } });

    expect(document.body.textContent).not.toContain('super-secret-1');
    expect(window.location.href).not.toContain('super-secret-1');
  });
});

describe('AcceptInvitePage success', () => {
  it('redirects to the normal authenticated entry point after a successful password update', async () => {
    useAuthMock.mockReturnValue({ status: 'authenticated' });
    updateUserMock.mockResolvedValue({ data: { user: {} }, error: null });
    renderPage();
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'correct-horse-1' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'correct-horse-1' } });
    fireEvent.click(screen.getByRole('button', { name: /set password/i }));

    expect(await screen.findByText('App Home')).toBeInTheDocument();
  });
});

describe('AcceptInvitePage failure handling', () => {
  beforeEach(() => {
    useAuthMock.mockReturnValue({ status: 'authenticated' });
  });

  it('shows a friendly message on a Supabase error, not raw internal details', async () => {
    updateUserMock.mockResolvedValue({
      data: { user: null },
      error: { message: 'Auth session missing!', status: 401, name: 'AuthSessionMissingError' },
    });
    renderPage();
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'correct-horse-1' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'correct-horse-1' } });
    fireEvent.click(screen.getByRole('button', { name: /set password/i }));

    expect(await screen.findByText('Auth session missing!')).toBeInTheDocument();
    expect(screen.queryByText('App Home')).not.toBeInTheDocument();
  });

  it('falls back to a generic message for a non-Error rejection', async () => {
    updateUserMock.mockRejectedValue('network exploded');
    renderPage();
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'correct-horse-1' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'correct-horse-1' } });
    fireEvent.click(screen.getByRole('button', { name: /set password/i }));

    expect(await screen.findByText('Could not set your password. Please try again.')).toBeInTheDocument();
  });

  it('disables the submit button while saving, preventing duplicate submissions', async () => {
    let resolveUpdate: (value: { data: { user: object }; error: null }) => void = () => {};
    updateUserMock.mockReturnValue(new Promise((resolve) => (resolveUpdate = resolve)));
    renderPage();
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'correct-horse-1' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'correct-horse-1' } });
    fireEvent.click(screen.getByRole('button', { name: /set password/i }));

    expect(await screen.findByRole('button', { name: /setting password/i })).toBeDisabled();
    expect(updateUserMock).toHaveBeenCalledTimes(1);

    resolveUpdate({ data: { user: {} }, error: null });
  });
});
