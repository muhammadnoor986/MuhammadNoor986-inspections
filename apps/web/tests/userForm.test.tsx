import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserEditPage } from '../src/features/users/pages/UserEditPage';
import { UserInvitePage } from '../src/features/users/pages/UserInvitePage';
import type { User } from '../src/features/users/types/user';
import { ApiClientError } from '../src/services/apiClient';

const inviteUserMock = vi.fn();
const getUserMock = vi.fn();
const updateUserMock = vi.fn();
vi.mock('../src/features/users/services/usersService', () => ({
  inviteUser: (...args: unknown[]) => inviteUserMock(...args),
  getUser: (...args: unknown[]) => getUserMock(...args),
  updateUser: (...args: unknown[]) => updateUserMock(...args),
}));

const listClientsMock = vi.fn();
vi.mock('../src/features/clients/services/clientsService', () => ({
  listClients: (...args: unknown[]) => listClientsMock(...args),
}));

function clientRow(id: string, name: string, isActive = true) {
  return { id, name, canAccessProjects: true, canAccessInspections: true, isActive, createdAt: '', updatedAt: '' };
}

const nonAdminUser: User = {
  id: 'user-1',
  email: 'existing@test.dev',
  fullName: 'Existing Person',
  role: 'view_only',
  clientId: 'client-a',
  provisioned: true,
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
  client: { id: 'client-a', name: 'Acme Corp', isActive: true },
};

const adminUser: User = {
  ...nonAdminUser,
  id: 'user-admin',
  role: 'admin',
  clientId: null,
  client: null,
};

beforeEach(() => {
  inviteUserMock.mockReset();
  getUserMock.mockReset();
  updateUserMock.mockReset();
  listClientsMock.mockReset();
  listClientsMock.mockResolvedValue({
    items: [clientRow('client-a', 'Acme Corp'), clientRow('client-b', 'Beta Inc')],
    meta: { page: 1, pageSize: 100, total: 2, totalPages: 1 },
  });
});

