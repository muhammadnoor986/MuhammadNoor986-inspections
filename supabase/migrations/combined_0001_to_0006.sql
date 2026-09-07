-- ============================================================================
-- Inspection Platform - Initial Schema, RBAC, and Row Level Security
-- ============================================================================
-- Model summary:
--   * clients            -> customer companies. Each client is switched on for
--                            the "projects" module, "inspections" module, or both.
--   * profiles           -> one row per auth.users row. Internal staff have
--                            role = 'admin' and client_id = null (see everything).
--                            Client-side portal users have client_id set and
--                            role in ('upload_notes', 'view_only').
--   * projects           -> belongs to a client.
--   * inspections        -> belongs to a client, optionally linked to a project.
--   * attachments         -> photos/documents attached to a project or inspection.
--   * notes               -> free-text notes attached to a project or inspection.
--
-- Access control is enforced twice, independently:
--   1. The Node.js API (apps/api) verifies the caller's Supabase-issued JWT
--      and enforces role/module/client-ownership rules in application code,
--      using the Supabase secret key (formerly branded "service_role key" —
--      same elevated, RLS-bypassing credential, new dashboard label). That
--      secret key must never reach web/mobile.
--   2. Postgres Row Level Security, defined below, enforces the same rules
--      independently as defense-in-depth — e.g. against a bug in the API's
--      authorization code, or any future/alternate access path that uses a
--      per-user Supabase session instead of the API's secret-key connection.
--      Note RLS provides no protection against a compromised or buggy secret
--      key connection itself, since that key bypasses RLS by design; it
--      protects everything else.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------------
create type public.user_role as enum ('admin', 'upload_notes', 'view_only');
create type public.parent_kind as enum ('project', 'inspection');
create type public.attachment_kind as enum ('photo', 'document');

-- ----------------------------------------------------------------------------
-- clients
-- ----------------------------------------------------------------------------
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  can_access_projects boolean not null default false,
  can_access_inspections boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- profiles (1:1 with auth.users)
-- ----------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  role public.user_role not null default 'view_only',
  -- null client_id = internal staff (only meaningful for role = 'admin')
  client_id uuid references public.clients (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint admin_has_no_client check (
    role <> 'admin' or client_id is null
  ),
  constraint client_user_has_client check (
    role = 'admin' or client_id is not null
  )
);

-- Auto-create a profile row whenever a new auth user signs up.
-- Role/client assignment defaults to view_only/no client; an admin must
-- update it afterwards (see profiles RLS below).
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- projects
-- ----------------------------------------------------------------------------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  name text not null,
  description text,
  address text,
  status text not null default 'active',
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- inspections
-- ----------------------------------------------------------------------------
create table public.inspections (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  project_id uuid references public.projects (id) on delete set null,
  title text not null,
  inspection_date date,
  status text not null default 'scheduled',
  summary text,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- attachments (photos & documents/reports)
-- ----------------------------------------------------------------------------
create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  parent_kind public.parent_kind not null,
  parent_id uuid not null,
  kind public.attachment_kind not null,
  storage_path text not null,
  file_name text not null,
  uploaded_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- notes
-- ----------------------------------------------------------------------------
create table public.notes (
  id uuid primary key default gen_random_uuid(),
  parent_kind public.parent_kind not null,
  parent_id uuid not null,
  body text not null,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Helper functions used by RLS policies
-- ----------------------------------------------------------------------------

-- Current user's profile role. Returns null if no session.
create function public.current_role()
returns public.user_role
language sql stable security definer set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false);
$$;

create function public.current_client_id()
returns uuid
language sql stable security definer set search_path = public
as $$
  select client_id from public.profiles where id = auth.uid();
$$;

-- True if the calling user's client is switched on for the given module
-- ('projects' | 'inspections'). Admins always pass.
create function public.client_has_module(target_client_id uuid, module text)
returns boolean
language sql stable security definer set search_path = public
as $$
  select
    public.is_admin()
    or exists (
      select 1
      from public.profiles p
      join public.clients c on c.id = p.client_id
      where p.id = auth.uid()
        and p.client_id = target_client_id
        and (
          (module = 'projects' and c.can_access_projects)
          or (module = 'inspections' and c.can_access_inspections)
        )
    );
$$;

-- Resolves the owning client_id for an attachment/note parent row.
create function public.parent_client_id(p_kind public.parent_kind, p_id uuid)
returns uuid
language sql stable security definer set search_path = public
as $$
  select case p_kind
    when 'project' then (select client_id from public.projects where projects.id = p_id)
    when 'inspection' then (select client_id from public.inspections where inspections.id = p_id)
  end;
$$;

-- ----------------------------------------------------------------------------
-- Enable RLS everywhere
-- ----------------------------------------------------------------------------
alter table public.clients enable row level security;
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.inspections enable row level security;
alter table public.attachments enable row level security;
alter table public.notes enable row level security;

-- ----------------------------------------------------------------------------
-- clients policies
-- ----------------------------------------------------------------------------
create policy "admins manage clients"
  on public.clients for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "client users can read their own client"
  on public.clients for select
  using (id = public.current_client_id());

-- ----------------------------------------------------------------------------
-- profiles policies
-- ----------------------------------------------------------------------------
create policy "admins manage all profiles"
  on public.profiles for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "users read own profile"
  on public.profiles for select
  using (id = auth.uid());

create policy "users update own name only"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid() and role = public.current_role() and client_id is not distinct from public.current_client_id());

