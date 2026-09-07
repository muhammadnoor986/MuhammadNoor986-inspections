import { z } from 'zod';
import { paginationQuerySchema } from './common.schema';

// Same three roles as middleware/auth.ts's UserRole — defined locally like
// every other resource-specific enum in this repo (projectStatusEnum,
// inspectionStatusEnum, ...) rather than cross-importing from middleware.
export const userRoleEnum = z.enum(['admin', 'upload_notes', 'view_only']);

export const usersListQuerySchema = paginationQuerySchema.extend({
  sortBy: z.enum(['created_at', 'updated_at', 'email', 'full_name']).default('created_at'),
  // Matches against email and full name (case-insensitive substring).
  search: z.string().trim().min(1).max(200).optional(),
  role: userRoleEnum.optional(),
  clientId: z.string().uuid().optional(),
  isActive: z.enum(['true', 'false']).optional(),
});

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('email must be a valid email address');

const fullNameSchema = z.string().trim().min(1, 'fullName is required').max(200);

/**
 * Enforces the same admin/client invariant the database does
 * (admin_has_no_client / client_user_has_client from 0001_init.sql):
 * admins must have no client, everyone else must have one. This can only be
 * checked once both `role` and `clientId` are known, hence superRefine
 * rather than a plain per-field check.
 */
function checkRoleClientInvariant(
  data: { role: string; clientId?: string | null },
  ctx: z.RefinementCtx
): void {
  if (data.role === 'admin') {
    if (data.clientId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['clientId'], message: 'Admins must not be assigned a client' });
    }
  } else if (!data.clientId) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['clientId'], message: 'clientId is required for this role' });
  }
}

export const inviteUserSchema = z
  .object({
    email: emailSchema,
    fullName: fullNameSchema,
    role: userRoleEnum,
    clientId: z.string().uuid().nullable().optional(),
  })
  .superRefine(checkRoleClientInvariant);

// email/provisioned/isActive are intentionally excluded — email changes are
// out of scope for this endpoint, and provisioned/isActive have their own
// dedicated behavior (activate/deactivate; provisioned is never
// caller-settable at all). clientId is nullable (to let an update move
// someone *to* admin) but not optional-nullable the way invite's is, since
// "no change" here is expressed by omitting the key entirely, same as every
// other partial-update schema in this repo.
export const updateUserSchema = z
  .object({
    fullName: fullNameSchema,
    role: userRoleEnum,
    clientId: z.string().uuid().nullable(),
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, { message: 'At least one field is required' });

export type InviteUserInput = z.infer<typeof inviteUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UsersListQuery = z.infer<typeof usersListQuerySchema>;
