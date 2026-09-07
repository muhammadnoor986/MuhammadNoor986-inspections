import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginPage } from '../src/pages/LoginPage';

const loginMock = vi.fn();
const resetPasswordForEmailMock = vi.fn();

vi.mock('../src/services/supabaseClient', () => ({
  supabase: {
    auth: {
      resetPasswordForEmail: (...args: unknown[]) => resetPasswordForEmailMock(...args),
    },
  },
}));

const useAuthMock = vi.fn();
vi.mock('../src/hooks/useAuth', () => ({ useAuth: () => useAuthMock() }));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <LoginPage />
    </MemoryRouter>
  );
}

beforeEach(() => {
  loginMock.mockReset();
  resetPasswordForEmailMock.mockReset();
  useAuthMock.mockReturnValue({ status: 'unauthenticated', login: loginMock });
});

describe('LoginPage — normal sign-in (unchanged)', () => {
  it('still renders the sign-in form with email/password and a "Forgot password?" link', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /sign in/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/^email$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^sign in$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /forgot password/i })).toBeInTheDocument();
  });

  it('still calls login() with email/password on submit', async () => {
    loginMock.mockResolvedValue(undefined);
    renderPage();
    fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: 'user@test.dev' } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'hunter2' } });
    fireEvent.click(screen.getByRole('button', { name: /^sign in$/i }));
    await waitFor(() => expect(loginMock).toHaveBeenCalledWith('user@test.dev', 'hunter2'));
  });
});

describe('LoginPage — Forgot password flow', () => {
  it('shows the reset-request form when "Forgot password?" is clicked', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /forgot password/i }));
    expect(screen.getByRole('heading', { name: /reset your password/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/^email$/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send reset link/i })).toBeInTheDocument();
  });

  it('calls supabase.auth.resetPasswordForEmail with the entered email and a redirectTo pointing at /reset-password', async () => {
    resetPasswordForEmailMock.mockResolvedValue({ data: {}, error: null });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /forgot password/i }));
    fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: 'someone@test.dev' } });
    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }));

    await waitFor(() => expect(resetPasswordForEmailMock).toHaveBeenCalledTimes(1));
    const [emailArg, optionsArg] = resetPasswordForEmailMock.mock.calls[0];
    expect(emailArg).toBe('someone@test.dev');
    expect(optionsArg.redirectTo).toMatch(/\/reset-password$/);
  });

  it('shows the same generic confirmation message on success', async () => {
    resetPasswordForEmailMock.mockResolvedValue({ data: {}, error: null });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /forgot password/i }));
    fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: 'real-user@test.dev' } });
    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }));

    expect(await screen.findByText(/we've sent a link to reset your password/i)).toBeInTheDocument();
  });

  it('shows the exact same generic confirmation message even when Supabase reports an error (never reveals whether the email exists)', async () => {
    resetPasswordForEmailMock.mockResolvedValue({
      data: null,
      error: { message: 'User not found', status: 400 },
    });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /forgot password/i }));
    fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: 'unknown@test.dev' } });
    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }));

    expect(await screen.findByText(/we've sent a link to reset your password/i)).toBeInTheDocument();
    expect(screen.queryByText(/user not found/i)).not.toBeInTheDocument();
  });

  it('shows the same generic confirmation message even when the request throws/rejects', async () => {
    resetPasswordForEmailMock.mockRejectedValue(new Error('network exploded'));
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /forgot password/i }));
    fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: 'someone@test.dev' } });
    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }));

    expect(await screen.findByText(/we've sent a link to reset your password/i)).toBeInTheDocument();
    expect(screen.queryByText(/network exploded/i)).not.toBeInTheDocument();
  });

  it('disables the submit button while the request is in flight', async () => {
    let resolveReset: (value: { data: object; error: null }) => void = () => {};
    resetPasswordForEmailMock.mockReturnValue(new Promise((resolve) => (resolveReset = resolve)));
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /forgot password/i }));
    fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: 'someone@test.dev' } });
    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }));

    expect(await screen.findByRole('button', { name: /sending/i })).toBeDisabled();
    resolveReset({ data: {}, error: null });
  });

  it('lets the user go back to the sign-in form', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /forgot password/i }));
    fireEvent.click(screen.getByRole('button', { name: /back to sign in/i }));
    expect(screen.getByRole('heading', { name: /^sign in$/i })).toBeInTheDocument();
  });

  it('never calls login() as part of the forgot-password flow', async () => {
    resetPasswordForEmailMock.mockResolvedValue({ data: {}, error: null });
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /forgot password/i }));
    fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: 'someone@test.dev' } });
    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }));

    await waitFor(() => expect(resetPasswordForEmailMock).toHaveBeenCalledTimes(1));
    expect(loginMock).not.toHaveBeenCalled();
  });
});