-- ----------------------------------------------------------------------------
-- projects policies
-- ----------------------------------------------------------------------------
create policy "admins manage projects"
  on public.projects for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "client users read permitted projects"
  on public.projects for select
  using (
    client_id = public.current_client_id()
    and public.client_has_module(client_id, 'projects')
  );

-- Note: upload_notes users do NOT get an update policy here. Per the role
-- spec, "Upload & Notes" may upload photos/reports and add notes, but only
-- Admin may create/edit/delete project/inspection records themselves.

-- ----------------------------------------------------------------------------
-- inspections policies
-- ----------------------------------------------------------------------------
create policy "admins manage inspections"
  on public.inspections for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "client users read permitted inspections"
  on public.inspections for select
  using (
    client_id = public.current_client_id()
    and public.client_has_module(client_id, 'inspections')
  );

-- Note: same as projects above — upload_notes users get no update policy on
-- inspections; only Admin edits inspection records.

-- ----------------------------------------------------------------------------
-- attachments policies
-- ----------------------------------------------------------------------------
create policy "admins manage attachments"
  on public.attachments for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "client users read permitted attachments"
  on public.attachments for select
  using (
    public.client_has_module(
      public.parent_client_id(parent_kind, parent_id),
      parent_kind::text || 's'
    )
    and public.parent_client_id(parent_kind, parent_id) = public.current_client_id()
  );

create policy "upload_notes users insert attachments"
  on public.attachments for insert
  with check (
    public.current_role() = 'upload_notes'
    and uploaded_by = auth.uid()
    and public.parent_client_id(parent_kind, parent_id) = public.current_client_id()
    and public.client_has_module(
      public.parent_client_id(parent_kind, parent_id),
      parent_kind::text || 's'
    )
  );

-- upload_notes users may remove only their own uploads; admins can remove any
-- (covered by the "admins manage attachments" policy above).
create policy "upload_notes users delete own attachments"
  on public.attachments for delete
  using (
    public.current_role() = 'upload_notes'
    and uploaded_by = auth.uid()
  );

-- ----------------------------------------------------------------------------
-- notes policies
-- ----------------------------------------------------------------------------
create policy "admins manage notes"
  on public.notes for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "client users read permitted notes"
  on public.notes for select
  using (
    public.client_has_module(
      public.parent_client_id(parent_kind, parent_id),
      parent_kind::text || 's'
    )
    and public.parent_client_id(parent_kind, parent_id) = public.current_client_id()
  );

create policy "upload_notes users insert notes"
  on public.notes for insert
  with check (
    public.current_role() = 'upload_notes'
    and created_by = auth.uid()
    and public.parent_client_id(parent_kind, parent_id) = public.current_client_id()
    and public.client_has_module(
      public.parent_client_id(parent_kind, parent_id),
      parent_kind::text || 's'
    )
  );

create policy "upload_notes users delete own notes"
  on public.notes for delete
  using (
    public.current_role() = 'upload_notes'
    and created_by = auth.uid()
  );

