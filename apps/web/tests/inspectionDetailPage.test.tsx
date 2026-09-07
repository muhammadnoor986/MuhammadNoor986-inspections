import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InspectionDetailPage } from '../src/features/inspections/pages/InspectionDetailPage';
import type { Inspection, Note } from '../src/features/inspections/types/inspection';
import { ApiClientError } from '../src/services/apiClient';
import type { Profile } from '../src/types/auth';

const useAuthMock = vi.fn();
vi.mock('../src/hooks/useAuth', () => ({ useAuth: () => useAuthMock() }));

const getInspectionMock = vi.fn();
vi.mock('../src/features/inspections/services/inspectionsService', () => ({
  getInspection: (...args: unknown[]) => getInspectionMock(...args),
  deleteInspection: vi.fn(),
}));

const listNotesMock = vi.fn();
const createNoteMock = vi.fn();
vi.mock('../src/features/inspections/services/notesService', () => ({
  listInspectionNotes: (...args: unknown[]) => listNotesMock(...args),
  createInspectionNote: (...args: unknown[]) => createNoteMock(...args),
}));

const listAcknowledgementsMock = vi.fn();
const acknowledgeInspectionMock = vi.fn();
vi.mock('../src/features/inspections/services/acknowledgementsService', () => ({
  listAcknowledgements: (...args: unknown[]) => listAcknowledgementsMock(...args),
  acknowledgeInspection: (...args: unknown[]) => acknowledgeInspectionMock(...args),
}));

// InspectionDetailPage renders the attachments section too — stub it so
// this file's assertions stay focused on inspection fields/notes/controls
// (the attachments UI has its own test coverage).
vi.mock('../src/features/attachments/services/attachmentsService', () => ({
  listAttachments: vi.fn().mockResolvedValue({ items: [], meta: { page: 1, pageSize: 100, total: 0, totalPages: 1 } }),
  deleteAttachment: vi.fn(),
  presignAttachmentUpload: vi.fn(),
  confirmAttachmentUpload: vi.fn(),
  replaceAttachment: vi.fn(),
  getAttachmentDownloadUrl: vi.fn(),
  putFileToS3: vi.fn(),
}));

vi.mock('../src/features/projects/services/projectsService', () => ({
  getProject: vi.fn().mockResolvedValue({
    id: 'project-1',
    clientId: 'client-a',
    name: 'HQ Building',
    description: null,
    address: '1 Main St',
    status: 'active',
    createdBy: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  }),
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
  summary: 'All clear',
  suburb: 'Springfield',
  suggestedWorks: 'Replace smoke detector batteries',
  remediationQuote: 350,
  lastInspectionDate: '2025-09-01',
  nextInspectionDate: '2026-09-01',
  dueStatus: 'orange',
  createdBy: 'user-admin',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
};

const sampleNote: Note = {
  id: 'note-1',
  parentKind: 'inspection',
  parentId: sampleInspection.id,
  body: 'Checked all extinguishers.',
  createdBy: 'user-admin',
  authorEmail: 'admin@test.dev',
  createdAt: '2026-01-03T00:00:00.000Z',
};

function renderPage() {
  return render(
    <MemoryRouter initialEntries={[`/inspections/${sampleInspection.id}`]}>
      <Routes>
        <Route path="/inspections/:id" element={<InspectionDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
}

beforeEach(() => {
  getInspectionMock.mockReset();
  listNotesMock.mockReset();
  createNoteMock.mockReset();
  listAcknowledgementsMock.mockReset();
  acknowledgeInspectionMock.mockReset();
  listNotesMock.mockResolvedValue({ items: [sampleNote], meta: { page: 1, pageSize: 100, total: 1, totalPages: 1 } });
  listAcknowledgementsMock.mockResolvedValue({ items: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 1 } });
});

describe('InspectionDetailPage shows the required report fields', () => {
  it('shows report info, remediation notes/quote, dates, and notes', async () => {
    useAuthMock.mockReturnValue({ profile: profile({ role: 'admin', clientId: null }) });
    getInspectionMock.mockResolvedValue(sampleInspection);
    renderPage();
    expect(await screen.findByText('Annual Fire Safety Check')).toBeInTheDocument();
    expect(screen.getByText('Springfield')).toBeInTheDocument();
    expect(screen.getByText('All clear')).toBeInTheDocument();
    expect(screen.getByText('Replace smoke detector batteries')).toBeInTheDocument();
    expect(screen.getByText('$350.00')).toBeInTheDocument();
    expect(screen.getByText('2025-09-01')).toBeInTheDocument();
    expect(await screen.findByText('Checked all extinguishers.')).toBeInTheDocument();
  });
});

describe('InspectionDetailPage role-aware mutation controls', () => {
  it('shows Edit/Delete and the add-note form for admin', async () => {
    useAuthMock.mockReturnValue({ profile: profile({ role: 'admin', clientId: null }) });
    getInspectionMock.mockResolvedValue(sampleInspection);
    renderPage();
    expect(await screen.findByText('Annual Fire Safety Check')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /edit/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add note/i })).toBeInTheDocument();
  });

  it('hides Edit/Delete for upload_notes but still allows adding notes', async () => {
    useAuthMock.mockReturnValue({ profile: profile({ role: 'upload_notes' }) });
    getInspectionMock.mockResolvedValue(sampleInspection);
    renderPage();
    expect(await screen.findByText('Annual Fire Safety Check')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /edit/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add note/i })).toBeInTheDocument();
  });

  it('is fully read-only for view_only — no Edit/Delete, no add-note form', async () => {
    useAuthMock.mockReturnValue({ profile: profile({ role: 'view_only' }) });
    getInspectionMock.mockResolvedValue(sampleInspection);
    renderPage();
    expect(await screen.findByText('Annual Fire Safety Check')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /edit/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /add note/i })).not.toBeInTheDocument();
  });
});

describe('InspectionDetailPage client isolation', () => {
  it('renders the API-enforced 403 as an error, never falling back to stale/partial data', async () => {
    useAuthMock.mockReturnValue({ profile: profile({ role: 'view_only', clientId: 'client-c' }) });
    getInspectionMock.mockRejectedValue(
      new ApiClientError(403, 'forbidden', 'This resource does not belong to your organization')
    );
    renderPage();
    expect(await screen.findByText(/could not load this inspection/i)).toBeInTheDocument();
    expect(screen.getByText(/does not belong to your organization/i)).toBeInTheDocument();
    expect(screen.queryByText('Annual Fire Safety Check')).not.toBeInTheDocument();
  });
});
