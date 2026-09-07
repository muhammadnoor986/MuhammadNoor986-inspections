import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import { ApiError } from '../../lib/ApiError';
import { assertClientOwnership, requireModule, requireRole } from '../../middleware/rbac';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { idParamSchema } from '../../schemas/common.schema';
import { createProjectSchema, projectsListQuerySchema, updateProjectSchema } from '../../schemas/projects.schema';
import {
  createProject,
  deleteProject,
  getProjectById,
  listProjects,
  updateProject,
} from '../../services/projects.service';
import { buildAttachmentsRouter } from './attachments';

export const projectsRouter = Router();

projectsRouter.use(requireAuth, requireModule('projects'));

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

projectsRouter.get(
  '/',
  validate('query', projectsListQuerySchema),
  asyncHandler(async (req, res) => {
    const scopedClientId = resolveScopedClientId(req.user, req.query.clientId as string | undefined);
    const result = await listProjects(req.query as any, scopedClientId);
    res.json(result);
  })
);

projectsRouter.get(
  '/:id',
  validate('params', idParamSchema),
  asyncHandler(async (req, res) => {
    const project = await getProjectById(req.params.id!);
    assertClientOwnership(req.user!, project.clientId);
    res.json({ project });
  })
);

projectsRouter.post(
  '/',
  requireRole('admin'),
  validate('body', createProjectSchema),
  asyncHandler(async (req, res) => {
    const project = await createProject(req.body, req.user!.id);
    res.status(201).json({ project });
  })
);

projectsRouter.patch(
  '/:id',
  requireRole('admin'),
  validate('params', idParamSchema),
  validate('body', updateProjectSchema),
  asyncHandler(async (req, res) => {
    const project = await updateProject(req.params.id!, req.body);
    res.json({ project });
  })
);

projectsRouter.delete(
  '/:id',
  requireRole('admin'),
  validate('params', idParamSchema),
  asyncHandler(async (req, res) => {
    await deleteProject(req.params.id!);
    res.status(204).send();
  })
);

projectsRouter.use('/:id/attachments', buildAttachmentsRouter('project'));
