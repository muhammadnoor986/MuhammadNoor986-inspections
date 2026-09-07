// Mirrors User / InviteUserInput / UpdateUserInput / UsersListQuery in
// apps/api/src/services/users.service.ts and schemas/users.schema.ts.
import type { UserRole } from '../../../types/auth';

export type { UserRole };

export const USER_ROLES: UserRole[] = ['admin', 'upload_notes', 'view_only'];

export interface UserClientSummary {
  id: string;
  name: string;
  isActive: boolean;
}

export interface User {
  id: string;
  email: string;
  fullName: string | null;
  role: UserRole;
  clientId: string | null;
  provisioned: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  client: UserClientSummary | null;
}

export type UserSortField = 'created_at' | 'updated_at' | 'email' | 'full_name';

export interface UsersQuery {
  page?: number;
  pageSize?: number;
  sortBy?: UserSortField;
  sortDir?: 'asc' | 'desc';
  search?: string;
  role?: UserRole;
  clientId?: string;
  isActive?: 'true' | 'false';
}

export interface InviteUserInput {
  email: string;
  fullName: string;
  role: UserRole;
  /** Omit or undefined for role: 'admin' — required otherwise. */
  clientId?: string;
}

// email/provisioned/isActive are intentionally excluded — see UpdateUserInput's
// counterpart on the API side for why.
export interface UpdateUserInput {
  fullName?: string;
  role?: UserRole;
  clientId?: string | null;
}
