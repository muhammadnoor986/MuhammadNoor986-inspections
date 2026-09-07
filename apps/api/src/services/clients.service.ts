import { supabaseAdmin } from '../config/supabaseAdmin';
import { ApiError } from '../lib/ApiError';
import { mapDbError } from '../lib/dbErrors';
import { buildPaginationMeta, toRange, type PaginationMeta } from '../lib/pagination';
import type { ClientsListQuery, CreateClientInput, UpdateClientInput } from '../schemas/clients.schema';

export interface Client {
  id: string;
  name: string;
  canAccessProjects: boolean;
  canAccessInspections: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// DB rows are snake_case; the API contract is camelCase.
interface ClientRow {
  id: string;
  name: string;
  can_access_projects: boolean;
  can_access_inspections: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

function toClient(row: ClientRow): Client {
  return {
    id: row.id,
    name: row.name,
    canAccessProjects: row.can_access_projects,
    canAccessInspections: row.can_access_inspections,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listClients(query: ClientsListQuery): Promise<{ items: Client[]; meta: PaginationMeta }> {
  const [from, to] = toRange(query);

  let builder = supabaseAdmin.from('clients').select('*', { count: 'exact' });

  if (query.isActive !== undefined) {
    builder = builder.eq('is_active', query.isActive === 'true');
  }
  if (query.search) {
    // Escape PostgREST's or()-filter syntax characters so a search term
    // containing them can't break out of the filter or match unintended
    // rows — same escaping as the search filter in projects/inspections.
    const term = query.search.replace(/[%,()]/g, '\\$&');
    builder = builder.or(`name.ilike.%${term}%`);
  }

  const { data, error, count } = await builder
    .order(query.sortBy, { ascending: query.sortDir === 'asc' })
    .range(from, to);

  if (error) throw mapDbError(error);

  return {
    items: (data as ClientRow[]).map(toClient),
    meta: buildPaginationMeta(query, count ?? 0),
  };
}

export async function getClientById(id: string): Promise<Client> {
  const { data, error } = await supabaseAdmin.from('clients').select('*').eq('id', id).maybeSingle();
  if (error) throw mapDbError(error);
  if (!data) throw ApiError.notFound('Client not found');
  return toClient(data as ClientRow);
}

export async function createClient(input: CreateClientInput): Promise<Client> {
  const { data, error } = await supabaseAdmin
    .from('clients')
    .insert({
      name: input.name,
      can_access_projects: input.canAccessProjects,
      can_access_inspections: input.canAccessInspections,
      // Explicit, not caller-controlled — createClientSchema never accepts
      // isActive as input, so this can only ever be true. Set explicitly
      // (rather than relying solely on the column's own `default true` from
      // 0006_client_user_active_flags.sql) so behavior doesn't depend on
      // which driver/environment is doing the insert.
      is_active: true,
    })
    .select('*')
    .single();

  if (error) throw mapDbError(error);
  return toClient(data as ClientRow);
}

export async function updateClient(id: string, input: UpdateClientInput): Promise<Client> {
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.canAccessProjects !== undefined) patch.can_access_projects = input.canAccessProjects;
  if (input.canAccessInspections !== undefined) patch.can_access_inspections = input.canAccessInspections;

  const { data, error } = await supabaseAdmin
    .from('clients')
    .update(patch)
    .eq('id', id)
    .select('*')
    .maybeSingle();

  if (error) throw mapDbError(error);
  if (!data) throw ApiError.notFound('Client not found');
  return toClient(data as ClientRow);
}

async function setClientActive(id: string, isActive: boolean): Promise<Client> {
  // Setting is_active to the value it already has is a normal, successful
  // update (not an error) — activate/deactivate are idempotent by
  // construction, nothing extra needed here.
  const { data, error } = await supabaseAdmin
    .from('clients')
    .update({ is_active: isActive })
    .eq('id', id)
    .select('*')
    .maybeSingle();

  if (error) throw mapDbError(error);
  if (!data) throw ApiError.notFound('Client not found');
  return toClient(data as ClientRow);
}

export function activateClient(id: string): Promise<Client> {
  return setClientActive(id, true);
}

export function deactivateClient(id: string): Promise<Client> {
  return setClientActive(id, false);
}
