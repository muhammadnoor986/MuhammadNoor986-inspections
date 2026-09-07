// Mirrors Project / CreateProjectInput / UpdateProjectInput / ProjectsListQuery
// in apps/api/src/services/projects.service.ts and schemas/projects.schema.ts.

export type ProjectStatus = 'active' | 'on_hold' | 'completed' | 'archived';

export const PROJECT_STATUSES: ProjectStatus[] = ['active', 'on_hold', 'completed', 'archived'];

export interface Project {
  id: string;
  clientId: string;
  name: string;
  description: string | null;
  address: string | null;
  status: ProjectStatus;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ProjectSortField = 'created_at' | 'updated_at' | 'name' | 'status' | 'address';

export interface ProjectsQuery {
  page?: number;
  pageSize?: number;
  sortBy?: ProjectSortField;
  sortDir?: 'asc' | 'desc';
  /** Single status ("completed") or comma-separated list ("active,on_hold") — see apps/api's statusFilterSchema. */
  status?: ProjectStatus | string;
  search?: string;
  /** Admin-only: the API ignores this for non-admin callers, who are always scoped to their own client. */
  clientId?: string;
}

export interface CreateProjectInput {
  clientId: string;
  name: string;
  description?: string;
  address?: string;
  status?: ProjectStatus;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  address?: string;
  status?: ProjectStatus;
}
