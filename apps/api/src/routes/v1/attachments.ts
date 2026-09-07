import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import { ApiError } from '../../lib/ApiError';
import { assertClientOwnership, requireRole } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import {
  attachmentIdParamSchema,
  attachmentsListQuerySchema,
  confirmAttachmentSchema,
  isAllowedContentType,
  presignUploadSchema,
  replaceAttachmentSchema,
} from '../../schemas/attachments.schema';
import { idParamSchema } from '../../schemas/common.schema';
import {
  assertAttachmentBelongsToParent,
  createAttachment,
  deleteAttachment,
  getAttachmentById,
  listAttachments,
  replaceAttachment,
} from '../../services/attachments.service';
import { getInspectionById } from '../../services/inspections.service';
import { getProjectById } from '../../services/projects.service';
import { buildAttachmentKey, createDownloadUrl, createUploadUrl, type ParentKind } from '../../lib/s3';

async function loadParent(parentKind: ParentKind, id: string): Promise<{ clientId: string }> {
  return parentKind === 'project' ? getProjectById(id) : getInspectionById(id);
}

/**
 * Only the uploader (or an admin) may delete/replace an attachment —
 * mirrors the "upload_notes users delete own attachments" RLS policy in
 * 0001_init.sql. Admins bypass via requireRole already having let them in;
 * this only needs to stop a non-admin from touching someone else's upload.
 */
function assertCanModify(user: Express.Request['user'], uploadedBy: string | null): void {
  if (user!.role === 'admin') return;
  if (uploadedBy !== user!.id) {
    throw ApiError.forbidden('You can only modify your own uploads');
  }
}

/**
 * Builds a nested attachments router for a given parent resource kind.
 * Mounted at `/projects/:id/attachments` and `/inspections/:id/attachments`
 * — both parent routers already apply requireAuth + requireModule, so this
 * only adds attachment-specific role/ownership checks on top.
 */
export function buildAttachmentsRouter(parentKind: ParentKind) {
  const router = Router({ mergeParams: true });

  router.get(
    '/',
    validate('params', idParamSchema),
    validate('query', attachmentsListQuerySchema),
    asyncHandler(async (req, res) => {
      const parent = await loadParent(parentKind, req.params.id!);
      assertClientOwnership(req.user!, parent.clientId);
      const result = await listAttachments(parentKind, req.params.id!, req.query as any);
      res.json(result);
    })
  );

  router.post(
    '/presign',
    requireRole('admin', 'upload_notes'),
    validate('params', idParamSchema),
    validate('body', presignUploadSchema),
    asyncHandler(async (req, res) => {
      const parent = await loadParent(parentKind, req.params.id!);
      assertClientOwnership(req.user!, parent.clientId);
      const key = buildAttachmentKey({
        clientId: parent.clientId,
        parentKind,
        parentId: req.params.id!,
        fileName: req.body.fileName,
      });
      const uploadUrl = await createUploadUrl(key, req.body.contentType);
      res.json({ key, uploadUrl });
    })
  );

  router.post(
    '/',
    requireRole('admin', 'upload_notes'),
    validate('params', idParamSchema),
    validate('body', confirmAttachmentSchema),
    asyncHandler(async (req, res) => {
      const parent = await loadParent(parentKind, req.params.id!);
      assertClientOwnership(req.user!, parent.clientId);
      const attachment = await createAttachment(parentKind, req.params.id!, parent.clientId, req.body, req.user!.id);
      res.status(201).json({ attachment });
    })
  );

  router.get(
    '/:attachmentId/download',
    validate('params', attachmentIdParamSchema),
    asyncHandler(async (req, res) => {
      const parent = await loadParent(parentKind, req.params.id!);
      assertClientOwnership(req.user!, parent.clientId);
      const attachment = await getAttachmentById(req.params.attachmentId!);
      assertAttachmentBelongsToParent(attachment, parentKind, req.params.id!);
      const url = await createDownloadUrl(attachment.storagePath);
      res.json({ url });
    })
  );

  router.patch(
    '/:attachmentId/replace',
    requireRole('admin', 'upload_notes'),
    validate('params', attachmentIdParamSchema),
    validate('body', replaceAttachmentSchema),
    asyncHandler(async (req, res) => {
      const parent = await loadParent(parentKind, req.params.id!);
      assertClientOwnership(req.user!, parent.clientId);
      const attachment = await getAttachmentById(req.params.attachmentId!);
      assertAttachmentBelongsToParent(attachment, parentKind, req.params.id!);
      assertCanModify(req.user, attachment.uploadedBy);
      if (!isAllowedContentType(attachment.kind, req.body.contentType)) {
        throw ApiError.badRequest('Unsupported content type for this attachment kind');
      }
      const updated = await replaceAttachment(attachment, parent.clientId, req.body);
      res.json({ attachment: updated });
    })
  );

  router.delete(
    '/:attachmentId',
    requireRole('admin', 'upload_notes'),
    validate('params', attachmentIdParamSchema),
    asyncHandler(async (req, res) => {
      const parent = await loadParent(parentKind, req.params.id!);
      assertClientOwnership(req.user!, parent.clientId);
      const attachment = await getAttachmentById(req.params.attachmentId!);
      assertAttachmentBelongsToParent(attachment, parentKind, req.params.id!);
      assertCanModify(req.user, attachment.uploadedBy);
      await deleteAttachment(attachment);
      res.status(204).send();
    })
  );

  return router;
}
