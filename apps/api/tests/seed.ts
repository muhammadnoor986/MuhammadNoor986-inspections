// Fixed test fixtures shared by the RBAC test suites. Kept deliberately
// small: one client with both modules on, one client with both off, and one
// user per role.
//
// Every id here must be a valid UUID — they all flow through zod's
// `.uuid()` schemas somewhere (idParamSchema, createProjectSchema.clientId,
// etc), and since the User Management API (Prompt #5), that now includes
// profile/user ids too via `/users/:id`'s idParamSchema — matching real
// Supabase, where profiles.id is always a UUID (it *is* auth.users.id).

export const clients = {
  clientA: {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'Client A',
    can_access_projects: true,
    can_access_inspections: true,
    is_active: true,
  },
  clientB: {
    id: '22222222-2222-2222-2222-222222222222',
    name: 'Client B',
    can_access_projects: false,
    can_access_inspections: false,
    is_active: true,
  },
  // Modules on, but owns none of the seeded projects/inspections — used to
  // exercise the cross-client ownership check separately from module access.
  clientC: {
    id: '33333333-3333-3333-3333-333333333333',
    name: 'Client C',
    can_access_projects: true,
    can_access_inspections: true,
    is_active: true,
  },
  // Deactivated client — used by auth.rbac.test.ts to prove requireAuth
  // rejects a caller whose client has been switched off, independent of
  // their own profile being fine.
  clientInactive: {
    id: '44444444-4444-4444-4444-444444444444',
    name: 'Client Inactive',
    can_access_projects: true,
    can_access_inspections: true,
    is_active: false,
  },
};

// `clients` here is the nested join shape auth.ts expects from
// `.select('..., clients ( can_access_projects, can_access_inspections, is_active )')`.
export const profiles = {
  admin: {
    id: 'aaaaaaaa-0000-0000-0000-000000000001',
    email: 'admin@test.dev',
    full_name: 'Test Admin',
    role: 'admin',
    client_id: null,
    provisioned: true,
    is_active: true,
    clients: null,
  },
  uploadNotesA: {
    id: 'aaaaaaaa-0000-0000-0000-000000000002',
    email: 'upload-a@test.dev',
    full_name: 'Upload Notes A',
    role: 'upload_notes',
    client_id: clients.clientA.id,
    provisioned: true,
    is_active: true,
    clients: { can_access_projects: true, can_access_inspections: true, is_active: true },
  },
  viewOnlyA: {
    id: 'aaaaaaaa-0000-0000-0000-000000000003',
    email: 'view-a@test.dev',
    full_name: 'View Only A',
    role: 'view_only',
    client_id: clients.clientA.id,
    provisioned: true,
    is_active: true,
    clients: { can_access_projects: true, can_access_inspections: true, is_active: true },
  },
  viewOnlyB: {
    id: 'aaaaaaaa-0000-0000-0000-000000000004',
    email: 'view-b@test.dev',
    full_name: 'View Only B',
    role: 'view_only',
    client_id: clients.clientB.id,
    provisioned: true,
    is_active: true,
    clients: { can_access_projects: false, can_access_inspections: false, is_active: true },
  },
  viewOnlyC: {
    id: 'aaaaaaaa-0000-0000-0000-000000000005',
    email: 'view-c@test.dev',
    full_name: 'View Only C',
    role: 'view_only',
    client_id: clients.clientC.id,
    provisioned: true,
    is_active: true,
    clients: { can_access_projects: true, can_access_inspections: true, is_active: true },
  },
  // The following exist only to exercise requireAuth's rejection paths
  // (see auth.rbac.test.ts) — each is otherwise a normal, real profile row.
  unprovisioned: {
    id: 'aaaaaaaa-0000-0000-0000-000000000006',
    email: 'unprovisioned@test.dev',
    full_name: 'Unprovisioned User',
    role: 'view_only',
    client_id: null,
    provisioned: false,
    is_active: true,
    clients: null,
  },
  inactiveProfile: {
    id: 'aaaaaaaa-0000-0000-0000-000000000007',
    email: 'inactive-profile@test.dev',
    full_name: 'Inactive Profile',
    role: 'view_only',
    client_id: clients.clientA.id,
    provisioned: true,
    is_active: false,
    clients: { can_access_projects: true, can_access_inspections: true, is_active: true },
  },
  inactiveClientUser: {
    id: 'aaaaaaaa-0000-0000-0000-000000000008',
    email: 'inactive-client@test.dev',
    full_name: 'Inactive Client User',
    role: 'view_only',
    client_id: clients.clientInactive.id,
    provisioned: true,
    is_active: true,
    clients: { can_access_projects: true, can_access_inspections: true, is_active: false },
  },
  noClientNonAdmin: {
    id: 'aaaaaaaa-0000-0000-0000-000000000009',
    email: 'no-client@test.dev',
    full_name: 'No Client Non Admin',
    role: 'view_only',
    client_id: null,
    provisioned: true,
    is_active: true,
    clients: null,
  },
  adminNoClient: {
    id: 'aaaaaaaa-0000-0000-0000-000000000010',
    email: 'admin-no-client@test.dev',
    full_name: 'Admin No Client',
    role: 'admin',
    client_id: null,
    provisioned: true,
    is_active: true,
    clients: null,
  },
};

export const projects = [
  {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    client_id: clients.clientA.id,
    name: 'Project A1',
    description: null,
    address: null,
    status: 'active',
    created_by: profiles.admin.id,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
];

export const inspections = [
  {
    id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    client_id: clients.clientA.id,
    project_id: projects[0].id,
    title: 'Inspection A1',
    inspection_date: '2026-01-15',
    status: 'scheduled',
    summary: null,
    created_by: profiles.admin.id,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
  },
];

export function seedDb() {
  return {
    clients: [clients.clientA, clients.clientB, clients.clientC, clients.clientInactive],
    profiles: [
      profiles.admin,
      profiles.uploadNotesA,
      profiles.viewOnlyA,
      profiles.viewOnlyB,
      profiles.viewOnlyC,
      profiles.unprovisioned,
      profiles.inactiveProfile,
      profiles.inactiveClientUser,
      profiles.noClientNonAdmin,
      profiles.adminNoClient,
    ],
    projects: [...projects],
    inspections: [...inspections],
  };
}
