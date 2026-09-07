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
