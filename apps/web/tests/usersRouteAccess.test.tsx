import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AppRoutes } from '../src/routes/AppRoutes';
import type { Profile } from '../src/types/auth';

// Mirrors clientsRouteAccess.test.tsx — exercises the real route tree (not
// just the RoleRoute primitive) to prove /users is actually admin-only end
// to end, including manual URL entry, not merely a hidden nav link.

const useAuthMock = vi.fn();
vi.mock('../src/hooks/useAuth', () => ({ useAuth: () => useAuthMock() }));

vi.mock('../src/features/users/services/usersService', () => ({
  listUsers: vi.fn().mockResolvedValue({ items: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 1 } }),
  getUser: vi.fn(),
  inviteUser: vi.fn(),
  updateUser: vi.fn(),
  activateUser: vi.fn(),
  deactivateUser: vi.fn(),
}));

vi.mock('../src/features/clients/services/clientsService', () => ({
  listClients: vi.fn().mockResolvedValue({ items: [], meta: { page: 1, pageSize: 100, total: 0, totalPages: 1 } }),
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

describe('Users route protection', () => {
  it('admin can access /users directly by URL', async () => {
    useAuthMock.mockReturnValue({ status: 'authenticated', profile: profile({ role: 'admin', clientId: null }), profileError: null });
    renderAt('/users');
    expect(await screen.findByRole('heading', { name: 'Users' })).toBeInTheDocument();
  });

  it('upload_notes cannot access /users by URL — redirected to Unauthorized', async () => {
    useAuthMock.mockReturnValue({ status: 'authenticated', profile: profile({ role: 'upload_notes' }), profileError: null });
    renderAt('/users');
    expect(await screen.findByText(/don't have access to this page/i)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Users' })).not.toBeInTheDocument();
  });

  it('view_only cannot access /users by URL — redirected to Unauthorized', async () => {
    useAuthMock.mockReturnValue({ status: 'authenticated', profile: profile({ role: 'view_only' }), profileError: null });
    renderAt('/users');
    expect(await screen.findByText(/don't have access to this page/i)).toBeInTheDocument();
  });

  it('view_only cannot access /users/new by URL', async () => {
    useAuthMock.mockReturnValue({ status: 'authenticated', profile: profile({ role: 'view_only' }), profileError: null });
    renderAt('/users/new');
    expect(await screen.findByText(/don't have access to this page/i)).toBeInTheDocument();
  });

  it('upload_notes cannot access /users/:id/edit by URL', async () => {
    useAuthMock.mockReturnValue({ status: 'authenticated', profile: profile({ role: 'upload_notes' }), profileError: null });
    renderAt('/users/some-id/edit');
    expect(await screen.findByText(/don't have access to this page/i)).toBeInTheDocument();
  });
});
