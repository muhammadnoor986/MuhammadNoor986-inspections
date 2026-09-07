import { apiFetch } from '../../../services/apiClient';
import type { Paginated } from '../../../types/api';
import type {
  Attachment,
  AttachmentParentKind,
  AttachmentsQuery,
  ConfirmUploadInput,
  PresignUploadInput,
  ReplaceAttachmentInput,
} from '../types/attachment';

// Thin wrapper around apps/api's nested /projects/:id/attachments and
// /inspections/:id/attachments routes (built from the same shared factory
// server-side — src/routes/v1/attachments.ts). No business logic here.

function basePath(parentKind: AttachmentParentKind, parentId: string): string {
  return `/${parentKind}s/${parentId}/attachments`;
}

export function listAttachments(
  parentKind: AttachmentParentKind,
  parentId: string,
  query: AttachmentsQuery
): Promise<Paginated<Attachment>> {
  return apiFetch<Paginated<Attachment>>(basePath(parentKind, parentId), { query: { ...query } });
}

export function presignAttachmentUpload(
  parentKind: AttachmentParentKind,
  parentId: string,
  input: PresignUploadInput
): Promise<{ key: string; uploadUrl: string }> {
  return apiFetch(`${basePath(parentKind, parentId)}/presign`, { method: 'POST', body: input });
}

export function confirmAttachmentUpload(
  parentKind: AttachmentParentKind,
  parentId: string,
  input: ConfirmUploadInput
): Promise<Attachment> {
  return apiFetch<{ attachment: Attachment }>(basePath(parentKind, parentId), { method: 'POST', body: input }).then(
    (res) => res.attachment
  );
}

export function getAttachmentDownloadUrl(
  parentKind: AttachmentParentKind,
  parentId: string,
  attachmentId: string
): Promise<string> {
  return apiFetch<{ url: string }>(`${basePath(parentKind, parentId)}/${attachmentId}/download`).then(
    (res) => res.url
  );
}

export function replaceAttachment(
  parentKind: AttachmentParentKind,
  parentId: string,
  attachmentId: string,
  input: ReplaceAttachmentInput
): Promise<Attachment> {
  return apiFetch<{ attachment: Attachment }>(`${basePath(parentKind, parentId)}/${attachmentId}/replace`, {
    method: 'PATCH',
    body: input,
  }).then((res) => res.attachment);
}

export function deleteAttachment(
  parentKind: AttachmentParentKind,
  parentId: string,
  attachmentId: string
): Promise<void> {
  return apiFetch<void>(`${basePath(parentKind, parentId)}/${attachmentId}`, { method: 'DELETE' });
}

/**
 * Uploads bytes directly to S3 via a presigned URL — never through our API.
 * Uses XHR (not fetch) because it's the only way to get upload progress
 * events in the browser.
 */
export function putFileToS3(uploadUrl: string, file: File, onProgress?: (percent: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', uploadUrl);
    xhr.setRequestHeader('Content-Type', file.type);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Upload to storage failed (status ${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error('Upload to storage failed'));
    xhr.send(file);
  });
}
