import type { NextFunction, Request, Response } from 'express';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { env } from '../config/env';
import { supabaseAdmin } from '../config/supabaseAdmin';
import { ApiError } from '../lib/ApiError';

export type UserRole = 'admin' | 'upload_notes' | 'view_only';

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
  clientId: string | null;
  canAccessProjects: boolean;
  canAccessInspections: boolean;
}

interface SupabaseAccessTokenPayload {
  sub: string;
  email?: string;
  aud?: string;
  exp?: number;
}

// Row shape returned by the profiles+clients join below. provisioned/is_active
// (both profiles.* and clients.is_active) exist purely to gate access in
// loadProfile() below — requireAuth rejects on them before req.user is ever
// attached, so they intentionally don't appear on AuthenticatedUser itself.
interface ProfileRow {
  id: string;
  email: string;
  role: UserRole;
  client_id: string | null;
  provisioned: boolean;
  is_active: boolean;
  clients: { can_access_projects: boolean; can_access_inspections: boolean; is_active: boolean } | null;
}

function extractBearerToken(req: Request): string {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw ApiError.unauthorized('Missing bearer token');
  }
  return header.slice('Bearer '.length).trim();
}

// Newer Supabase projects sign access tokens with an asymmetric key (ES256)
// rather than the legacy shared HS256 "JWT secret" — verifying against that
// secret would reject every token regardless of its value. createRemoteJWKSet
// fetches the project's public signing key(s) from its JWKS endpoint once and
// caches/auto-refreshes them, so verification here never needs a shared secret.
const jwks = createRemoteJWKSet(new URL(`${env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`));

async function verifySupabaseJwt(token: string): Promise<SupabaseAccessTokenPayload> {
  try {
    const { payload } = await jwtVerify(token, jwks);
    return payload as SupabaseAccessTokenPayload;
  } catch {
    throw ApiError.unauthorized('Invalid or expired token');
  }
}

// Single generic rejection for every "this JWT doesn't map to a usable
// account" case below — deliberately identical whether the profile is
// missing, unprovisioned, deactivated, or its client is deactivated, so a
// caller can't distinguish which, or infer that a given user/client exists
// at all, from the response alone.
function rejectUnusableAccount(): never {
  throw ApiError.unauthorized('No profile found for this user');
}

async function loadProfile(userId: string): Promise<AuthenticatedUser> {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select(
      'id, email, role, client_id, provisioned, is_active, clients ( can_access_projects, can_access_inspections, is_active )'
    )
    .eq('id', userId)
    .single<ProfileRow>();

  if (error || !data) {
    rejectUnusableAccount();
  }

  // A profile exists the instant auth.users does (handle_new_user()), but
  // isn't usable until an admin finishes assigning it a real role/client —
  // see 0005_fix_profile_provisioning.sql.
  if (!data.provisioned) {
    rejectUnusableAccount();
  }

  if (!data.is_active) {
    rejectUnusableAccount();
  }

  // Admins have no client_id by design (admin_has_no_client) and so have no
  // client to check. Every other role requires one, and that client must
  // itself be active — mirrors the existing client_user_has_client invariant
  // at the authentication layer.
  if (data.role !== 'admin') {
    if (!data.client_id || !data.clients) {
      rejectUnusableAccount();
    }
    if (!data.clients.is_active) {
      rejectUnusableAccount();
    }
  }

  return {
    id: data.id,
    email: data.email,
    role: data.role,
    clientId: data.client_id,
    // Admins have no client row; module access is irrelevant for them since
    // requireModule() always allows admins regardless of these flags.
    canAccessProjects: data.clients?.can_access_projects ?? false,
    canAccessInspections: data.clients?.can_access_inspections ?? false,
  };
}

/**
 * Verifies the Supabase-issued JWT against the project's public signing key
 * (fetched once and cached by `jwks`, not on every request), loads the
 * caller's profile, and rejects unless it is provisioned, active, and
 * (for non-admins) belongs to an active client — see loadProfile(). Only
 * then is the trimmed profile attached to req.user. Must run before any
 * requireRole/requireModule middleware.
 */
export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const token = extractBearerToken(req);
    const payload = await verifySupabaseJwt(token);
    req.user = await loadProfile(payload.sub);
    next();
  } catch (err) {
    next(err);
  }
}
