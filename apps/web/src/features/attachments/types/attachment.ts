// Mirrors Attachment in apps/api/src/services/attachments.service.ts and the
// nested /projects/:id/attachments, /inspections/:id/attachments routes.

export type AttachmentParentKind = 'project' | 'inspection';
export type AttachmentKind = 'photo' | 'document';
export type PhotoCategory = 'before' | 'progress' | 'completion';

export const PHOTO_CATEGORIES: PhotoCategory[] = ['before', 'progress', 'completion'];

export interface Attachment {
  id: string;
  parentKind: AttachmentParentKind;
  parentId: string;
  kind: AttachmentKind;
  category: PhotoCategory | null;
  storagePath: string;
  fileName: string;
  contentType: string | null;
  fileSize: number | null;
  uploadedBy: string | null;
  createdAt: string;
}

export interface AttachmentsQuery {
  page?: number;
  pageSize?: number;
  sortDir?: 'asc' | 'desc';
  kind?: AttachmentKind;
  category?: PhotoCategory;
}

export interface PresignUploadInput {
  fileName: string;
  contentType: string;
  kind: AttachmentKind;
  category?: PhotoCategory;
}

export interface ConfirmUploadInput extends PresignUploadInput {
  key: string;
  fileSize: number;
}

export interface ReplaceAttachmentInput {
  key: string;
  fileName: string;
  contentType: string;
  fileSize: number;
}
