import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../src/routes/AppRoutes';
import type { Profile } from '../src/types/auth';

// Exercises the *real* route tree (not just the RoleRoute primitive in
// isolation — see roleRoute.test.tsx) to prove /clients is actually wired
// up behind admin-only protection end to end, including for someone
// manually typing the URL rather than clicking a nav link.

const useAuthMock = vi.fn();
vi.mock('../src/hooks/useAuth', () => ({ useAuth: () => useAuthMock() }));

vi.mock('../src/features/clients/services/clientsService', () => ({
  listClients: vi.fn().mockResolvedValue({ items: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 1 } }),
  getClient: vi.fn(),
  createClient: vi.fn(),
  updateClient: vi.fn(),
  activateClient: vi.fn(),
  deactivateClient: vi.fn(),
}));

function profile(overrides: Partial<Profile>): Profile {
  return {
    id: 'user-1',
    email: 'user@test.dev',
    role: 'view_only',
    clientId: 'client-a',
    canAccessProjects: true,
    canAccessInspections: true,
    ...overrides,
  };
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppRoutes />
    </MemoryRouter>
  );
}

describe('Clients route protection', () => {
  it('admin can access /clients directly by URL', async () => {
    useAuthMock.mockReturnValue({ status: 'authenticated', profile: profile({ role: 'admin', clientId: null }), profileError: null });
    renderAt('/clients');
    expect(await screen.findByRole('heading', { name: 'Clients' })).toBeInTheDocument();
  });

  it('upload_notes cannot access /clients by URL — redirected to Unauthorized', async () => {
    useAuthMock.mockReturnValue({ status: 'authenticated', profile: profile({ role: 'upload_notes' }), profileError: null });
    renderAt('/clients');
    expect(await screen.findByText(/don't have access to this page/i)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Clients' })).not.toBeInTheDocument();
  });

  it('view_only cannot access /clients by URL — redirected to Unauthorized', async () => {
    useAuthMock.mockReturnValue({ status: 'authenticated', profile: profile({ role: 'view_only' }), profileError: null });
    renderAt('/clients');
    expect(await screen.findByText(/don't have access to this page/i)).toBeInTheDocument();
  });

  it('view_only cannot access /clients/new by URL', async () => {
    useAuthMock.mockReturnValue({ status: 'authenticated', profile: profile({ role: 'view_only' }), profileError: null });
    renderAt('/clients/new');
    expect(await screen.findByText(/don't have access to this page/i)).toBeInTheDocument();
  });
});
