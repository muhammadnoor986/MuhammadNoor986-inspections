import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectDetailPage } from '../src/features/projects/pages/ProjectDetailPage';
import type { Project } from '../src/features/projects/types/project';
import { ApiClientError } from '../src/services/apiClient';
import type { Profile } from '../src/types/auth';

const useAuthMock = vi.fn();
vi.mock('../src/hooks/useAuth', () => ({ useAuth: () => useAuthMock() }));

const getProjectMock = vi.fn();
vi.mock('../src/features/projects/services/projectsService', () => ({
  getProject: (...args: unknown[]) => getProjectMock(...args),
  deleteProject: vi.fn(),
}));

// ProjectDetailPage renders the photo gallery too — stub the attachments
// service so this file's assertions stay focused on the project fields and
// mutation controls (the gallery itself has its own test coverage).
vi.mock('../src/features/attachments/services/attachmentsService', () => ({
  listAttachments: vi.fn().mockResolvedValue({ items: [], meta: { page: 1, pageSize: 100, total: 0, totalPages: 1 } }),
  deleteAttachment: vi.fn(),
  presignAttachmentUpload: vi.fn(),
  confirmAttachmentUpload: vi.fn(),
  replaceAttachment: vi.fn(),
  getAttachmentDownloadUrl: vi.fn(),
  putFileToS3: vi.fn(),
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
  description: 'A test project',
  address: '123 River Rd',
  status: 'active',
  createdBy: 'user-admin',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={[`/projects/${sampleProject.id}`]}>
      <Routes>
        <Route path="/projects/:id" element={<ProjectDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  getProjectMock.mockReset();
});

describe('ProjectDetailPage role-aware mutation controls', () => {
  it('shows Edit/Delete for admin', async () => {
    useAuthMock.mockReturnValue({ profile: profile({ role: 'admin', clientId: null }) });
    getProjectMock.mockResolvedValue(sampleProject);
    renderPage();
    expect(await screen.findByText('Riverside Site')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /edit/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
  });

  it('hides Edit/Delete for upload_notes — view permitted data, no admin mutation controls', async () => {
    useAuthMock.mockReturnValue({ profile: profile({ role: 'upload_notes' }) });
    getProjectMock.mockResolvedValue(sampleProject);
    renderPage();
    expect(await screen.findByText('Riverside Site')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /edit/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
  });

  it('hides Edit/Delete for view_only — read-only', async () => {
    useAuthMock.mockReturnValue({ profile: profile({ role: 'view_only' }) });
    getProjectMock.mockResolvedValue(sampleProject);
    renderPage();
    expect(await screen.findByText('Riverside Site')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /edit/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
  });
});

describe('ProjectDetailPage client isolation', () => {
  it('renders the API-enforced 403 as an error, never falling back to stale/partial project data', async () => {
    useAuthMock.mockReturnValue({ profile: profile({ role: 'view_only', clientId: 'client-c' }) });
    getProjectMock.mockRejectedValue(
      new ApiClientError(403, 'forbidden', 'This resource does not belong to your organization')
    );
    renderPage();
    expect(await screen.findByText(/could not load this project/i)).toBeInTheDocument();
    expect(screen.getByText(/does not belong to your organization/i)).toBeInTheDocument();
    expect(screen.queryByText('Riverside Site')).not.toBeInTheDocument();
  });
});
