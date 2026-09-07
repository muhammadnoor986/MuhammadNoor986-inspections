-- ============================================================================
-- Inspection due/overdue acknowledgement
-- ============================================================================
-- The traffic-light status itself (green/orange/red) is NOT stored anywhere
-- — it's computed at read time from inspections.next_inspection_date (see
-- apps/api/src/lib/dueStatus.ts), so it can never drift out of sync with
-- the date it's based on.
--
-- What DOES need storing is the acknowledgement event: "someone confirmed
-- they've seen this due/overdue inspection." That's a real fact about what
-- happened, not a derived value, and an inspection can cycle through
-- due -> acknowledged -> (date pushed out) -> due again over its life, so
-- this is a history table, not a single column on inspections.
-- ============================================================================

create table public.inspection_acknowledgements (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references public.inspections (id) on delete cascade,
  acknowledged_by uuid not null references public.profiles (id),
  acknowledged_at timestamptz not null default now(),
  -- Snapshot of the due date at the moment of acknowledgement, so a later
  -- change to next_inspection_date doesn't retroactively make an old
  -- acknowledgement look like it covered a due date it never saw.
  next_inspection_date_at_ack date
);

create index inspection_acknowledgements_inspection_id_idx
  on public.inspection_acknowledgements (inspection_id, acknowledged_at desc);

alter table public.inspection_acknowledgements enable row level security;

-- Same shape as notes: admins manage everything; client users (scoped via
-- the parent inspection's client + module access) may read; only Admin and
-- Upload & Notes may create one; nobody updates/deletes an acknowledgement
-- (it's an audit record).
create policy "admins manage acknowledgements"
  on public.inspection_acknowledgements for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "client users read permitted acknowledgements"
  on public.inspection_acknowledgements for select
  using (
    public.client_has_module(
      (select client_id from public.inspections where inspections.id = inspection_id),
      'inspections'
    )
    and (select client_id from public.inspections where inspections.id = inspection_id) = public.current_client_id()
  );

create policy "upload_notes users insert acknowledgements"
  on public.inspection_acknowledgements for insert
  with check (
    public.current_role() = 'upload_notes'
    and acknowledged_by = auth.uid()
    and (select client_id from public.inspections where inspections.id = inspection_id) = public.current_client_id()
    and public.client_has_module(
      (select client_id from public.inspections where inspections.id = inspection_id),
      'inspections'
    )
  );
