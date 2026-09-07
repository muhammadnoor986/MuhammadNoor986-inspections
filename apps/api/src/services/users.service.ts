import { env } from '../config/env';
import { supabaseAdmin } from '../config/supabaseAdmin';
import { ApiError } from '../lib/ApiError';
import { mapDbError } from '../lib/dbErrors';
import { logger } from '../lib/logger';
import { buildPaginationMeta, toRange, type PaginationMeta } from '../lib/pagination';
import type { InviteUserInput, UpdateUserInput, UsersListQuery } from '../schemas/users.schema';

export type UserRole = 'admin' | 'upload_notes' | 'view_only';

export interface ClientSummary {
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
  client: ClientSummary | null;
}

// DB rows are snake_case; the API contract is camelCase.
interface ProfileRow {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  client_id: string | null;
  provisioned: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface ClientRow {
  id: string;
  name: string;
  is_active: boolean;
}

function toClientSummary(row: ClientRow): ClientSummary {
  return { id: row.id, name: row.name, isActive: row.is_active };
}

function toUser(row: ProfileRow, client: ClientSummary | null): User {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    role: row.role,
    clientId: row.client_id,
    provisioned: row.provisioned,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    client,
  };
}

async function getClientSummary(clientId: string): Promise<ClientSummary | null> {
  const { data, error } = await supabaseAdmin.from('clients').select('id, name, is_active').eq('id', clientId).maybeSingle();
  if (error) throw mapDbError(error);
  return data ? toClientSummary(data as ClientRow) : null;
}

/** Throws if `clientId` doesn't reference a real (and, by default, active) client — mirrors assertProjectBelongsToClient's badRequest-not-notFound treatment of an invalid foreign reference in a request body. */
async function assertClientAssignable(clientId: string, opts: { requireActive: boolean }): Promise<void> {
  const { data, error } = await supabaseAdmin.from('clients').select('id, is_active').eq('id', clientId).maybeSingle();
  if (error) throw mapDbError(error);
  if (!data) throw ApiError.badRequest('clientId does not refer to an existing client');
  if (opts.requireActive && !data.is_active) {
    throw ApiError.badRequest('clientId refers to an inactive client');
  }
}

export async function listUsers(query: UsersListQuery): Promise<{ items: User[]; meta: PaginationMeta }> {
  const [from, to] = toRange(query);

  let builder = supabaseAdmin.from('profiles').select('*', { count: 'exact' });

  if (query.role) builder = builder.eq('role', query.role);
  if (query.clientId) builder = builder.eq('client_id', query.clientId);
  if (query.isActive !== undefined) builder = builder.eq('is_active', query.isActive === 'true');
  if (query.search) {
    // Escape PostgREST's or()-filter syntax characters so a search term
    // containing them can't break out of the filter or match unintended
    // rows — same escaping as the search filter in projects/inspections/clients.
    const term = query.search.replace(/[%,()]/g, '\\$&');
    builder = builder.or(`email.ilike.%${term}%,full_name.ilike.%${term}%`);
  }

  const { data, error, count } = await builder
    .order(query.sortBy, { ascending: query.sortDir === 'asc' })
    .range(from, to);

  if (error) throw mapDbError(error);

  const rows = data as ProfileRow[];

  // One batched lookup for the page's distinct clients rather than one
  // query per row — avoids N+1 while still giving each user a real client
  // summary (see ClientSummary).
  const clientIds = [...new Set(rows.map((row) => row.client_id).filter((id): id is string => id !== null))];
  const clientsById = new Map<string, ClientSummary>();
  if (clientIds.length > 0) {
    const { data: clientRows, error: clientsError } = await supabaseAdmin
      .from('clients')
      .select('id, name, is_active')
      .in('id', clientIds);
    if (clientsError) throw mapDbError(clientsError);
    for (const row of clientRows as ClientRow[]) {
      clientsById.set(row.id, toClientSummary(row));
    }
  }

  return {
    items: rows.map((row) => toUser(row, row.client_id ? (clientsById.get(row.client_id) ?? null) : null)),
    meta: buildPaginationMeta(query, count ?? 0),
  };
}

export async function getUserById(id: string): Promise<User> {
  const { data, error } = await supabaseAdmin.from('profiles').select('*').eq('id', id).maybeSingle();
  if (error) throw mapDbError(error);
  if (!data) throw ApiError.notFound('User not found');

  const row = data as ProfileRow;
  const client = row.client_id ? await getClientSummary(row.client_id) : null;
  return toUser(row, client);
}

async function findProfileIdByEmail(email: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin.from('profiles').select('id').eq('email', email).maybeSingle();
  if (error) throw mapDbError(error);
  return data ? (data as { id: string }).id : null;
}

/**
 * Invites a new user through Supabase Auth and provisions the profile the
 * existing handle_new_user() trigger creates for it. Sequence (mirrors the
 * required flow exactly):
 *   1. Validate the target client (non-admin roles only).
 *   2. Reject if a profile with this email already exists (409) — checked
 *      before ever calling Supabase Auth, so we never send a duplicate
 *      invite or depend on parsing Auth's own error format for this.
 *   3. supabaseAdmin.auth.admin.inviteUserByEmail() — creates auth.users;
 *      handle_new_user() fires and inserts an unprovisioned profiles row
 *      (role='view_only', client_id=NULL, provisioned=false — see
 *      0005_fix_profile_provisioning.sql).
 *   4. Update that same profile row with the real email/fullName/role/
 *      clientId and provisioned=true, isActive=true.
 * Never reports success unless step 4 actually found and updated a row.
 */
