// Mirrors Client / CreateClientInput / UpdateClientInput / ClientsListQuery
// in apps/api/src/services/clients.service.ts and schemas/clients.schema.ts.

export interface Client {
  id: string;
  name: string;
  canAccessProjects: boolean;
  canAccessInspections: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ClientSortField = 'created_at' | 'updated_at' | 'name';

export interface ClientsQuery {
  page?: number;
  pageSize?: number;
  sortBy?: ClientSortField;
  sortDir?: 'asc' | 'desc';
  search?: string;
  isActive?: 'true' | 'false';
}

export interface CreateClientInput {
  name: string;
  canAccessProjects: boolean;
  canAccessInspections: boolean;
}

// isActive is intentionally excluded — only activate/deactivate may change it.
export interface UpdateClientInput {
  name?: string;
  canAccessProjects?: boolean;
  canAccessInspections?: boolean;
}