describe('UserInvitePage', () => {
  function renderInvite() {
    return render(
      <MemoryRouter initialEntries={['/users/new']}>
        <Routes>
          <Route path="/users/new" element={<UserInvitePage />} />
          <Route path="/users" element={<div>Users List Page</div>} />
        </Routes>
      </MemoryRouter>
    );
  }

  it('rejects empty email and full name without calling the API', async () => {
    renderInvite();
    await screen.findByText('Acme Corp'); // client options loaded
    fireEvent.click(screen.getByRole('button', { name: /send invite/i }));
    expect(screen.getByText(/email is required/i)).toBeInTheDocument();
    expect(screen.getByText(/full name is required/i)).toBeInTheDocument();
    expect(inviteUserMock).not.toHaveBeenCalled();
  });

  it('rejects an invalid email format', async () => {
    renderInvite();
    fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: 'not-an-email' } });
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Someone' } });
    fireEvent.click(screen.getByRole('button', { name: /send invite/i }));
    expect(screen.getByText(/valid email address/i)).toBeInTheDocument();
    expect(inviteUserMock).not.toHaveBeenCalled();
  });

  it('defaults to View Only and requires a client for it', async () => {
    renderInvite();
    fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: 'x@test.dev' } });
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Someone' } });
    fireEvent.click(screen.getByRole('button', { name: /send invite/i }));
    expect(screen.getByText(/client is required for this role/i)).toBeInTheDocument();
    expect(inviteUserMock).not.toHaveBeenCalled();
  });

  it('requires a client for upload_notes', async () => {
    renderInvite();
    fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: 'x@test.dev' } });
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Someone' } });
    fireEvent.change(screen.getByLabelText(/^role$/i), { target: { value: 'upload_notes' } });
    fireEvent.click(screen.getByRole('button', { name: /send invite/i }));
    expect(screen.getByText(/client is required for this role/i)).toBeInTheDocument();
    expect(inviteUserMock).not.toHaveBeenCalled();
  });

  it('hides the client field for admin and omits clientId from the request', async () => {
    inviteUserMock.mockResolvedValue({ ...adminUser, id: 'new-admin' });
    renderInvite();
    fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: 'admin2@test.dev' } });
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Admin Two' } });
    fireEvent.change(screen.getByLabelText(/^role$/i), { target: { value: 'admin' } });

    expect(screen.queryByLabelText(/^client$/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /send invite/i }));

    await waitFor(() =>
      expect(inviteUserMock).toHaveBeenCalledWith({
        email: 'admin2@test.dev',
        fullName: 'Admin Two',
        role: 'admin',
        clientId: undefined,
      })
    );
    const [sentBody] = inviteUserMock.mock.calls[0];
    expect(sentBody).not.toHaveProperty('isActive');
    expect(sentBody).not.toHaveProperty('provisioned');
    expect(sentBody).not.toHaveProperty('id');
  });

  it('clears a previously-selected client when switching role to Admin, and back', async () => {
    renderInvite();
    await screen.findByText('Acme Corp');

    fireEvent.change(screen.getByLabelText(/^role$/i), { target: { value: 'view_only' } });
    fireEvent.change(screen.getByLabelText(/^client$/i), { target: { value: 'client-a' } });
    expect((screen.getByLabelText(/^client$/i) as HTMLSelectElement).value).toBe('client-a');

    fireEvent.change(screen.getByLabelText(/^role$/i), { target: { value: 'admin' } });
    expect(screen.queryByLabelText(/^client$/i)).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/^role$/i), { target: { value: 'view_only' } });
    expect((screen.getByLabelText(/^client$/i) as HTMLSelectElement).value).toBe('');
  });

  it('sends the correct request body for a non-admin invite and navigates to the list on success', async () => {
    inviteUserMock.mockResolvedValue({ ...nonAdminUser, id: 'new-user' });
    renderInvite();
    await screen.findByText('Acme Corp');

    fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: 'New.User@Test.dev' } });
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'New User' } });
    fireEvent.change(screen.getByLabelText(/^role$/i), { target: { value: 'upload_notes' } });
    fireEvent.change(screen.getByLabelText(/^client$/i), { target: { value: 'client-b' } });
    fireEvent.click(screen.getByRole('button', { name: /send invite/i }));

    await waitFor(() =>
      expect(inviteUserMock).toHaveBeenCalledWith({
        email: 'New.User@Test.dev',
        fullName: 'New User',
        role: 'upload_notes',
        clientId: 'client-b',
      })
    );
    expect(await screen.findByText('Users List Page')).toBeInTheDocument();
  });

  it('shows a useful message for a duplicate (409) invite', async () => {
    inviteUserMock.mockRejectedValue(new ApiClientError(409, 'conflict', 'A user with this email already exists'));
    renderInvite();
    fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: 'dup@test.dev' } });
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Dup' } });
    fireEvent.change(screen.getByLabelText(/^role$/i), { target: { value: 'admin' } });
    fireEvent.click(screen.getByRole('button', { name: /send invite/i }));

    expect(await screen.findByText('A user with this email already exists')).toBeInTheDocument();
    expect(screen.queryByText('Users List Page')).not.toBeInTheDocument();
  });

  it('shows a generic API error and does not navigate away on other failures', async () => {
    inviteUserMock.mockRejectedValue(new ApiClientError(500, 'database_error', 'Something broke'));
    renderInvite();
    fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: 'x@test.dev' } });
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'X' } });
    fireEvent.change(screen.getByLabelText(/^role$/i), { target: { value: 'admin' } });
    fireEvent.click(screen.getByRole('button', { name: /send invite/i }));

    expect(await screen.findByText('Something broke')).toBeInTheDocument();
  });

  it('disables the submit button while saving', async () => {
    let resolveInvite: (value: User) => void = () => {};
    inviteUserMock.mockReturnValue(new Promise((resolve) => (resolveInvite = resolve)));
    renderInvite();
    fireEvent.change(screen.getByLabelText(/^email$/i), { target: { value: 'x@test.dev' } });
    fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'X' } });
    fireEvent.change(screen.getByLabelText(/^role$/i), { target: { value: 'admin' } });
    fireEvent.click(screen.getByRole('button', { name: /send invite/i }));

    expect(await screen.findByRole('button', { name: /saving/i })).toBeDisabled();
    resolveInvite({ ...adminUser, id: 'slow' });
  });
});

