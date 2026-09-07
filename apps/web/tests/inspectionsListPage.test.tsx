import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InspectionsListPage } from '../src/features/inspections/pages/InspectionsListPage';
import type { Inspection } from '../src/features/inspections/types/inspection';
import { ApiClientError } from '../src/services/apiClient';
import type { Profile } from '../src/types/auth';

const useAuthMock = vi.fn();
vi.mock('../src/hooks/useAuth', () => ({ useAuth: () => useAuthMock() }));

const listInspectionsMock = vi.fn();
vi.mock('../src/features/inspections/services/inspectionsService', () => ({
  listInspections: (...args: unknown[]) => listInspectionsMock(...args),
}));

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

const sampleInspection: Inspection = {
  id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  clientId: 'client-a',
  projectId: null,
  title: 'Annual Fire Safety Check',
  inspectionDate: '2026-03-01',
  status: 'scheduled',
  summary: null,
  suburb: 'Springfield',
  suggestedWorks: null,
  remediationQuote: null,
  lastInspectionDate: null,
  nextInspectionDate: '2026-09-01',
  dueStatus: 'orange',
  createdBy: 'user-admin',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
};

function renderPage() {
  return render(
    <MemoryRouter>
      <InspectionsListPage />
    </MemoryRouter>
  );
}

beforeEach(() => {
  listInspectionsMock.mockReset();
  listProjectsMock.mockReset();
  listProjectsMock.mockResolvedValue({ items: [], meta: { page: 1, pageSize: 100, total: 0, totalPages: 1 } });
});

describe('InspectionsListPage role-aware controls', () => {
  it('shows the "New Inspection" action for admin', async () => {
    useAuthMock.mockReturnValue({ profile: profile({ role: 'admin', clientId: null }) });
    listInspectionsMock.mockResolvedValue({
      items: [sampleInspection],
      meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    });
    renderPage();
    expect(await screen.findByText('Annual Fire Safety Check')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /new inspection/i })).toBeInTheDocument();
  });

  it('hides the "New Inspection" action for upload_notes (view-permitted, no admin mutation controls)', async () => {
    useAuthMock.mockReturnValue({ profile: profile({ role: 'upload_notes' }) });
    listInspectionsMock.mockResolvedValue({
      items: [sampleInspection],
      meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    });
    renderPage();
    expect(await screen.findByText('Annual Fire Safety Check')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /new inspection/i })).not.toBeInTheDocument();
  });

  it('hides the "New Inspection" action for view_only (read-only)', async () => {
    useAuthMock.mockReturnValue({ profile: profile({ role: 'view_only' }) });
    listInspectionsMock.mockResolvedValue({
      items: [sampleInspection],
      meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
    });
    renderPage();
    expect(await screen.findByText('Annual Fire Safety Check')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /new inspection/i })).not.toBeInTheDocument();
  });
});

describe('InspectionsListPage loading/empty/error states', () => {
  it('shows a loading state before data arrives', () => {
    useAuthMock.mockReturnValue({ profile: profile({ role: 'view_only' }) });
    listInspectionsMock.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByText(/loading inspections/i)).toBeInTheDocument();
  });

  it('shows an empty state when there are no inspections', async () => {
    useAuthMock.mockReturnValue({ profile: profile({ role: 'view_only' }) });
    listInspectionsMock.mockResolvedValue({ items: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 1 } });
    renderPage();
    expect(await screen.findByText(/no inspections/i)).toBeInTheDocument();
  });

  it('shows an error state when the API call fails, e.g. a module/permission denial', async () => {
    useAuthMock.mockReturnValue({ profile: profile({ role: 'view_only' }) });
    listInspectionsMock.mockRejectedValue(
      new ApiClientError(403, 'forbidden', 'Your client does not have access to inspections')
    );
    renderPage();
    expect(await screen.findByText(/could not load inspections/i)).toBeInTheDocument();
    expect(screen.getByText(/does not have access to inspections/i)).toBeInTheDocument();
  });
});
