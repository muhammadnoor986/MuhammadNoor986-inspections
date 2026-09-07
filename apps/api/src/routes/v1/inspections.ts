import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import { ApiError } from '../../lib/ApiError';
import { assertClientOwnership, requireModule, requireRole } from '../../middleware/rbac';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { idParamSchema } from '../../schemas/common.schema';
import {
  createInspectionSchema,
  inspectionsListQuerySchema,
  updateInspectionSchema,
} from '../../schemas/inspections.schema';
import { acknowledgementsListQuerySchema } from '../../schemas/acknowledgements.schema';
import { createNoteSchema, notesListQuerySchema } from '../../schemas/notes.schema';
import { createAcknowledgement, listAcknowledgements } from '../../services/acknowledgements.service';
import {
  createInspection,
  deleteInspection,
  getInspectionById,
  listInspections,
  updateInspection,
} from '../../services/inspections.service';
import { createNote, listNotesForParent } from '../../services/notes.service';
import { buildAttachmentsRouter } from './attachments';

export const inspectionsRouter = Router();

inspectionsRouter.use(requireAuth, requireModule('inspections'));

/**
 * Resolves which client(s) a list/get request is scoped to. Non-admins are
 * always pinned to their own client, regardless of any clientId they pass —
 * the query schema only *lets* admins use that filter.
 */
function resolveScopedClientId(user: Express.Request['user'], queryClientId?: string): string | undefined {
  if (!user) throw ApiError.unauthorized();
  if (user.role === 'admin') return queryClientId;
  if (!user.clientId) throw ApiError.forbidden('No client associated with this account');
  return user.clientId;
}

inspectionsRouter.get(
  '/',
  validate('query', inspectionsListQuerySchema),
  asyncHandler(async (req, res) => {
    const scopedClientId = resolveScopedClientId(req.user, req.query.clientId as string | undefined);
    const result = await listInspections(req.query as any, scopedClientId);
    res.json(result);
  })
);

inspectionsRouter.get(
  '/:id',
  validate('params', idParamSchema),
  asyncHandler(async (req, res) => {
    const inspection = await getInspectionById(req.params.id!);
    assertClientOwnership(req.user!, inspection.clientId);
    res.json({ inspection });
  })
);

inspectionsRouter.post(
  '/',
  requireRole('admin'),
  validate('body', createInspectionSchema),
  asyncHandler(async (req, res) => {
    const inspection = await createInspection(req.body, req.user!.id);
    res.status(201).json({ inspection });
  })
);

inspectionsRouter.patch(
  '/:id',
  requireRole('admin'),
  validate('params', idParamSchema),
  validate('body', updateInspectionSchema),
  asyncHandler(async (req, res) => {
    const inspection = await updateInspection(req.params.id!, req.body);
    res.json({ inspection });
  })
);

inspectionsRouter.delete(
  '/:id',
  requireRole('admin'),
  validate('params', idParamSchema),
  asyncHandler(async (req, res) => {
    await deleteInspection(req.params.id!);
    res.status(204).send();
  })
);

// Notes/comments on an inspection. Read is available to anyone with access
// to the inspection; adding a note matches the role spec — Admin and
// Upload & Notes may add notes, View Only may not (see requireRole below).
inspectionsRouter.get(
  '/:id/notes',
  validate('params', idParamSchema),
  validate('query', notesListQuerySchema),
  asyncHandler(async (req, res) => {
    const inspection = await getInspectionById(req.params.id!);
    assertClientOwnership(req.user!, inspection.clientId);
    const result = await listNotesForParent('inspection', req.params.id!, req.query as any);
    res.json(result);
  })
);

inspectionsRouter.post(
  '/:id/notes',
  requireRole('admin', 'upload_notes'),
  validate('params', idParamSchema),
  validate('body', createNoteSchema),
  asyncHandler(async (req, res) => {
    const inspection = await getInspectionById(req.params.id!);
    assertClientOwnership(req.user!, inspection.clientId);
    const note = await createNote('inspection', req.params.id!, req.body.body, req.user!.id);
    res.status(201).json({ note });
  })
);

// Due/overdue acknowledgement — an audit trail ("someone has seen this"),
// separate from the traffic-light color itself (which stays purely
// date-derived; see lib/dueStatus.ts). Same role split as notes: Admin and
// Upload & Notes may acknowledge, View Only may not.
inspectionsRouter.get(
  '/:id/acknowledgements',
  validate('params', idParamSchema),
  validate('query', acknowledgementsListQuerySchema),
  asyncHandler(async (req, res) => {
    const inspection = await getInspectionById(req.params.id!);
    assertClientOwnership(req.user!, inspection.clientId);
    const result = await listAcknowledgements(req.params.id!, req.query as any);
    res.json(result);
  })
);

inspectionsRouter.post(
  '/:id/acknowledge',
  requireRole('admin', 'upload_notes'),
  validate('params', idParamSchema),
  asyncHandler(async (req, res) => {
    const inspection = await getInspectionById(req.params.id!);
    assertClientOwnership(req.user!, inspection.clientId);
    const acknowledgement = await createAcknowledgement(req.params.id!, req.user!.id, inspection.nextInspectionDate);
    res.status(201).json({ acknowledgement });
  })
);

inspectionsRouter.use('/:id/attachments', buildAttachmentsRouter('inspection'));
