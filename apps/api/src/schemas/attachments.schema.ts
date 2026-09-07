import { z } from 'zod';
import { paginationQuerySchema } from './common.schema';

export const attachmentKindEnum = z.enum(['photo', 'document']);
export const photoCategoryEnum = z.enum(['before', 'progress', 'completion']);

const PHOTO_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/gif'];
const DOCUMENT_CONTENT_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

export function isAllowedContentType(kind: 'photo' | 'document', contentType: string): boolean {
  return (kind === 'photo' ? PHOTO_CONTENT_TYPES : DOCUMENT_CONTENT_TYPES).includes(contentType);
}

export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024; // 25MB

export const attachmentsListQuerySchema = paginationQuerySchema.pick({ page: true, pageSize: true, sortDir: true }).extend({
  kind: attachmentKindEnum.optional(),
  category: photoCategoryEnum.optional(),
});

const fileNameSchema = z.string().trim().min(1).max(255);
const contentTypeSchema = z.string().min(1).max(100);

export const presignUploadSchema = z
  .object({
    fileName: fileNameSchema,
    contentType: contentTypeSchema,
    kind: attachmentKindEnum,
    category: photoCategoryEnum.optional(),
  })
  .refine((data) => isAllowedContentType(data.kind, data.contentType), {
    message: 'Unsupported content type for this attachment kind',
    path: ['contentType'],
  });

export const confirmAttachmentSchema = z
  .object({
    key: z.string().min(1).max(1024),
    fileName: fileNameSchema,
    contentType: contentTypeSchema,
    fileSize: z.number().int().positive().max(MAX_ATTACHMENT_BYTES),
    kind: attachmentKindEnum,
    category: photoCategoryEnum.optional(),
  })
  .refine((data) => isAllowedContentType(data.kind, data.contentType), {
    message: 'Unsupported content type for this attachment kind',
    path: ['contentType'],
  });

export const replaceAttachmentSchema = z.object({
  key: z.string().min(1).max(1024),
  fileName: fileNameSchema,
  contentType: contentTypeSchema,
  fileSize: z.number().int().positive().max(MAX_ATTACHMENT_BYTES),
});

export const attachmentIdParamSchema = z.object({
  id: z.string().uuid(),
  attachmentId: z.string().uuid(),
});

export type AttachmentsListQuery = z.infer<typeof attachmentsListQuerySchema>;
export type PresignUploadInput = z.infer<typeof presignUploadSchema>;
export type ConfirmAttachmentInput = z.infer<typeof confirmAttachmentSchema>;
export type ReplaceAttachmentInput = z.infer<typeof replaceAttachmentSchema>;
