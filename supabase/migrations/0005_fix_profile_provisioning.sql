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
