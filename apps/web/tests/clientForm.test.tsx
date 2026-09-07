import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ClientCreatePage } from '../src/features/clients/pages/ClientCreatePage';
import { ClientEditPage } from '../src/features/clients/pages/ClientEditPage';
import type { Client } from '../src/features/clients/types/client';
import { ApiClientError } from '../src/services/apiClient';

const createClientMock = vi.fn();
const getClientMock = vi.fn();
const updateClientMock = vi.fn();
vi.mock('../src/features/clients/services/clientsService', () => ({
  createClient: (...args: unknown[]) => createClientMock(...args),
  getClient: (...args: unknown[]) => getClientMock(...args),
  updateClient: (...args: unknown[]) => updateClientMock(...args),
}));

const existingClient: Client = {
  id: 'client-1',
  name: 'Existing Client',
  canAccessProjects: false,
  canAccessInspections: true,
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
};

beforeEach(() => {
  createClientMock.mockReset();
  getClientMock.mockReset();
  updateClientMock.mockReset();
});

describe('ClientCreatePage', () => {
  function renderCreate() {
    return render(
      <MemoryRouter initialEntries={['/clients/new']}>
        <Routes>
          <Route path="/clients/new" element={<ClientCreatePage />} />
          <Route path="/clients" element={<div>Clients List Page</div>} />
        </Routes>
      </MemoryRouter>
    );
  }

  it('rejects an empty name without calling the API', () => {
    renderCreate();
    fireEvent.click(screen.getByRole('button', { name: /create client/i }));
    expect(screen.getByText(/client name is required/i)).toBeInTheDocument();
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it('defaults both module access checkboxes to checked', () => {
    renderCreate();
    const checkboxes = screen.getAllByRole('checkbox') as HTMLInputElement[];
    expect(checkboxes).toHaveLength(2);
    expect(checkboxes.every((cb) => cb.checked)).toBe(true);
  });

  it('calls createClient with the correct camelCase fields and navigates to the list on success', async () => {
    createClientMock.mockResolvedValue({ ...existingClient, id: 'new-client' });
    renderCreate();

    fireEvent.change(screen.getByLabelText(/client name/i), { target: { value: 'New Client Co' } });
    fireEvent.click(screen.getByLabelText(/inspections access/i)); // uncheck

    fireEvent.click(screen.getByRole('button', { name: /create client/i }));

    await waitFor(() =>
      expect(createClientMock).toHaveBeenCalledWith({
        name: 'New Client Co',
        canAccessProjects: true,
        canAccessInspections: false,
      })
    );
    expect(await screen.findByText('Clients List Page')).toBeInTheDocument();
  });

  it('shows an API error and does not navigate away on failure', async () => {
    createClientMock.mockRejectedValue(new ApiClientError(409, 'conflict', 'A client with this name already exists'));
    renderCreate();

    fireEvent.change(screen.getByLabelText(/client name/i), { target: { value: 'Dup Co' } });
    fireEvent.click(screen.getByRole('button', { name: /create client/i }));

    expect(await screen.findByText('A client with this name already exists')).toBeInTheDocument();
    expect(screen.queryByText('Clients List Page')).not.toBeInTheDocument();
  });

  it('disables the submit button while saving', async () => {
    let resolveCreate: (value: Client) => void = () => {};
    createClientMock.mockReturnValue(new Promise((resolve) => (resolveCreate = resolve)));
    renderCreate();

    fireEvent.change(screen.getByLabelText(/client name/i), { target: { value: 'Slow Co' } });
    fireEvent.click(screen.getByRole('button', { name: /create client/i }));

    expect(await screen.findByRole('button', { name: /saving/i })).toBeDisabled();
    resolveCreate({ ...existingClient, id: 'slow-co' });
  });
});

describe('ClientEditPage', () => {
  function renderEdit() {
    return render(
      <MemoryRouter initialEntries={['/clients/client-1/edit']}>
        <Routes>
          <Route path="/clients/:id/edit" element={<ClientEditPage />} />
          <Route path="/clients" element={<div>Clients List Page</div>} />
        </Routes>
      </MemoryRouter>
    );
  }

  it('loads and pre-fills the existing client values', async () => {
    getClientMock.mockResolvedValue(existingClient);
    renderEdit();

    const nameInput = (await screen.findByLabelText(/client name/i)) as HTMLInputElement;
    expect(nameInput.value).toBe('Existing Client');
    const [projectsCheckbox, inspectionsCheckbox] = screen.getAllByRole('checkbox') as HTMLInputElement[];
    expect(projectsCheckbox.checked).toBe(false);
    expect(inspectionsCheckbox.checked).toBe(true);
  });

  it('sends only the editable fields on update, never isActive', async () => {
    getClientMock.mockResolvedValue(existingClient);
    updateClientMock.mockResolvedValue({ ...existingClient, name: 'Renamed Client' });
    renderEdit();

    const nameInput = await screen.findByLabelText(/client name/i);
    fireEvent.change(nameInput, { target: { value: 'Renamed Client' } });
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() =>
      expect(updateClientMock).toHaveBeenCalledWith('client-1', {
        name: 'Renamed Client',
        canAccessProjects: false,
        canAccessInspections: true,
      })
    );
    const [, sentInput] = updateClientMock.mock.calls[0];
    expect(sentInput).not.toHaveProperty('isActive');
    expect(await screen.findByText('Clients List Page')).toBeInTheDocument();
  });

  it('shows an API error on update failure', async () => {
    getClientMock.mockResolvedValue(existingClient);
    updateClientMock.mockRejectedValue(new ApiClientError(500, 'database_error', 'Update failed'));
    renderEdit();

    fireEvent.click(await screen.findByRole('button', { name: /save changes/i }));
    expect(await screen.findByText('Update failed')).toBeInTheDocument();
  });

  it('shows an error state if the client fails to load', async () => {
    getClientMock.mockRejectedValue(new ApiClientError(404, 'not_found', 'Client not found'));
    renderEdit();
    expect(await screen.findByText('Client not found')).toBeInTheDocument();
  });
});
