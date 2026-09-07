import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UsersListPage } from '../src/features/users/pages/UsersListPage';
import type { User } from '../src/features/users/types/user';
import { ApiClientError } from '../src/services/apiClient';

const listUsersMock = vi.fn();
const activateUserMock = vi.fn();
const deactivateUserMock = vi.fn();
vi.mock('../src/features/users/services/usersService', () => ({
  listUsers: (...args: unknown[]) => listUsersMock(...args),
  activateUser: (...args: unknown[]) => activateUserMock(...args),
  deactivateUser: (...args: unknown[]) => deactivateUserMock(...args),
}));

const listClientsMock = vi.fn();
vi.mock('../src/features/clients/services/clientsService', () => ({
  listClients: (...args: unknown[]) => listClientsMock(...args),
}));

const activeUser: User = {
  id: 'user-active',
  email: 'jane@test.dev',
  fullName: 'Jane Doe',
  role: 'upload_notes',
  clientId: 'client-a',
  provisioned: true,
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
  client: { id: 'client-a', name: 'Acme Corp', isActive: true },
};

const inactiveUser: User = {
  id: 'user-inactive',
  email: 'no-name@test.dev',
  fullName: null,
  role: 'view_only',
  clientId: 'client-a',
  provisioned: true,
  isActive: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
  client: { id: 'client-a', name: 'Acme Corp', isActive: true },
};

function renderPage() {
  return render(
    <MemoryRouter>
      <UsersListPage />
    </MemoryRouter>
  );
}

beforeEach(() => {
  listUsersMock.mockReset();
  activateUserMock.mockReset();
  deactivateUserMock.mockReset();
  listClientsMock.mockReset();
  listClientsMock.mockResolvedValue({ items: [], meta: { page: 1, pageSize: 100, total: 0, totalPages: 1 } });
});

describe('UsersListPage rendering', () => {
  it('renders users with role, client, and status', async () => {
    listUsersMock.mockResolvedValue({ items: [activeUser], meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 } });
    renderPage();
    expect(await screen.findByText('Jane Doe')).toBeInTheDocument();
    const row = screen.getByText('Jane Doe').closest('tr') as HTMLElement;
    expect(within(row).getByText('jane@test.dev')).toBeInTheDocument();
    expect(within(row).getByText('Upload & Notes')).toBeInTheDocument();
    expect(within(row).getByText('Acme Corp')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /invite user/i })).toBeInTheDocument();
  });

  it('falls back to email when full name is empty', async () => {
    listUsersMock.mockResolvedValue({ items: [inactiveUser], meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 } });
    renderPage();
    expect(await screen.findByRole('link', { name: 'no-name@test.dev' })).toBeInTheDocument();
  });

  it('shows an em dash for an admin\'s client', async () => {
    listUsersMock.mockResolvedValue({
      items: [{ ...activeUser, role: 'admin', clientId: null, client: null }],
      meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    });
    renderPage();
    const row = (await screen.findByText('Jane Doe')).closest('tr') as HTMLElement;
    expect(within(row).getByText('—')).toBeInTheDocument();
  });
});

describe('UsersListPage loading/error/empty states', () => {
  it('shows a loading state before data arrives', () => {
    listUsersMock.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByText(/loading users/i)).toBeInTheDocument();
  });

  it('shows an error state when the API call fails', async () => {
    listUsersMock.mockRejectedValue(new ApiClientError(500, 'database_error', 'Something broke'));
    renderPage();
    expect(await screen.findByText(/could not load users/i)).toBeInTheDocument();
    expect(screen.getByText('Something broke')).toBeInTheDocument();
  });

  it('shows an empty state (no users exist) with an invite action', async () => {
    listUsersMock.mockResolvedValue({ items: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 1 } });
    renderPage();
    expect(await screen.findByText('No users yet')).toBeInTheDocument();
    expect(screen.getByText(/invite the first user/i)).toBeInTheDocument();
  });

  it('distinguishes "no users match this filter" from "no users exist"', async () => {
    listUsersMock.mockResolvedValue({ items: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 1 } });
    renderPage();
    await screen.findByText('No users yet');

    screen.getByRole('button', { name: /^admin$/i }).click();
    expect(await screen.findByText('No users match your filters')).toBeInTheDocument();
  });
});

