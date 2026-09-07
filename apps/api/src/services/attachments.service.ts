import { supabaseAdmin } from '../config/supabaseAdmin';
import { ApiError } from '../lib/ApiError';
import { mapDbError } from '../lib/dbErrors';
import { buildPaginationMeta, toRange, type PaginationMeta } from '../lib/pagination';
import { deleteObject, type ParentKind } from '../lib/s3';
import type { AttachmentsListQuery, ConfirmAttachmentInput, ReplaceAttachmentInput } from '../schemas/attachments.schema';

export type AttachmentKind = 'photo' | 'document';
export type PhotoCategory = 'before' | 'progress' | 'completion';

export interface Attachment {
  id: string;
  parentKind: ParentKind;
  parentId: string;
  kind: AttachmentKind;
  category: PhotoCategory | null;
  storagePath: string;
  fileName: string;
  contentType: string | null;
  fileSize: number | null;
  uploadedBy: string | null;
  createdAt: string;
}

interface AttachmentRow {
  id: string;
  parent_kind: ParentKind;
  parent_id: string;
  kind: AttachmentKind;
  category: PhotoCategory | null;
  storage_path: string;
  file_name: string;
  content_type: string | null;
  file_size: number | null;
  uploaded_by: string | null;
  created_at: string;
}

function toAttachment(row: AttachmentRow): Attachment {
  return {
    id: row.id,
    parentKind: row.parent_kind,
    parentId: row.parent_id,
    kind: row.kind,
    category: row.category,
    storagePath: row.storage_path,
    fileName: row.file_name,
    contentType: row.content_type,
    fileSize: row.file_size,
    uploadedBy: row.uploaded_by,
    createdAt: row.created_at,
  };
}

export async function listAttachments(
  parentKind: ParentKind,
  parentId: string,
  query: AttachmentsListQuery
): Promise<{ items: Attachment[]; meta: PaginationMeta }> {
  const [from, to] = toRange(query);

  let builder = supabaseAdmin
    .from('attachments')
    .select('*', { count: 'exact' })
    .eq('parent_kind', parentKind)
    .eq('parent_id', parentId);

  if (query.kind) builder = builder.eq('kind', query.kind);
  if (query.category) builder = builder.eq('category', query.category);

  const { data, error, count } = await builder.order('created_at', { ascending: query.sortDir === 'asc' }).range(from, to);

  if (error) throw mapDbError(error);

  return {
    items: (data as AttachmentRow[]).map(toAttachment),
    meta: buildPaginationMeta(query, count ?? 0),
  };
}

export async function getAttachmentById(id: string): Promise<Attachment> {
  const { data, error } = await supabaseAdmin.from('attachments').select('*').eq('id', id).maybeSingle();
  if (error) throw mapDbError(error);
  if (!data) throw ApiError.notFound('Attachment not found');
  return toAttachment(data as AttachmentRow);
}

/** Guards against operating on an attachment through the wrong parent's nested route. */
export function assertAttachmentBelongsToParent(attachment: Attachment, parentKind: ParentKind, parentId: string): void {
  if (attachment.parentKind !== parentKind || attachment.parentId !== parentId) {
    throw ApiError.notFound('Attachment not found');
  }
}

/**
 * The client is only ever handed the key the server generated for it via
 * presign — this re-checks that the key it claims to have uploaded to
 * actually falls under this client/parent's own S3 prefix, so a confirm
 * call can't register metadata pointing at an object outside its scope.
 */
export function assertKeyBelongsToPrefix(key: string, clientId: string, parentKind: ParentKind, parentId: string): void {
  const prefix = `${clientId}/${parentKind}/${parentId}/`;
  if (!key.startsWith(prefix)) {
    throw ApiError.badRequest('Upload key does not match this attachment\'s expected location');
  }
}

export async function createAttachment(
  parentKind: ParentKind,
  parentId: string,
  clientId: string,
  input: ConfirmAttachmentInput,
  uploadedBy: string
): Promise<Attachment> {
  assertKeyBelongsToPrefix(input.key, clientId, parentKind, parentId);

  const { data, error } = await supabaseAdmin
    .from('attachments')
    .insert({
      parent_kind: parentKind,
      parent_id: parentId,
      kind: input.kind,
      category: input.category ?? null,
      storage_path: input.key,
      file_name: input.fileName,
      content_type: input.contentType,
      file_size: input.fileSize,
      uploaded_by: uploadedBy,
    })
    .select('*')
    .single();

  if (error) throw mapDbError(error);
  return toAttachment(data as AttachmentRow);
}

export async function replaceAttachment(
  attachment: Attachment,
  clientId: string,
  input: ReplaceAttachmentInput
): Promise<Attachment> {
  assertKeyBelongsToPrefix(input.key, clientId, attachment.parentKind, attachment.parentId);

  const { data, error } = await supabaseAdmin
    .from('attachments')
    .update({
      storage_path: input.key,
      file_name: input.fileName,
      content_type: input.contentType,
      file_size: input.fileSize,
    })
    .eq('id', attachment.id)
    .select('*')
    .maybeSingle();

  if (error) throw mapDbError(error);
  if (!data) throw ApiError.notFound('Attachment not found');

  // Best-effort cleanup of the object it replaced — the DB row (the source
  // of truth for what's "current") is already updated either way.
  await deleteObject(attachment.storagePath).catch(() => undefined);

  return toAttachment(data as AttachmentRow);
}

export async function deleteAttachment(attachment: Attachment): Promise<void> {
  const { error, count } = await supabaseAdmin.from('attachments').delete({ count: 'exact' }).eq('id', attachment.id);
  if (error) throw mapDbError(error);
  if (!count) throw ApiError.notFound('Attachment not found');

  await deleteObject(attachment.storagePath).catch(() => undefined);
}
