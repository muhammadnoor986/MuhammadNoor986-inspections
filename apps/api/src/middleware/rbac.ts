import type { NextFunction, Request, Response } from 'express';
import { ApiError } from '../lib/ApiError';
import type { AuthenticatedUser, UserRole } from './auth';

/** Restricts a route to the given roles. Must run after requireAuth. */
export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(ApiError.unauthorized());
    }
    if (!roles.includes(req.user.role)) {
      return next(ApiError.forbidden(`Requires role: ${roles.join(' or ')}`));
    }
    next();
  };
}

/**
 * Restricts a route to callers whose client has the given module enabled.
 * Admins always pass, since they act across all clients/modules.
 * Must run after requireAuth.
 */
export function requireModule(module: 'projects' | 'inspections') {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(ApiError.unauthorized());
    }
    if (req.user.role === 'admin') {
      return next();
    }
    const hasAccess =
      module === 'projects' ? req.user.canAccessProjects : req.user.canAccessInspections;
    if (!hasAccess) {
      return next(ApiError.forbidden(`Your client does not have access to ${module}`));
    }
    next();
  };
}

/**
 * Resource-level ownership check: does this user (or admin) have access to a
 * row belonging to `resourceClientId`? Call this from route handlers after
 * fetching the resource, once Projects/Inspections/Attachments routes exist —
 * it can't be expressed as generic middleware since it depends on the fetched
 * row, not just the URL.
 */
export function assertClientOwnership(user: AuthenticatedUser, resourceClientId: string) {
  if (user.role === 'admin') {
    return;
  }
  if (user.clientId !== resourceClientId) {
    throw ApiError.forbidden('This resource does not belong to your organization');
  }
}
