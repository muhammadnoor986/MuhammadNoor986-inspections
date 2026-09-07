import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import { requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import { idParamSchema } from '../../schemas/common.schema';
import { inviteUserSchema, updateUserSchema, usersListQuerySchema } from '../../schemas/users.schema';
import {
  activateUser,
  deactivateUser,
  getUserById,
  inviteUser,
  listUsers,
  updateUser,
} from '../../services/users.service';

export const usersRouter = Router();

// User management is globally admin-only, same shape as clients.ts — no
// requireModule/client-ownership scoping, an admin here isn't scoped to any
// one client.
usersRouter.use(requireAuth, requireRole('admin'));

usersRouter.get(
  '/',
  validate('query', usersListQuerySchema),
  asyncHandler(async (req, res) => {
    const result = await listUsers(req.query as any);
    res.json(result);
  })
);

// Must be registered before GET/PATCH '/:id' — Express matches routes by
// exact path shape, so a POST to '/invite' (a different method entirely
// from the '/:id' GETs/PATCHes below) is never at risk of being parsed as
// id="invite" regardless of declaration order, but keeping it grouped here
// with the rest of the collection-level routes (matching '/') documents
// that intent explicitly.
usersRouter.post(
  '/invite',
  validate('body', inviteUserSchema),
  asyncHandler(async (req, res) => {
    const user = await inviteUser(req.body);
    res.status(201).json({ user });
  })
);

usersRouter.get(
  '/:id',
  validate('params', idParamSchema),
  asyncHandler(async (req, res) => {
    const user = await getUserById(req.params.id!);
    res.json({ user });
  })
);

usersRouter.patch(
  '/:id',
  validate('params', idParamSchema),
  validate('body', updateUserSchema),
  asyncHandler(async (req, res) => {
    const user = await updateUser(req.params.id!, req.body);
    res.json({ user });
  })
);

usersRouter.patch(
  '/:id/activate',
  validate('params', idParamSchema),
  asyncHandler(async (req, res) => {
    const user = await activateUser(req.params.id!);
    res.json({ user });
  })
);

usersRouter.patch(
  '/:id/deactivate',
  validate('params', idParamSchema),
  asyncHandler(async (req, res) => {
    const user = await deactivateUser(req.params.id!);
    res.json({ user });
  })
);
