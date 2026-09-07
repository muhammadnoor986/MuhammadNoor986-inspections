import { supabaseAdmin } from '../config/supabaseAdmin';
import { ApiError } from '../lib/ApiError';
import { mapDbError } from '../lib/dbErrors';
import { computeDueStatus, dueStatusBoundaries, type DueStatus } from '../lib/dueStatus';
import { buildPaginationMeta, toRange, type PaginationMeta } from '../lib/pagination';
import type {
  CreateInspectionInput,
  InspectionsListQuery,
  UpdateInspectionInput,
} from '../schemas/inspections.schema';

export interface Inspection {
  id: string;
  clientId: string;
  projectId: string | null;
  title: string;
  inspectionDate: string | null;
  status: string;
  summary: string | null;
  suburb: string | null;
  suggestedWorks: string | null;
  remediationQuote: number | null;
  lastInspectionDate: string | null;
  nextInspectionDate: string | null;
  /** Traffic-light status — always derived from nextInspectionDate, never stored. See lib/dueStatus.ts. */
  dueStatus: DueStatus;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

// DB rows are snake_case; the API contract is camelCase.
interface InspectionRow {
  id: string;
  client_id: string;
  project_id: string | null;
  title: string;
  inspection_date: string | null;
  status: string;
  summary: string | null;
  suburb: string | null;
  suggested_works: string | null;
  remediation_quote: number | string | null;
  last_inspection_date: string | null;
  next_inspection_date: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

function toInspection(row: InspectionRow): Inspection {
  return {
    id: row.id,
    clientId: row.client_id,
    projectId: row.project_id,
    title: row.title,
    inspectionDate: row.inspection_date,
    status: row.status,
    summary: row.summary,
    suburb: row.suburb,
    suggestedWorks: row.suggested_works,
    // Postgres numeric columns come back as strings over the wire.
    remediationQuote: row.remediation_quote === null ? null : Number(row.remediation_quote),
    lastInspectionDate: row.last_inspection_date,
    nextInspectionDate: row.next_inspection_date,
    dueStatus: computeDueStatus(row.next_inspection_date),
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Verifies a project exists, belongs to `clientId`, and returns nothing —
 * used to keep inspection.project_id from pointing at another client's
 * project (the FK alone only guarantees the project exists, not who owns it).
 */
async function assertProjectBelongsToClient(projectId: string, clientId: string): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from('projects')
    .select('client_id')
    .eq('id', projectId)
    .maybeSingle();

  if (error) throw mapDbError(error);
  if (!data || data.client_id !== clientId) {
    throw ApiError.badRequest('projectId does not belong to the given client');
  }
}

/**
 * Lists inspections. `scopedClientId` is required for non-admin callers
 * (their own client) and optional for admins (undefined = all clients).
 * Callers decide that scoping — this function trusts whatever clientId
 * it's given.
 */
export async function listInspections(
  query: InspectionsListQuery,
  scopedClientId: string | undefined
): Promise<{ items: Inspection[]; meta: PaginationMeta }> {
  const [from, to] = toRange(query);

  let builder = supabaseAdmin.from('inspections').select('*', { count: 'exact' });

  if (scopedClientId) {
    builder = builder.eq('client_id', scopedClientId);
  }
  if (query.status) {
    builder = query.status.length === 1 ? builder.eq('status', query.status[0]) : builder.in('status', query.status);
  }
  if (query.projectId) {
    builder = builder.eq('project_id', query.projectId);
  }
  if (query.dateFrom) {
    builder = builder.gte('inspection_date', query.dateFrom);
  }
  if (query.dateTo) {
    builder = builder.lte('inspection_date', query.dateTo);
  }
  if (query.dueDateFrom) {
    builder = builder.gte('next_inspection_date', query.dueDateFrom);
  }
  if (query.dueDateTo) {
    builder = builder.lte('next_inspection_date', query.dueDateTo);
  }
  if (query.dueStatus) {
    const { todayIso, orangeEndIso } = dueStatusBoundaries();
    const statuses = new Set(query.dueStatus);
    const clauses: string[] = [];
    // Flattened OR clauses (green covers two disjoint ranges) — OR is
    // associative, so listing them as separate top-level clauses of the
    // same .or() is equivalent to nesting green's two conditions in their
    // own group.
    if (statuses.has('red')) clauses.push(`next_inspection_date.lt.${todayIso}`);
    if (statuses.has('orange')) {
      clauses.push(`and(next_inspection_date.gte.${todayIso},next_inspection_date.lte.${orangeEndIso})`);
    }
    if (statuses.has('green')) {
      clauses.push('next_inspection_date.is.null');
      clauses.push(`next_inspection_date.gt.${orangeEndIso}`);
    }
    builder = builder.or(clauses.join(','));
  }
  if (query.search) {
    // Escape PostgREST's or()-filter syntax characters so a search term
    // containing them can't break out of the filter or match unintended rows.
    const term = query.search.replace(/[%,()]/g, '\\$&');
    builder = builder.or(`title.ilike.%${term}%,suburb.ilike.%${term}%`);
  }

  const { data, error, count } = await builder
    .order(query.sortBy, { ascending: query.sortDir === 'asc' })
    .range(from, to);

  if (error) throw mapDbError(error);

  return {
    items: (data as InspectionRow[]).map(toInspection),
    meta: buildPaginationMeta(query, count ?? 0),
  };
}

export async function getInspectionById(id: string): Promise<Inspection> {
  const { data, error } = await supabaseAdmin.from('inspections').select('*').eq('id', id).maybeSingle();
  if (error) throw mapDbError(error);
  if (!data) throw ApiError.notFound('Inspection not found');
  return toInspection(data as InspectionRow);
}

export async function createInspection(
  input: CreateInspectionInput,
  createdBy: string
): Promise<Inspection> {
  if (input.projectId) {
    await assertProjectBelongsToClient(input.projectId, input.clientId);
  }

  const { data, error } = await supabaseAdmin
    .from('inspections')
    .insert({
      client_id: input.clientId,
      project_id: input.projectId ?? null,
      title: input.title,
      inspection_date: input.inspectionDate ?? null,
      status: input.status,
      summary: input.summary ?? null,
      suburb: input.suburb ?? null,
      suggested_works: input.suggestedWorks ?? null,
      remediation_quote: input.remediationQuote ?? null,
      last_inspection_date: input.lastInspectionDate ?? null,
      next_inspection_date: input.nextInspectionDate ?? null,
      created_by: createdBy,
    })
    .select('*')
    .single();

  if (error) throw mapDbError(error);
  return toInspection(data as InspectionRow);
}

export async function updateInspection(id: string, input: UpdateInspectionInput): Promise<Inspection> {
  if (input.projectId) {
    const existing = await getInspectionById(id);
    await assertProjectBelongsToClient(input.projectId, existing.clientId);
  }

  const patch: Record<string, unknown> = {};
  if (input.projectId !== undefined) patch.project_id = input.projectId;
  if (input.title !== undefined) patch.title = input.title;
  if (input.inspectionDate !== undefined) patch.inspection_date = input.inspectionDate;
  if (input.status !== undefined) patch.status = input.status;
  if (input.summary !== undefined) patch.summary = input.summary;
  if (input.suburb !== undefined) patch.suburb = input.suburb;
  if (input.suggestedWorks !== undefined) patch.suggested_works = input.suggestedWorks;
  if (input.remediationQuote !== undefined) patch.remediation_quote = input.remediationQuote;
  if (input.lastInspectionDate !== undefined) patch.last_inspection_date = input.lastInspectionDate;
  if (input.nextInspectionDate !== undefined) patch.next_inspection_date = input.nextInspectionDate;

  const { data, error } = await supabaseAdmin
    .from('inspections')
    .update(patch)
    .eq('id', id)
    .select('*')
    .maybeSingle();

  if (error) throw mapDbError(error);
  if (!data) throw ApiError.notFound('Inspection not found');
  return toInspection(data as InspectionRow);
}

export async function deleteInspection(id: string): Promise<void> {
  const { error, count } = await supabaseAdmin
    .from('inspections')
    .delete({ count: 'exact' })
    .eq('id', id);

  if (error) throw mapDbError(error);
  if (!count) throw ApiError.notFound('Inspection not found');
}
