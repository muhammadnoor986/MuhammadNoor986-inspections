import { supabaseAdmin } from '../config/supabaseAdmin';
import { mapDbError } from '../lib/dbErrors';
import { buildPaginationMeta, toRange, type PaginationMeta } from '../lib/pagination';
import type { ParentKind } from '../lib/s3';
import type { NotesListQuery } from '../schemas/notes.schema';

export interface Note {
  id: string;
  parentKind: ParentKind;
  parentId: string;
  body: string;
  createdBy: string | null;
  authorEmail: string | null;
  createdAt: string;
}

interface NoteRow {
  id: string;
  parent_kind: ParentKind;
  parent_id: string;
  body: string;
  created_by: string | null;
  created_at: string;
  profiles: { email: string } | null;
}

function toNote(row: NoteRow): Note {
  return {
    id: row.id,
    parentKind: row.parent_kind,
    parentId: row.parent_id,
    body: row.body,
    createdBy: row.created_by,
    authorEmail: row.profiles?.email ?? null,
    createdAt: row.created_at,
  };
}

export async function listNotesForParent(
  parentKind: ParentKind,
  parentId: string,
  query: NotesListQuery
): Promise<{ items: Note[]; meta: PaginationMeta }> {
  const [from, to] = toRange(query);

  const { data, error, count } = await supabaseAdmin
    .from('notes')
    .select('id, parent_kind, parent_id, body, created_by, created_at, profiles ( email )', { count: 'exact' })
    .eq('parent_kind', parentKind)
    .eq('parent_id', parentId)
    .order('created_at', { ascending: query.sortDir === 'asc' })
    .range(from, to);

  if (error) throw mapDbError(error);

  return {
    items: (data as unknown as NoteRow[]).map(toNote),
    meta: buildPaginationMeta(query, count ?? 0),
  };
}

export async function createNote(
  parentKind: ParentKind,
  parentId: string,
  body: string,
  createdBy: string
): Promise<Note> {
  const { data, error } = await supabaseAdmin
    .from('notes')
    .insert({ parent_kind: parentKind, parent_id: parentId, body, created_by: createdBy })
    .select('id, parent_kind, parent_id, body, created_by, created_at, profiles ( email )')
    .single();

  if (error) throw mapDbError(error);
  return toNote(data as unknown as NoteRow);
}
