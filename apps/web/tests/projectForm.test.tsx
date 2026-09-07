import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectCreatePage } from '../src/features/projects/pages/ProjectCreatePage';
import { ProjectEditPage } from '../src/features/projects/pages/ProjectEditPage';
import type { Project } from '../src/features/projects/types/project';
import { ApiClientError } from '../src/services/apiClient';

// Note: getByLabelText queries below use a non-anchored /client/i rather
// than /^client$/i — the "Client" <label> also wraps sibling hint/error
// spans (e.g. "Loading clients...", validation errors), which become part
// of its accessible name and break an anchored match.

const createProjectMock = vi.fn();
const getProjectMock = vi.fn();
const updateProjectMock = vi.fn();
vi.mock('../src/features/projects/services/projectsService', () => ({
  createProject: (...args: unknown[]) => createProjectMock(...args),
  getProject: (...args: unknown[]) => getProjectMock(...args),
  updateProject: (...args: unknown[]) => updateProjectMock(...args),
}));

const listClientsMock = vi.fn();
vi.mock('../src/features/clients/services/clientsService', () => ({
  listClients: (...args: unknown[]) => listClientsMock(...args),
}));

function clientRow(id: string, name: string, isActive = true) {
  return { id, name, canAccessProjects: true, canAccessInspections: true, isActive, createdAt: '', updatedAt: '' };
}

const existingProject: Project = {
  id: 'project-1',
  clientId: 'client-a',
  name: 'HQ Building',
  description: 'Main office',
  address: '1 Main St',
  status: 'active',
  createdBy: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
};

beforeEach(() => {
  createProjectMock.mockReset();
  getProjectMock.mockReset();
  updateProjectMock.mockReset();
  listClientsMock.mockReset();
  listClientsMock.mockResolvedValue({
    items: [clientRow('client-a', 'Acme Corp'), clientRow('client-b', 'Beta Inc')],
    meta: { page: 1, pageSize: 100, total: 2, totalPages: 1 },
  });
});

function renderCreate() {
  return render(
    <MemoryRouter initialEntries={['/projects/new']}>
      <Routes>
        <Route path="/projects/new" element={<ProjectCreatePage />} />
        <Route path="/projects/:id" element={<div>Project Detail Page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

function renderEdit() {
  return render(
    <MemoryRouter initialEntries={['/projects/project-1/edit']}>
      <Routes>
        <Route path="/projects/:id/edit" element={<ProjectEditPage />} />
        <Route path="/projects/:id" element={<div>Project Detail Page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('ProjectForm - create - client dropdown', () => {
  it('1-2. renders a client dropdown listing client names, not a raw UUID input', async () => {
    renderCreate();
    const select = (await screen.findByLabelText(/client/i)) as HTMLSelectElement;
    expect(select.tagName).toBe('SELECT');
    expect(screen.getByRole('option', { name: 'Acme Corp' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Beta Inc' })).toBeInTheDocument();
  });

  it('4. no longer offers a raw UUID text field for the client', async () => {
    renderCreate();
    await screen.findByLabelText(/client/i);
    expect(screen.queryByPlaceholderText(/00000000-0000/)).not.toBeInTheDocument();
  });

  it('3. selecting a client submits the correct client UUID, not its name', async () => {
    createProjectMock.mockResolvedValue({ ...existingProject, id: 'new-project' });
    renderCreate();
    // Wait for the actual option to exist — the select renders before the
    // async client fetch resolves, and selecting a not-yet-present option
    // is a silent no-op in jsdom.
    await screen.findByRole('option', { name: 'Beta Inc' });

    fireEvent.change(screen.getByLabelText(/client/i), { target: { value: 'client-b' } });
    fireEvent.change(screen.getByLabelText(/^name$/i), { target: { value: 'New Site' } });
    fireEvent.click(screen.getByRole('button', { name: /create project/i }));

    await waitFor(() => expect(createProjectMock).toHaveBeenCalledWith(expect.objectContaining({ clientId: 'client-b' })));
    const [sentBody] = createProjectMock.mock.calls[0];
    expect(sentBody.clientId).not.toBe('Beta Inc');
  });

  it('5. rejects submission with no client selected', async () => {
    renderCreate();
    await screen.findByLabelText(/client/i);
    fireEvent.change(screen.getByLabelText(/^name$/i), { target: { value: 'New Site' } });
    fireEvent.click(screen.getByRole('button', { name: /create project/i }));

    expect(screen.getByText(/client is required/i)).toBeInTheDocument();
    expect(createProjectMock).not.toHaveBeenCalled();
  });

  it('6. shows a loading state and disables the dropdown while clients load', () => {
    listClientsMock.mockReturnValue(new Promise(() => {}));
    renderCreate();
    expect(screen.getByText(/loading clients/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/client/i)).toBeDisabled();
  });

  it('7. shows an error and does not allow a silent empty submission when clients fail to load', async () => {
    listClientsMock.mockRejectedValue(new ApiClientError(500, 'database_error', 'Could not reach clients'));
    renderCreate();
    expect(await screen.findByText('Could not reach clients')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/^name$/i), { target: { value: 'New Site' } });
    fireEvent.click(screen.getByRole('button', { name: /create project/i }));
    expect(screen.getByText(/client is required/i)).toBeInTheDocument();
    expect(createProjectMock).not.toHaveBeenCalled();
  });

  it('shows an empty-options message when there are no clients to select', async () => {
    listClientsMock.mockResolvedValue({ items: [], meta: { page: 1, pageSize: 100, total: 0, totalPages: 1 } });
    renderCreate();
    expect(await screen.findByText(/no clients available/i)).toBeInTheDocument();
  });
});

describe('ProjectForm - edit - read-only client display', () => {
  it('8. shows the existing assigned client by name, not editable', async () => {
    getProjectMock.mockResolvedValue(existingProject);
    renderEdit();

    const clientField = (await screen.findByLabelText(/client/i)) as HTMLInputElement;
    expect(clientField.tagName).toBe('INPUT');
    expect(clientField).toBeDisabled();
    await waitFor(() => expect(clientField.value).toBe('Acme Corp'));
  });

  it('9. preserves and labels an inactive existing client instead of dropping it', async () => {
    getProjectMock.mockResolvedValue({ ...existingProject, clientId: 'client-c' });
    listClientsMock.mockResolvedValue({
      items: [clientRow('client-a', 'Acme Corp'), clientRow('client-c', 'Old Client', false)],
      meta: { page: 1, pageSize: 100, total: 2, totalPages: 1 },
    });
    renderEdit();

    const clientField = (await screen.findByLabelText(/client/i)) as HTMLInputElement;
    await waitFor(() => expect(clientField.value).toBe('Old Client (inactive)'));
  });

  it('does not include clientId in the update payload', async () => {
    getProjectMock.mockResolvedValue(existingProject);
    updateProjectMock.mockResolvedValue(existingProject);
    renderEdit();

    await screen.findByLabelText(/client/i);
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => expect(updateProjectMock).toHaveBeenCalled());
    const [, sentBody] = updateProjectMock.mock.calls[0];
    expect(sentBody).not.toHaveProperty('clientId');
  });
});
