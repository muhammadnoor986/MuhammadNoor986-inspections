// Mirrors AuthenticatedUser / UserRole in apps/api/src/middleware/auth.ts —
// this is the shape returned by GET /api/v1/me. The web app never derives
// role or access from the Supabase session itself; it always asks the API,
// which is the single source of truth for RBAC.
export type UserRole = 'admin' | 'upload_notes' | 'view_only';

export interface Profile {
  id: string;
  email: string;
  role: UserRole;
  clientId: string | null;
  canAccessProjects: boolean;
  canAccessInspections: boolean;
}

export type Module = 'projects' | 'inspections';
