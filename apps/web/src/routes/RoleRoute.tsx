import { Navigate, Outlet } from 'react-router-dom';
import { ErrorMessage } from '../components/ErrorMessage';
import { LoadingScreen } from '../components/LoadingScreen';
import { useAuth } from '../hooks/useAuth';
import type { Module, UserRole } from '../types/auth';

export interface RoleRouteProps {
  /** If set, only these roles may pass. Omit to allow any authenticated role. */
  roles?: UserRole[];
  /** If set, the caller's client must have this module enabled (admins always pass — mirrors requireModule in apps/api). */
  module?: Module;
}

/**
 * Gates a route by the profile loaded from GET /api/v1/me — mirrors
 * requireRole/requireModule in apps/api/src/middleware/rbac.ts. This is a
 * UX convenience only; the API re-enforces every one of these checks
 * server-side regardless of what this component decides.
 */
export function RoleRoute({ roles, module }: RoleRouteProps) {
  const { profile, profileError } = useAuth();

  if (profileError) {
    return <ErrorMessage title="Could not load your profile" message={profileError} />;
  }

  if (!profile) {
    return <LoadingScreen label="Loading your profile…" />;
  }

  if (roles && !roles.includes(profile.role)) {
    return <Navigate to="/unauthorized" replace />;
  }

  if (module && profile.role !== 'admin') {
    const hasAccess = module === 'projects' ? profile.canAccessProjects : profile.canAccessInspections;
    if (!hasAccess) {
      return <Navigate to="/unauthorized" replace />;
    }
  }

  return <Outlet />;
}
