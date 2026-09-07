-- ============================================================================
-- Attachment metadata fields
-- ============================================================================
-- The original attachments table (0001_init.sql) stores just enough to
-- prove the model: parent, kind, storage_path, file_name, uploader. The
-- attachment API (apps/api/src/routes/v1/attachments.ts) needs a bit more:
-- content_type (to reissue correct presigned GET headers), file_size (for
-- UI display and basic sanity checks), and category — the Before /
-- Progress / Completion grouping for project photo galleries. category is
-- only meaningful for project photos; it's simply unused for everything
-- else, so no CHECK constraint ties it to parent_kind/kind.
--
-- No RLS changes needed — existing policies on attachments (0001_init.sql)
-- are column-agnostic and already cover these.
-- ============================================================================

create type public.photo_category as enum ('before', 'progress', 'completion');

alter table public.attachments
  add column content_type text,
  add column file_size bigint,
  add column category public.photo_category;
