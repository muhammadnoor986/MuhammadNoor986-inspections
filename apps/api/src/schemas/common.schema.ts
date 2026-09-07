import { z } from 'zod';

export const idParamSchema = z.object({
  id: z.string().uuid('id must be a valid UUID'),
});

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
});