export async function inviteUser(input: InviteUserInput): Promise<User> {
  const clientId = input.role === 'admin' ? null : (input.clientId ?? null);

  if (input.role !== 'admin') {
    // Schema-level superRefine already guarantees clientId is present for
    // non-admin roles; this narrows it for TypeScript and re-validates it
    // actually exists/is active.
    await assertClientAssignable(clientId!, { requireActive: true });
  }

  const existingProfileId = await findProfileIdByEmail(input.email);
  if (existingProfileId) {
    throw new ApiError(409, 'conflict', 'A user with this email already exists');
  }

  const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(input.email, {
    redirectTo: `${env.WEB_APP_URL}/accept-invite`,
  });

  if (inviteError || !inviteData?.user) {
    // Auth invite failed outright — nothing was created, nothing to clean
    // up. Never report success here.
    throw new ApiError(502, 'invite_failed', 'Could not send the invitation. Please try again.');
  }

  const authUserId = inviteData.user.id;

  const { data: profileRow, error: profileError } = await supabaseAdmin
    .from('profiles')
    .update({
      email: input.email,
      full_name: input.fullName,
      role: input.role,
      client_id: clientId,
      provisioned: true,
      is_active: true,
    })
    .eq('id', authUserId)
    .select('*')
    .maybeSingle();

  if (profileError || !profileRow) {
    // Partial failure: the Auth account now exists, but we couldn't
    // provision its profile (e.g. the trigger didn't fire, or this update
    // raced with something else). Do NOT report success. There is no safe,
    // simple way to undo an Auth-side invite from here — Supabase Auth and
    // Postgres are separate systems and this repo deliberately avoids
    // building a cross-system transaction/rollback mechanism for it (see
    // task notes). The profile this left behind (if any) stays
    // provisioned=false, which requireAuth already refuses to authenticate
    // — it is not silently treated as success. Resolving a stuck invite
    // like this is a follow-up, not handled automatically here.
    throw new ApiError(
      500,
      'provisioning_failed',
      'The invitation was sent but the account could not be fully set up. Please contact support.'
    );
  }

  const client = clientId ? await getClientSummary(clientId) : null;
  return toUser(profileRow as ProfileRow, client);
}

export async function updateUser(id: string, input: UpdateUserInput): Promise<User> {
  const existing = await getUserById(id);

  const effectiveRole = input.role ?? existing.role;
  // Promoting someone to admin always clears their client, even if the
  // caller didn't explicitly send clientId: null — an admin can never keep
  // a stale client_id (admin_has_no_client).
  const effectiveClientId =
    input.role === 'admin' && input.clientId === undefined
      ? null
      : input.clientId !== undefined
        ? input.clientId
        : existing.clientId;

  if (effectiveRole === 'admin') {
    if (effectiveClientId) {
      throw ApiError.badRequest('Admins must not be assigned a client');
    }
  } else {
    if (!effectiveClientId) {
      throw ApiError.badRequest('clientId is required for this role');
    }
    // Only re-validate the client when it's actually changing — avoids a
    // redundant lookup on every unrelated field update.
    if (effectiveClientId !== existing.clientId) {
      await assertClientAssignable(effectiveClientId, { requireActive: true });
    }
  }

  const patch: Record<string, unknown> = {};
  if (input.fullName !== undefined) patch.full_name = input.fullName;
  if (input.role !== undefined) patch.role = input.role;
  if (effectiveClientId !== existing.clientId) patch.client_id = effectiveClientId;

  const { data, error } = await supabaseAdmin.from('profiles').update(patch).eq('id', id).select('*').maybeSingle();

  if (error) throw mapDbError(error);
  if (!data) throw ApiError.notFound('User not found');

  const row = data as ProfileRow;
  const client = row.client_id ? await getClientSummary(row.client_id) : null;
  return toUser(row, client);
}

/**
 * profiles.is_active is the application's source-of-truth flag (checked by
 * requireAuth on every request); the Supabase Auth ban is defense-in-depth
 * on top of it, not a replacement. The DB update is authoritative — if the
 * Auth call fails after it, the user is already correctly locked out at the
 * application layer, so this logs the inconsistency rather than reporting
 * a false failure for a database change that, in fact, succeeded.
 */
async function setUserActive(id: string, isActive: boolean): Promise<User> {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update({ is_active: isActive })
    .eq('id', id)
    .select('*')
    .maybeSingle();

  if (error) throw mapDbError(error);
  if (!data) throw ApiError.notFound('User not found');

  const row = data as ProfileRow;

  const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(id, {
    ban_duration: isActive ? 'none' : '876000h',
  });
  if (authError) {
    logger.error('profiles.is_active updated but the Supabase Auth ban could not be synced', {
      userId: id,
      isActive,
      authError,
    });
  }

  const client = row.client_id ? await getClientSummary(row.client_id) : null;
  return toUser(row, client);
}

export function activateUser(id: string): Promise<User> {
  return setUserActive(id, true);
}

export function deactivateUser(id: string): Promise<User> {
  return setUserActive(id, false);
}
