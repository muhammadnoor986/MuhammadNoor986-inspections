import { z } from 'zod';
import { paginationQuerySchema } from './common.schema';

export const projectStatusEnum = z.enum(['active', 'on_hold', 'completed', 'archived']);

// Accepts either a single status ("completed") or a comma-separated list
// ("active,on_hold") — the latter is what the web UI's "Current" filter
// sends, since "current" spans more than one status value.
const statusFilterSchema = z
  .string()
  .transform((value) => value.split(',').map((part) => part.trim()))
  .pipe(z.array(projectStatusEnum).min(1));

export const projectsListQuerySchema = paginationQuerySchema.extend({
  sortBy: z.enum(['created_at', 'updated_at', 'name', 'status', 'address']).default('created_at'),
  status: statusFilterSchema.optional(),
  // Matches against name and address (case-insensitive substring). See
  // listProjects() in services/projects.service.ts for how it's applied.
  search: z.string().trim().min(1).max(200).optional(),
  // Only honored for admins; ignored for client users, who are always
  // scoped to their own client (see routes/v1/projects.ts).
  clientId: z.string().uuid().optional(),
});

export const createProjectSchema = z.object({
  clientId: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  address: z.string().max(500).optional(),
  status: projectStatusEnum.default('active'),
});

// clientId is intentionally excluded — reassigning a project to a different
// client is not supported through this endpoint.
export const updateProjectSchema = z
  .object({
    name: z.string().min(1).max(200),
    description: z.string().max(5000),
    address: z.string().max(500),
    status: projectStatusEnum,
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, { message: 'At least one field is required' });

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type ProjectsListQuery = z.infer<typeof projectsListQuerySchema>;
