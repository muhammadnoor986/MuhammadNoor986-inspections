# Inspection Platform

Centralized platform for a building/property inspection company, replacing
scattered photos, spreadsheets, and email.

## Architecture

```
Web:    React + TypeScript        ─┐
                                     ├─►  Node.js API  ─►  Supabase / PostgreSQL
Mobile: React Native + TypeScript ─┘                   ─►  AWS S3 (files)
```

- **apps/web** — React + TypeScript web app.
- **apps/mobile** — React Native + TypeScript mobile app.
- **apps/api** — Node.js API. Single backend for both clients: verifies
  Supabase JWTs, enforces role-based access control, talks to Postgres and
  AWS S3. Holds the Supabase service-role key server-side only.
- **packages/shared** — TypeScript types/utilities shared across web, mobile,
  and api.
- **supabase** — SQL migrations (schema + Row Level Security policies), kept
  as defense-in-depth alongside API-layer RBAC.
- **archive/flutter-scaffold** — the original Flutter scaffold this repo
  started from. Not part of this project; kept for reference only.

## Roles

- **Admin** — full access: manage users, client access, projects,
  inspections, photos/reports, dashboards.
- **Upload & Notes** — view permitted data, upload photos/reports, add
  notes. Cannot manage users or delete restricted data.
- **View Only** — read-only access to data assigned to their client.

Clients are granted access to the Projects module, the Inspections module,
or both. Access control is enforced server-side (Node API + Postgres RLS),
never solely in the frontend.
