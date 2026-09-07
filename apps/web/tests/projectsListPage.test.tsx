import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectsListPage } from '../src/features/projects/pages/ProjectsListPage';
import type { Project } from '../src/features/projects/types/project';
import { ApiClientError } from '../src/services/apiClient';
import type { Profile } from '../src/types/auth';

const useAuthMock = vi.fn();
vi.mock('../src/hooks/useAuth', () => ({ useAuth: () => useAuthMock() }));

const listProjectsMock = vi.fn();
vi.mock('../src/features/projects/services/projectsService', () => ({
  listProjects: (...args: unknown[]) => listProjectsMock(...args),
}));

function profile(overrides: Partial<Profile>): Profile {
  return {
    id: 'user-1',
    email: 'user@test.dev',
    role: 'view_only',
    clientId: 'client-a',
    canAccessProjects: true,
    canAccessInspections: true,
    ...overrides,
  };
}

const sampleProject: Project = {
  id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  clientId: 'client-a',
  name: 'Riverside Site',
  description: null,
  address: '123 River Rd',
  status: 'active',
  createdBy: 'user-admin',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
};

function renderPage() {
  return render(
    <MemoryRouter>
      <ProjectsListPage />
    </MemoryRouter>
  );
}

beforeEach(() => {
  listProjectsMock.mockReset();
});

describe('ProjectsListPage role-aware controls', () => {
  it('shows the "New Project" action for admin', async () => {
    useAuthMock.mockReturnValue({ profile: profile({ role: 'admin', clientId: null }) });
    listProjectsMock.mockResolvedValue({ items: [sampleProject], meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 } });
    renderPage();
    expect(await screen.findByText('Riverside Site')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /new project/i })).toBeInTheDocument();
  });

  it('hides the "New Project" action for upload_notes (view-permitted, no admin mutation controls)', async () => {
    useAuthMock.mockReturnValue({ profile: profile({ role: 'upload_notes' }) });
    listProjectsMock.mockResolvedValue({ items: [sampleProject], meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 } });
    renderPage();
    expect(await screen.findByText('Riverside Site')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /new project/i })).not.toBeInTheDocument();
  });

  it('hides the "New Project" action for view_only (read-only)', async () => {
    useAuthMock.mockReturnValue({ profile: profile({ role: 'view_only' }) });
    listProjectsMock.mockResolvedValue({ items: [sampleProject], meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 } });
    renderPage();
    expect(await screen.findByText('Riverside Site')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /new project/i })).not.toBeInTheDocument();
  });
});

describe('ProjectsListPage loading/empty/error states', () => {
  it('shows a loading state before data arrives', () => {
    useAuthMock.mockReturnValue({ profile: profile({ role: 'view_only' }) });
    listProjectsMock.mockReturnValue(new Promise(() => {})); // never resolves
    renderPage();
    expect(screen.getByText(/loading projects/i)).toBeInTheDocument();
  });

  it('shows an empty state when there are no projects', async () => {
    useAuthMock.mockReturnValue({ profile: profile({ role: 'view_only' }) });
    listProjectsMock.mockResolvedValue({ items: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 1 } });
    renderPage();
    expect(await screen.findByText(/no projects/i)).toBeInTheDocument();
  });

  it('shows an error state when the API call fails, e.g. a cross-client/permission denial', async () => {
    useAuthMock.mockReturnValue({ profile: profile({ role: 'view_only' }) });
    listProjectsMock.mockRejectedValue(new ApiClientError(403, 'forbidden', 'Your client does not have access to projects'));
    renderPage();
    expect(await screen.findByText(/could not load projects/i)).toBeInTheDocument();
    expect(screen.getByText(/does not have access to projects/i)).toBeInTheDocument();
  });
});
