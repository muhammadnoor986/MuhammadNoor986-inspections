import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AttachmentSection } from '../src/features/attachments/components/AttachmentSection';
import type { Attachment } from '../src/features/attachments/types/attachment';
import { ApiClientError } from '../src/services/apiClient';
import type { Profile } from '../src/types/auth';

const useAuthMock = vi.fn();
vi.mock('../src/hooks/useAuth', () => ({ useAuth: () => useAuthMock() }));

const listAttachmentsMock = vi.fn();
const deleteAttachmentMock = vi.fn();
vi.mock('../src/features/attachments/services/attachmentsService', () => ({
  listAttachments: (...args: unknown[]) => listAttachmentsMock(...args),
  deleteAttachment: (...args: unknown[]) => deleteAttachmentMock(...args),
  presignAttachmentUpload: vi.fn(),
  confirmAttachmentUpload: vi.fn(),
  replaceAttachment: vi.fn(),
  getAttachmentDownloadUrl: vi.fn().mockResolvedValue('https://s3.mock.example/download'),
  putFileToS3: vi.fn(),
}));

function profile(overrides: Partial<Profile>): Profile {
  return {
    id: 'user-view-a',
    email: 'user@test.dev',
    role: 'view_only',
    clientId: 'client-a',
    canAccessProjects: true,
    canAccessInspections: true,
    ...overrides,
  };
}

function attachment(overrides: Partial<Attachment>): Attachment {
  return {
    id: 'attachment-1',
    parentKind: 'project',
    parentId: 'project-1',
    kind: 'photo',
    category: 'before',
    storagePath: 'client-a/project/project-1/mock-front.jpg',
    fileName: 'front.jpg',
    contentType: 'image/jpeg',
    fileSize: 102_400,
    uploadedBy: 'user-admin',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function renderSection() {
  return render(
    <AttachmentSection
      parentKind="project"
      parentId="project-1"
      kind="photo"
      category="before"
      title="Before"
      emptyMessage="No before photos yet."
    />
  );
}

beforeEach(() => {
  listAttachmentsMock.mockReset();
  deleteAttachmentMock.mockReset();
});

describe('AttachmentSection role-aware controls', () => {
  it('lets admin upload and modify any attachment, including ones uploaded by someone else', async () => {
    useAuthMock.mockReturnValue({ profile: profile({ id: 'user-admin', role: 'admin', clientId: null }) });
    listAttachmentsMock.mockResolvedValue({
      items: [attachment({ uploadedBy: 'someone-else' })],
      meta: { page: 1, pageSize: 100, total: 1, totalPages: 1 },
    });
    renderSection();
    expect(await screen.findByText('front.jpg')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /upload/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /replace/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
  });

  it('lets upload_notes upload and modify only their own uploads', async () => {
    useAuthMock.mockReturnValue({ profile: profile({ id: 'user-upload-a', role: 'upload_notes' }) });
    listAttachmentsMock.mockResolvedValue({
      items: [attachment({ id: 'own', uploadedBy: 'user-upload-a' }), attachment({ id: 'others', uploadedBy: 'user-admin' })],
      meta: { page: 1, pageSize: 100, total: 2, totalPages: 1 },
    });
    renderSection();
    expect(await screen.findAllByText('front.jpg')).toHaveLength(2);
    expect(screen.getByRole('button', { name: /upload/i })).toBeInTheDocument();
    // Exactly one card (the caller's own) exposes Replace/Delete.
    expect(screen.getAllByRole('button', { name: /^replace$/i })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: /^delete$/i })).toHaveLength(1);
  });

  it('is fully read-only for view_only — no upload control, no replace/delete on any item', async () => {
    useAuthMock.mockReturnValue({ profile: profile({ id: 'user-view-a', role: 'view_only' }) });
    listAttachmentsMock.mockResolvedValue({
      items: [attachment({ uploadedBy: 'user-view-a' })],
      meta: { page: 1, pageSize: 100, total: 1, totalPages: 1 },
    });
    renderSection();
    expect(await screen.findByText('front.jpg')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /upload/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /replace/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
  });
});

describe('AttachmentSection loading/empty/error states', () => {
  it('shows a loading state before data arrives', () => {
    useAuthMock.mockReturnValue({ profile: profile({}) });
    listAttachmentsMock.mockReturnValue(new Promise(() => {}));
    renderSection();
    expect(screen.getByText(/loading before/i)).toBeInTheDocument();
  });

  it('shows an empty state when there are no attachments', async () => {
    useAuthMock.mockReturnValue({ profile: profile({}) });
    listAttachmentsMock.mockResolvedValue({ items: [], meta: { page: 1, pageSize: 100, total: 0, totalPages: 1 } });
    renderSection();
    expect(await screen.findByText('No before photos yet.')).toBeInTheDocument();
  });

  it('shows an error state on a client-isolation / permission denial from the API', async () => {
    useAuthMock.mockReturnValue({ profile: profile({ clientId: 'client-c' }) });
    listAttachmentsMock.mockRejectedValue(
      new ApiClientError(403, 'forbidden', 'This resource does not belong to your organization')
    );
    renderSection();
    expect(await screen.findByText(/could not load before/i)).toBeInTheDocument();
    expect(screen.getByText(/does not belong to your organization/i)).toBeInTheDocument();
    expect(screen.queryByText('front.jpg')).not.toBeInTheDocument();
  });
});