describe('UserEditPage', () => {
  function renderEdit(userId = 'user-1') {
    return render(
      <MemoryRouter initialEntries={[`/users/${userId}/edit`]}>
        <Routes>
          <Route path="/users/:id/edit" element={<UserEditPage />} />
          <Route path="/users" element={<div>Users List Page</div>} />
        </Routes>
      </MemoryRouter>
    );
  }

  it('loads existing values, including the correct client for a non-admin', async () => {
    getUserMock.mockResolvedValue(nonAdminUser);
    renderEdit();

    const fullNameInput = (await screen.findByLabelText(/full name/i)) as HTMLInputElement;
    expect(fullNameInput.value).toBe('Existing Person');
    // Not anchored: in edit mode the label also wraps a "cannot be
    // changed" hint, so the accessible name is "Email Email cannot be...".
    const emailInput = screen.getByLabelText(/email/i) as HTMLInputElement;
    expect(emailInput.value).toBe('existing@test.dev');
    expect(emailInput).toBeDisabled();
    const clientSelect = (await screen.findByLabelText(/^client$/i)) as HTMLSelectElement;
    expect(clientSelect.value).toBe('client-a');
  });

  it('loads an admin with no client field shown', async () => {
    getUserMock.mockResolvedValue(adminUser);
    renderEdit('user-admin');

    await screen.findByLabelText(/full name/i);
    expect(screen.queryByLabelText(/^client$/i)).not.toBeInTheDocument();
  });

  it('changing role to Admin clears the client field', async () => {
    getUserMock.mockResolvedValue(nonAdminUser);
    renderEdit();

    await screen.findByLabelText(/^client$/i);
    fireEvent.change(screen.getByLabelText(/^role$/i), { target: { value: 'admin' } });
    expect(screen.queryByLabelText(/^client$/i)).not.toBeInTheDocument();
  });

  it('requires a client when the role is non-admin', async () => {
    getUserMock.mockResolvedValue(nonAdminUser);
    renderEdit();

    const clientSelect = await screen.findByLabelText(/^client$/i);
    fireEvent.change(clientSelect, { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    expect(screen.getByText(/client is required for this role/i)).toBeInTheDocument();
    expect(updateUserMock).not.toHaveBeenCalled();
  });

  it('sends the correct update body — no email, no isActive, explicit null clientId on promotion to admin', async () => {
    getUserMock.mockResolvedValue(nonAdminUser);
    updateUserMock.mockResolvedValue({ ...nonAdminUser, role: 'admin', clientId: null, client: null });
    renderEdit();

    await screen.findByLabelText(/^client$/i);
    fireEvent.change(screen.getByLabelText(/^role$/i), { target: { value: 'admin' } });
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() =>
      expect(updateUserMock).toHaveBeenCalledWith('user-1', {
        fullName: 'Existing Person',
        role: 'admin',
        clientId: null,
      })
    );
    const [, sentBody] = updateUserMock.mock.calls[0];
    expect(sentBody).not.toHaveProperty('email');
    expect(sentBody).not.toHaveProperty('isActive');
    expect(sentBody).not.toHaveProperty('provisioned');
    expect(await screen.findByText('Users List Page')).toBeInTheDocument();
  });

  it('sends the correctly-changed client for a non-admin update', async () => {
    getUserMock.mockResolvedValue(nonAdminUser);
    updateUserMock.mockResolvedValue({ ...nonAdminUser, clientId: 'client-b' });
    renderEdit();

    // The "Client" label/select render immediately (from the currently
    // assigned client), but the full options list — including "Beta Inc" —
    // only appears once useClientOptions' async fetch resolves. Selecting
    // an option before then is a no-op in jsdom (it silently resets the
    // select to ''), so wait for the option to actually exist first.
    await screen.findByText('Beta Inc');
    const clientSelect = screen.getByLabelText(/^client$/i);
    fireEvent.change(clientSelect, { target: { value: 'client-b' } });
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() =>
      expect(updateUserMock).toHaveBeenCalledWith('user-1', {
        fullName: 'Existing Person',
        role: 'view_only',
        clientId: 'client-b',
      })
    );
  });

  it('shows an API error on update failure without navigating away', async () => {
    getUserMock.mockResolvedValue(nonAdminUser);
    updateUserMock.mockRejectedValue(new ApiClientError(500, 'database_error', 'Update failed'));
    renderEdit();

    await screen.findByLabelText(/^client$/i);
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    expect(await screen.findByText('Update failed')).toBeInTheDocument();
    expect(screen.queryByText('Users List Page')).not.toBeInTheDocument();
  });

  it('shows an error state if the user fails to load', async () => {
    getUserMock.mockRejectedValue(new ApiClientError(404, 'not_found', 'User not found'));
    renderEdit();
    expect(await screen.findByText('User not found')).toBeInTheDocument();
  });
});
