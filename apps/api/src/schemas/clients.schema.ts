import { z } from 'zod';
import { paginationQuerySchema } from './common.schema';

export const clientsListQuerySchema = paginationQuerySchema.extend({
  sortBy: z.enum(['created_at', 'updated_at', 'name']).default('created_at'),
  // Matches against name (case-insensitive substring).
  search: z.string().trim().min(1).max(200).optional(),
  isActive: z.enum(['true', 'false']).optional(),
});

// The API contract is camelCase everywhere else in this repo (see e.g.
// AuthenticatedUser.canAccessProjects in middleware/auth.ts, or clientId on
// every Project/Inspection) — canAccessProjects/canAccessInspections here
// follow that same convention rather than the clients table's own
// snake_case column names, which the service layer maps to/from.
export const createClientSchema = z.object({
  name: z.string().trim().min(1, 'name is required').max(200),
  canAccessProjects: z.boolean(),
  canAccessInspections: z.boolean(),
});

// isActive is intentionally excluded — only the dedicated activate/deactivate
// endpoints may change it (see routes/v1/clients.ts).
export const updateClientSchema = z
  .object({
    name: z.string().trim().min(1, 'name is required').max(200),
    canAccessProjects: z.boolean(),
    canAccessInspections: z.boolean(),
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, { message: 'At least one field is required' });

export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
export type ClientsListQuery = z.infer<typeof clientsListQuerySchema>;
