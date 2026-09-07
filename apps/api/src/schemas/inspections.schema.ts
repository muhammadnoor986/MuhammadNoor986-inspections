import { z } from 'zod';
import { paginationQuerySchema } from './common.schema';

export const inspectionStatusEnum = z.enum(['scheduled', 'in_progress', 'completed', 'cancelled']);
export const dueStatusEnum = z.enum(['green', 'orange', 'red']);

// Same shape as statusFilterSchema below — single value or comma-separated list.
const dueStatusFilterSchema = z
  .string()
  .transform((value) => value.split(',').map((part) => part.trim()))
  .pipe(z.array(dueStatusEnum).min(1));

// Same shape as projects' statusFilterSchema — accepts a single status or a
// comma-separated list (e.g. "scheduled,in_progress" for a "current" filter).
const statusFilterSchema = z
  .string()
  .transform((value) => value.split(',').map((part) => part.trim()))
  .pipe(z.array(inspectionStatusEnum).min(1));

export const inspectionsListQuerySchema = paginationQuerySchema.extend({
  sortBy: z
    .enum(['created_at', 'updated_at', 'inspection_date', 'status', 'next_inspection_date'])
    .default('created_at'),
  status: statusFilterSchema.optional(),
  projectId: z.string().uuid().optional(),
  dateFrom: z.string().date().optional(),
  dateTo: z.string().date().optional(),
  // Filters on next_inspection_date — the inspection's due date.
  dueDateFrom: z.string().date().optional(),
  dueDateTo: z.string().date().optional(),
  // Traffic-light filter — single value or comma-separated list (e.g.
  // "orange,red"). Derived from next_inspection_date; see lib/dueStatus.ts.
  dueStatus: dueStatusFilterSchema.optional(),
  // Matches against title and suburb (case-insensitive substring). See
  // listInspections() in services/inspections.service.ts.
  search: z.string().trim().min(1).max(200).optional(),
  // Only honored for admins; ignored for client users, who are always
  // scoped to their own client (see routes/v1/inspections.ts).
  clientId: z.string().uuid().optional(),
});

export const createInspectionSchema = z.object({
  clientId: z.string().uuid(),
  projectId: z.string().uuid().optional(),
  title: z.string().min(1).max(200),
  inspectionDate: z.string().date().optional(),
  status: inspectionStatusEnum.default('scheduled'),
  summary: z.string().max(5000).optional(),
  suburb: z.string().max(200).optional(),
  suggestedWorks: z.string().max(5000).optional(),
  remediationQuote: z.number().nonnegative().max(999999999.99).optional(),
  lastInspectionDate: z.string().date().optional(),
  nextInspectionDate: z.string().date().optional(),
});

// clientId is intentionally excluded, same reasoning as projects.
export const updateInspectionSchema = z
  .object({
    projectId: z.string().uuid().nullable(),
    title: z.string().min(1).max(200),
    inspectionDate: z.string().date().nullable(),
    status: inspectionStatusEnum,
    summary: z.string().max(5000).nullable(),
    suburb: z.string().max(200).nullable(),
    suggestedWorks: z.string().max(5000).nullable(),
    remediationQuote: z.number().nonnegative().max(999999999.99).nullable(),
    lastInspectionDate: z.string().date().nullable(),
    nextInspectionDate: z.string().date().nullable(),
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, { message: 'At least one field is required' });

export type CreateInspectionInput = z.infer<typeof createInspectionSchema>;
export type UpdateInspectionInput = z.infer<typeof updateInspectionSchema>;
export type InspectionsListQuery = z.infer<typeof inspectionsListQuerySchema>;
