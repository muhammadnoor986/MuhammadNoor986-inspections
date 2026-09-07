import { z } from 'zod';
import { paginationQuerySchema } from './common.schema';

export const acknowledgementsListQuerySchema = paginationQuerySchema.pick({ page: true, pageSize: true, sortDir: true });

export type AcknowledgementsListQuery = z.infer<typeof acknowledgementsListQuerySchema>;