-- ----------------------------------------------------------------------------
-- updated_at maintenance
-- ----------------------------------------------------------------------------
create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_updated_at before update on public.clients
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.projects
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.inspections
  for each row execute function public.set_updated_at();
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
-- ============================================================================
-- Fix profile provisioning bug
-- ============================================================================
-- Bug: handle_new_user() (0001_init.sql) inserts only (id, email):
--
--   insert into public.profiles (id, email) values (new.id, new.email);
--
-- That leaves role at its column default ('view_only') and client_id
-- unset (NULL). That combination violates the existing
-- client_user_has_client constraint ("role = 'admin' or client_id is not
-- null"), so the trigger's own insert fails — which, because this is an
-- AFTER INSERT trigger on auth.users, rolls back the triggering
-- auth.users insert too. Every new Supabase Auth user (self-signup or
-- Admin API driven — inviteUserByEmail/createUser) currently fails at the
-- moment of creation because of this, regardless of what role they'll
-- eventually have.
--
-- Fix: give a freshly-created profile a real "not finished being set up
-- yet" state that the constraint can allow, instead of forcing it to
-- already look like a valid client user. `provisioned` represents exactly
-- that: false immediately after signup/invite, flipped to true by the
-- backend step that assigns the real role + client_id (see the
-- Client & User Management work this unblocks). No role enum change, no
-- new table, and the one-user-one-client model is untouched — a
-- *provisioned* non-admin still requires a client, exactly as before.
--
-- handle_new_user() itself is intentionally NOT changed here: it already
-- inserts nothing for role/client_id, which is exactly the "temporarily
-- unprovisioned" state this migration makes valid. Nothing about its
-- behavior needs to change for this fix.
-- ============================================================================

alter table public.profiles
  add column provisioned boolean not null default false;

alter table public.profiles
  drop constraint client_user_has_client;

alter table public.profiles
  add constraint client_user_has_client check (
    role = 'admin' or client_id is not null or provisioned = false
  );

-- Existing-data note: ADD COLUMN ... DEFAULT false above set provisioned =
-- false on every row that already existed, regardless of whether that row
-- was actually a complete, valid profile already. Any row that exists at
-- all must already satisfy the *old* client_user_has_client constraint
-- (role = 'admin' or client_id is not null) — Postgres would never have
-- allowed it into the table otherwise — so every pre-existing row is, by
-- definition, already fully provisioned. Mark them as such so a future
-- application-layer check on `provisioned` (not added by this migration)
-- doesn't mistake an already-complete profile for an unfinished one.
-- This does not relax or bypass anything: it only reflects a fact that was
-- already true before this migration ran. On a fresh/empty database this
-- UPDATE matches zero rows.
update public.profiles
  set provisioned = true
  where role = 'admin' or client_id is not null;
-- ============================================================================
-- Client / user active flags
-- ============================================================================
-- Adds the on/off switch that Client & User Management needs for
-- deactivating a client (suspend an entire organization) or an individual
-- user, independently of their module access or role/client assignment.
-- Neither concept exists today: clients (0001_init.sql) only has the two
-- module-access flags, and profiles has no notion of "disabled" at all.
--
-- Both columns are NOT NULL DEFAULT true, so every existing client and
-- every existing profile becomes active by this migration, with no
-- explicit backfill needed — DEFAULT true already gives every current row
-- true (unlike 0005's `provisioned`, which needed a backfill because its
-- default was false and existing rows needed to be marked as already
-- complete; here the default itself already matches "stays active").
--
-- No RLS changes: "admins manage clients" / "admins manage all profiles"
-- are FOR ALL USING (is_admin()) with no column list, so they already
-- cover these new columns for admin writes. The enforcement point for
-- "reject an inactive client/profile" is an application-layer check in
-- apps/api's requireAuth — not added by this migration; these columns
-- only make that state representable.
--
-- profiles.provisioned and its client_user_has_client constraint
-- (0005_fix_profile_provisioning.sql) are untouched — this migration adds
-- unrelated columns only.
-- ============================================================================

alter table public.clients
  add column is_active boolean not null default true;

alter table public.profiles
  add column is_active boolean not null default true;
