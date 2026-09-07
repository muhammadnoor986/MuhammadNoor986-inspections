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
