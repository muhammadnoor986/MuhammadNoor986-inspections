import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InspectionsTable } from '../src/features/inspections/components/InspectionsTable';
import { InspectionDetailPage } from '../src/features/inspections/pages/InspectionDetailPage';
import { InspectionsListPage } from '../src/features/inspections/pages/InspectionsListPage';
import type { Inspection } from '../src/features/inspections/types/inspection';
import { ApiClientError } from '../src/services/apiClient';
import type { Profile } from '../src/types/auth';

const useAuthMock = vi.fn();
vi.mock('../src/hooks/useAuth', () => ({ useAuth: () => useAuthMock() }));

const listInspectionsMock = vi.fn();
vi.mock('../src/features/inspections/services/inspectionsService', () => ({
  listInspections: (...args: unknown[]) => listInspectionsMock(...args),
  getInspection: vi.fn(),
  deleteInspection: vi.fn(),
}));

const listProjectsMock = vi.fn();
vi.mock('../src/features/projects/services/projectsService', () => ({
  listProjects: (...args: unknown[]) => listProjectsMock(...args),
  getProject: vi.fn(),
}));

vi.mock('../src/features/inspections/services/notesService', () => ({
  listInspectionNotes: vi.fn().mockResolvedValue({ items: [], meta: { page: 1, pageSize: 100, total: 0, totalPages: 1 } }),
  createInspectionNote: vi.fn(),
}));

const listAcknowledgementsMock = vi.fn();
const acknowledgeInspectionMock = vi.fn();
vi.mock('../src/features/inspections/services/acknowledgementsService', () => ({
  listAcknowledgements: (...args: unknown[]) => listAcknowledgementsMock(...args),
  acknowledgeInspection: (...args: unknown[]) => acknowledgeInspectionMock(...args),
}));

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

function inspection(overrides: Partial<Inspection>): Inspection {
  return {
    id: 'insp-1',
    clientId: 'client-a',
    projectId: null,
    title: 'Fire Safety Check',
    inspectionDate: '2026-03-01',
    status: 'scheduled',
    summary: null,
    suburb: 'Springfield',
    suggestedWorks: null,
    remediationQuote: null,
    lastInspectionDate: null,
    nextInspectionDate: null,
    dueStatus: 'green',
    createdBy: 'user-admin',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    ...overrides,
  };
}

beforeEach(() => {
  listInspectionsMock.mockReset();
  listProjectsMock.mockReset();
  listAcknowledgementsMock.mockReset();
  acknowledgeInspectionMock.mockReset();
  listProjectsMock.mockResolvedValue({ items: [], meta: { page: 1, pageSize: 100, total: 0, totalPages: 1 } });
  listAcknowledgementsMock.mockResolvedValue({ items: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 1 } });
});

describe('Traffic-light display', () => {
  it('renders the correct color/label for green, orange, and red', () => {
    render(
      <MemoryRouter>
        <InspectionsTable
          inspections={[
            inspection({ id: 'g', title: 'Green One', dueStatus: 'green' }),
            inspection({ id: 'o', title: 'Orange One', dueStatus: 'orange' }),
            inspection({ id: 'r', title: 'Red One', dueStatus: 'red' }),
          ]}
          projectAddressById={new Map()}
        />
      </MemoryRouter>
    );

    expect(screen.getByText('Up to date')).toBeInTheDocument();
    expect(screen.getByText('Due')).toBeInTheDocument();
    expect(screen.getByText('Overdue')).toBeInTheDocument();
  });
});

describe('Traffic-light filtering', () => {
  it('sends the selected dueStatus through to the API call', async () => {
    useAuthMock.mockReturnValue({ profile: profile({ role: 'admin', clientId: null }) });
    listInspectionsMock.mockResolvedValue({ items: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 1 } });

    render(
      <MemoryRouter>
        <InspectionsListPage />
      </MemoryRouter>
    );

    await screen.findByText(/no inspections/i);
    listInspectionsMock.mockClear();

    screen.getByRole('button', { name: /^overdue$/i }).click();

    await screen.findByText(/no inspections/i);
    expect(listInspectionsMock).toHaveBeenCalledWith(expect.objectContaining({ dueStatus: 'red' }));
  });
});

function renderDetail() {
  return render(
    <MemoryRouter initialEntries={['/inspections/insp-1']}>
      <Routes>
        <Route path="/inspections/:id" element={<InspectionDetailPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('Acknowledgement role behavior', () => {
  it('shows the Acknowledge action for admin when the inspection is overdue', async () => {
    useAuthMock.mockReturnValue({ profile: profile({ id: 'user-admin', role: 'admin', clientId: null }) });
    const { getInspection } = await import('../src/features/inspections/services/inspectionsService');
    vi.mocked(getInspection).mockResolvedValue(inspection({ dueStatus: 'red', nextInspectionDate: '2026-01-01' }));
    renderDetail();
    expect(await screen.findByText('Fire Safety Check')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^acknowledge$/i })).toBeInTheDocument();
  });

  it('shows the Acknowledge action for upload_notes when due', async () => {
    useAuthMock.mockReturnValue({ profile: profile({ id: 'user-upload-a', role: 'upload_notes' }) });
    const { getInspection } = await import('../src/features/inspections/services/inspectionsService');
    vi.mocked(getInspection).mockResolvedValue(inspection({ dueStatus: 'orange', nextInspectionDate: '2026-01-15' }));
    renderDetail();
    expect(await screen.findByText('Fire Safety Check')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^acknowledge$/i })).toBeInTheDocument();
  });

  it('never shows the Acknowledge action for view_only — must remain read-only', async () => {
    useAuthMock.mockReturnValue({ profile: profile({ id: 'user-view-a', role: 'view_only' }) });
    const { getInspection } = await import('../src/features/inspections/services/inspectionsService');
    vi.mocked(getInspection).mockResolvedValue(inspection({ dueStatus: 'red', nextInspectionDate: '2026-01-01' }));
    renderDetail();
    expect(await screen.findByText('Fire Safety Check')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^acknowledge$/i })).not.toBeInTheDocument();
  });

  it('hides the Acknowledge action when nothing is due (green) even for admin', async () => {
    useAuthMock.mockReturnValue({ profile: profile({ id: 'user-admin', role: 'admin', clientId: null }) });
    const { getInspection } = await import('../src/features/inspections/services/inspectionsService');
    vi.mocked(getInspection).mockResolvedValue(inspection({ dueStatus: 'green', nextInspectionDate: null }));
    renderDetail();
    expect(await screen.findByText('Fire Safety Check')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^acknowledge$/i })).not.toBeInTheDocument();
  });

  it('shows an error, not stale data, when acknowledging is denied by the API (e.g. cross-client)', async () => {
    useAuthMock.mockReturnValue({ profile: profile({ id: 'user-view-c', role: 'upload_notes', clientId: 'client-c' }) });
    const { getInspection } = await import('../src/features/inspections/services/inspectionsService');
    vi.mocked(getInspection).mockResolvedValue(inspection({ dueStatus: 'red', nextInspectionDate: '2026-01-01' }));
    acknowledgeInspectionMock.mockRejectedValue(
      new ApiClientError(403, 'forbidden', 'This resource does not belong to your organization')
    );
    renderDetail();
    const button = await screen.findByRole('button', { name: /^acknowledge$/i });
    button.click();
    expect(await screen.findByText(/could not record acknowledgement/i)).toBeInTheDocument();
    expect(screen.getByText(/does not belong to your organization/i)).toBeInTheDocument();
  });
});
