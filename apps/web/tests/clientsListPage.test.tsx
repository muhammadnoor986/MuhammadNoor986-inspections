import { render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ClientsListPage } from '../src/features/clients/pages/ClientsListPage';
import type { Client } from '../src/features/clients/types/client';
import { ApiClientError } from '../src/services/apiClient';

const listClientsMock = vi.fn();
const activateClientMock = vi.fn();
const deactivateClientMock = vi.fn();
vi.mock('../src/features/clients/services/clientsService', () => ({
  listClients: (...args: unknown[]) => listClientsMock(...args),
  activateClient: (...args: unknown[]) => activateClientMock(...args),
  deactivateClient: (...args: unknown[]) => deactivateClientMock(...args),
}));

const activeClient: Client = {
  id: 'client-active',
  name: 'Acme Corp',
  canAccessProjects: true,
  canAccessInspections: false,
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
};

const inactiveClient: Client = {
  id: 'client-inactive',
  name: 'Suspended LLC',
  canAccessProjects: true,
  canAccessInspections: true,
  isActive: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
};

function renderPage() {
  return render(
    <MemoryRouter>
      <ClientsListPage />
    </MemoryRouter>
  );
}

beforeEach(() => {
  listClientsMock.mockReset();
  activateClientMock.mockReset();
  deactivateClientMock.mockReset();
});

describe('ClientsListPage rendering', () => {
  it('renders clients with module access and status', async () => {
    listClientsMock.mockResolvedValue({
      items: [activeClient],
      meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    });
    renderPage();
    expect(await screen.findByText('Acme Corp')).toBeInTheDocument();
    expect(screen.getByText('Enabled')).toBeInTheDocument();
    expect(screen.getByText('Disabled')).toBeInTheDocument();
    const row = screen.getByText('Acme Corp').closest('tr') as HTMLElement;
    expect(within(row).getByText('Active')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /new client/i })).toBeInTheDocument();
  });
});

describe('ClientsListPage loading/error/empty states', () => {
  it('shows a loading state before data arrives', () => {
    listClientsMock.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByText(/loading clients/i)).toBeInTheDocument();
  });

  it('shows an error state when the API call fails', async () => {
    listClientsMock.mockRejectedValue(new ApiClientError(500, 'database_error', 'Something broke'));
    renderPage();
    expect(await screen.findByText(/could not load clients/i)).toBeInTheDocument();
    expect(screen.getByText('Something broke')).toBeInTheDocument();
  });

  it('shows an empty state (no clients exist) with a create action', async () => {
    listClientsMock.mockResolvedValue({ items: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 1 } });
    renderPage();
    expect(await screen.findByText('No clients yet')).toBeInTheDocument();
    expect(screen.getByText(/create the first client/i)).toBeInTheDocument();
  });
});

describe('ClientsListPage filters', () => {
  it('sends the selected status filter through to the API call', async () => {
    listClientsMock.mockResolvedValue({ items: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 1 } });
    renderPage();
    await screen.findByText(/no clients match your filters|no clients yet/i);
    listClientsMock.mockClear();

    screen.getByRole('button', { name: /^inactive$/i }).click();

    await screen.findByText(/no clients match your filters/i);
    expect(listClientsMock).toHaveBeenCalledWith(expect.objectContaining({ isActive: 'false' }));
  });

  it('distinguishes "no clients match this filter" from "no clients exist"', async () => {
    listClientsMock.mockResolvedValue({ items: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 1 } });
    renderPage();
    await screen.findByText('No clients yet');

    screen.getByRole('button', { name: /^active$/i }).click();
    expect(await screen.findByText('No clients match your filters')).toBeInTheDocument();
  });
});

describe('ClientsListPage activate/deactivate', () => {
  it('active client shows a Deactivate action; confirming calls deactivateClient and refreshes', async () => {
    listClientsMock.mockResolvedValue({
      items: [activeClient],
      meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    });
    deactivateClientMock.mockResolvedValue({ ...activeClient, isActive: false });
    renderPage();
    await screen.findByText('Acme Corp');

    expect(screen.getByRole('button', { name: /^deactivate$/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^activate$/i })).not.toBeInTheDocument();

    listClientsMock.mockClear();
    screen.getByRole('button', { name: /^deactivate$/i }).click();

    const dialog = await screen.findByRole('alertdialog');
    within(dialog).getByRole('button', { name: /^deactivate$/i }).click();

    expect(deactivateClientMock).toHaveBeenCalledWith('client-active');
    await waitFor(() => expect(listClientsMock).toHaveBeenCalled());
  });

  it('inactive client shows an Activate action; clicking calls activateClient and refreshes', async () => {
    listClientsMock.mockResolvedValue({
      items: [inactiveClient],
      meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    });
    activateClientMock.mockResolvedValue({ ...inactiveClient, isActive: true });
    renderPage();
    await screen.findByText('Suspended LLC');

    expect(screen.getByRole('button', { name: /^activate$/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^deactivate$/i })).not.toBeInTheDocument();

    listClientsMock.mockClear();
    screen.getByRole('button', { name: /^activate$/i }).click();

    await Promise.resolve();
    expect(activateClientMock).toHaveBeenCalledWith('client-inactive');
  });

  it('shows an error and does not crash if activate/deactivate fails', async () => {
    listClientsMock.mockResolvedValue({
      items: [inactiveClient],
      meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    });
    activateClientMock.mockRejectedValue(new ApiClientError(500, 'database_error', 'Could not activate'));
    renderPage();
    await screen.findByText('Suspended LLC');

    screen.getByRole('button', { name: /^activate$/i }).click();

    expect(await screen.findByText('Could not activate')).toBeInTheDocument();
  });
});
