import { supabaseAdmin } from '../config/supabaseAdmin';
import { ApiError } from '../lib/ApiError';
import { mapDbError } from '../lib/dbErrors';
import { buildPaginationMeta, toRange, type PaginationMeta } from '../lib/pagination';
import type { CreateProjectInput, ProjectsListQuery, UpdateProjectInput } from '../schemas/projects.schema';

export interface Project {
  id: string;
  clientId: string;
  name: string;
  description: string | null;
  address: string | null;
  status: string;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

// DB rows are snake_case; the API contract is camelCase.
interface ProjectRow {
  id: string;
  client_id: string;
  name: string;
  description: string | null;
  address: string | null;
  status: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

function toProject(row: ProjectRow): Project {
  return {
    id: row.id,
    clientId: row.client_id,
    name: row.name,
    description: row.description,
    address: row.address,
    status: row.status,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Lists projects. `scopedClientId` is required for non-admin callers (their
 * own client) and optional for admins (undefined = all clients). Callers
 * decide that scoping — this function trusts whatever clientId it's given.
 */
export async function listProjects(
  query: ProjectsListQuery,
  scopedClientId: string | undefined
): Promise<{ items: Project[]; meta: PaginationMeta }> {
  const [from, to] = toRange(query);

  let builder = supabaseAdmin.from('projects').select('*', { count: 'exact' });

  if (scopedClientId) {
    builder = builder.eq('client_id', scopedClientId);
  }
  if (query.status) {
    builder = query.status.length === 1 ? builder.eq('status', query.status[0]) : builder.in('status', query.status);
  }
  if (query.search) {
    // Escape PostgREST's or()-filter syntax characters so a search term
    // containing them can't break out of the filter or match unintended rows.
    const term = query.search.replace(/[%,()]/g, '\\$&');
    builder = builder.or(`name.ilike.%${term}%,address.ilike.%${term}%`);
  }

  const { data, error, count } = await builder
    .order(query.sortBy, { ascending: query.sortDir === 'asc' })
    .range(from, to);

  if (error) throw mapDbError(error);

  return {
    items: (data as ProjectRow[]).map(toProject),
    meta: buildPaginationMeta(query, count ?? 0),
  };
}

export async function getProjectById(id: string): Promise<Project> {
  const { data, error } = await supabaseAdmin.from('projects').select('*').eq('id', id).maybeSingle();
  if (error) throw mapDbError(error);
  if (!data) throw ApiError.notFound('Project not found');
  return toProject(data as ProjectRow);
}

export async function createProject(input: CreateProjectInput, createdBy: string): Promise<Project> {
  const { data, error } = await supabaseAdmin
    .from('projects')
    .insert({
      client_id: input.clientId,
      name: input.name,
      description: input.description ?? null,
      address: input.address ?? null,
      status: input.status,
      created_by: createdBy,
    })
    .select('*')
    .single();

  if (error) throw mapDbError(error);
  return toProject(data as ProjectRow);
}

export async function updateProject(id: string, input: UpdateProjectInput): Promise<Project> {
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch.name = input.name;
  if (input.description !== undefined) patch.description = input.description;
  if (input.address !== undefined) patch.address = input.address;
  if (input.status !== undefined) patch.status = input.status;

  const { data, error } = await supabaseAdmin
    .from('projects')
    .update(patch)
    .eq('id', id)
    .select('*')
    .maybeSingle();

  if (error) throw mapDbError(error);
  if (!data) throw ApiError.notFound('Project not found');
  return toProject(data as ProjectRow);
}

export async function deleteProject(id: string): Promise<void> {
  const { error, count } = await supabaseAdmin
    .from('projects')
    .delete({ count: 'exact' })
    .eq('id', id);

  if (error) throw mapDbError(error);
  if (!count) throw ApiError.notFound('Project not found');
}
