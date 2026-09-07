import { Router } from 'express';
import { asyncHandler } from '../../lib/asyncHandler';
import { requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/rbac';
import { validate } from '../../middleware/validate';
import { clientsListQuerySchema, createClientSchema, updateClientSchema } from '../../schemas/clients.schema';
import { idParamSchema } from '../../schemas/common.schema';
import {
  activateClient,
  createClient,
  deactivateClient,
  getClientById,
  listClients,
  updateClient,
} from '../../services/clients.service';

export const clientsRouter = Router();

// Client management is globally admin-only. Unlike Projects/Inspections,
// there is no requireModule/client-ownership scoping here — an admin
// managing clients isn't scoped to any one client, they manage all of them.
clientsRouter.use(requireAuth, requireRole('admin'));

clientsRouter.get(
  '/',
  validate('query', clientsListQuerySchema),
  asyncHandler(async (req, res) => {
    const result = await listClients(req.query as any);
    res.json(result);
  })
);

clientsRouter.get(
  '/:id',
  validate('params', idParamSchema),
  asyncHandler(async (req, res) => {
    const client = await getClientById(req.params.id!);
    res.json({ client });
  })
);

clientsRouter.post(
  '/',
  validate('body', createClientSchema),
  asyncHandler(async (req, res) => {
    const client = await createClient(req.body);
    res.status(201).json({ client });
  })
);

clientsRouter.patch(
  '/:id',
  validate('params', idParamSchema),
  validate('body', updateClientSchema),
  asyncHandler(async (req, res) => {
    const client = await updateClient(req.params.id!, req.body);
    res.json({ client });
  })
);

clientsRouter.patch(
  '/:id/activate',
  validate('params', idParamSchema),
  asyncHandler(async (req, res) => {
    const client = await activateClient(req.params.id!);
    res.json({ client });
  })
);

clientsRouter.patch(
  '/:id/deactivate',
  validate('params', idParamSchema),
  asyncHandler(async (req, res) => {
    const client = await deactivateClient(req.params.id!);
    res.json({ client });
  })
);