describe('UsersListPage filters', () => {
  it('sends the selected role filter through to the API call', async () => {
    listUsersMock.mockResolvedValue({ items: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 1 } });
    renderPage();
    await screen.findByText('No users yet');
    listUsersMock.mockClear();

    screen.getByRole('button', { name: /upload & notes/i }).click();

    await waitFor(() => expect(listUsersMock).toHaveBeenCalledWith(expect.objectContaining({ role: 'upload_notes' })));
  });

  it('sends the selected status filter through to the API call', async () => {
    listUsersMock.mockResolvedValue({ items: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 1 } });
    renderPage();
    await screen.findByText('No users yet');
    listUsersMock.mockClear();

    screen.getByRole('button', { name: /^inactive$/i }).click();

    await waitFor(() => expect(listUsersMock).toHaveBeenCalledWith(expect.objectContaining({ isActive: 'false' })));
  });

  it('sends the selected client filter through to the API call', async () => {
    listClientsMock.mockResolvedValue({
      items: [{ id: 'client-a', name: 'Acme Corp', canAccessProjects: true, canAccessInspections: true, isActive: true, createdAt: '', updatedAt: '' }],
      meta: { page: 1, pageSize: 100, total: 1, totalPages: 1 },
    });
    listUsersMock.mockResolvedValue({ items: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 1 } });
    renderPage();
    await screen.findByText('No users yet');
    listUsersMock.mockClear();

    const clientSelect = await screen.findByLabelText(/^client$/i);
    (clientSelect as HTMLSelectElement).value = 'client-a';
    clientSelect.dispatchEvent(new Event('change', { bubbles: true }));

    await waitFor(() => expect(listUsersMock).toHaveBeenCalledWith(expect.objectContaining({ clientId: 'client-a' })));
  });
});

describe('UsersListPage activate/deactivate', () => {
  it('active user shows Deactivate; confirming calls deactivateUser and refreshes', async () => {
    listUsersMock.mockResolvedValue({ items: [activeUser], meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 } });
    deactivateUserMock.mockResolvedValue({ ...activeUser, isActive: false });
    renderPage();
    await screen.findByText('Jane Doe');

    expect(screen.getByRole('button', { name: /^deactivate$/i })).toBeInTheDocument();
    listUsersMock.mockClear();
    screen.getByRole('button', { name: /^deactivate$/i }).click();

    const dialog = await screen.findByRole('alertdialog');
    within(dialog).getByRole('button', { name: /^deactivate$/i }).click();

    expect(deactivateUserMock).toHaveBeenCalledWith('user-active');
    await waitFor(() => expect(listUsersMock).toHaveBeenCalled());
  });

  it('inactive user shows Activate; clicking calls activateUser', async () => {
    listUsersMock.mockResolvedValue({ items: [inactiveUser], meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 } });
    activateUserMock.mockResolvedValue({ ...inactiveUser, isActive: true });
    renderPage();
    await screen.findByRole('link', { name: 'no-name@test.dev' });

    expect(screen.getByRole('button', { name: /^activate$/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^deactivate$/i })).not.toBeInTheDocument();

    screen.getByRole('button', { name: /^activate$/i }).click();
    expect(activateUserMock).toHaveBeenCalledWith('user-inactive');
  });

  it('disables the row action while a request is in flight, preventing duplicate clicks', async () => {
    listUsersMock.mockResolvedValue({ items: [inactiveUser], meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 } });
    let resolveActivate: (value: User) => void = () => {};
    activateUserMock.mockReturnValue(new Promise((resolve) => (resolveActivate = resolve)));
    renderPage();
    await screen.findByRole('link', { name: 'no-name@test.dev' });

    const button = screen.getByRole('button', { name: /^activate$/i });
    button.click();
    expect(await screen.findByRole('button', { name: /activating/i })).toBeDisabled();
    expect(activateUserMock).toHaveBeenCalledTimes(1);

    resolveActivate({ ...inactiveUser, isActive: true });
  });

  it('shows an error and does not crash if activate fails', async () => {
    listUsersMock.mockResolvedValue({ items: [inactiveUser], meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 } });
    activateUserMock.mockRejectedValue(new ApiClientError(500, 'database_error', 'Could not activate'));
    renderPage();
    await screen.findByRole('link', { name: 'no-name@test.dev' });

    screen.getByRole('button', { name: /^activate$/i }).click();
    expect(await screen.findByText('Could not activate')).toBeInTheDocument();
  });
});
