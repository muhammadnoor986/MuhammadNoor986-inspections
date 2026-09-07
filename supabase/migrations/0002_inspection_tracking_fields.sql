-- ============================================================================
-- Inspection tracking fields
-- ============================================================================
-- Adds the columns the Inspections UI needs beyond the original foundation
-- schema: suburb (property address itself still comes from the linked
-- project — see projects.address), remediation tracking, and the
-- last/next inspection dates used to compute an inspection's
-- overdue/upcoming status (computed in the API/UI, not stored).
--
-- No RLS changes needed: these are plain columns on a table RLS already
-- covers (see "admins manage inspections" / "client users read permitted
-- inspections" in 0001_init.sql).
-- ============================================================================

alter table public.inspections
  add column suburb text,
  add column suggested_works text,
  add column remediation_quote numeric(12, 2),
  add column last_inspection_date date,
  add column next_inspection_date date;

comment on column public.inspections.suggested_works is 'Suggested remediation works / notes from the inspection report.';
comment on column public.inspections.remediation_quote is 'Quoted cost for remediation work, if any.';
comment on column public.inspections.next_inspection_date is 'When the next inspection is due — drives the overdue/upcoming indicator.';
