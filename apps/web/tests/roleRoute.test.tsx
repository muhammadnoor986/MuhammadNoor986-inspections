import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { RoleRoute } from '../src/routes/RoleRoute';
import type { Profile } from '../src/types/auth';

const useAuthMock = vi.fn();
vi.mock('../src/hooks/useAuth', () => ({ useAuth: () => useAuthMock() }));

function renderProjectsRoute() {
  return render(
    <MemoryRouter initialEntries={['/projects']}>
      <Routes>
        <Route element={<RoleRoute module="projects" />}>
          <Route path="/projects" element={<div>Projects Content</div>} />
        </Route>
        <Route path="/unauthorized" element={<div>Unauthorized Page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

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

describe('RoleRoute module gating', () => {
  it('shows a loading state while the profile has not loaded yet', () => {
    useAuthMock.mockReturnValue({ profile: null, profileError: null });
    renderProjectsRoute();
    expect(screen.getByText(/loading your profile/i)).toBeInTheDocument();
  });

  it('shows an error if the profile failed to load', () => {
    useAuthMock.mockReturnValue({ profile: null, profileError: 'network down' });
    renderProjectsRoute();
    expect(screen.getByText(/could not load your profile/i)).toBeInTheDocument();
  });

  it('lets a client whose module is enabled through', () => {
    useAuthMock.mockReturnValue({ profile: profile({ role: 'view_only', canAccessProjects: true }), profileError: null });
    renderProjectsRoute();
    expect(screen.getByText('Projects Content')).toBeInTheDocument();
  });

  it('redirects a client whose module is disabled', () => {
    useAuthMock.mockReturnValue({ profile: profile({ role: 'view_only', canAccessProjects: false }), profileError: null });
    renderProjectsRoute();
    expect(screen.getByText('Unauthorized Page')).toBeInTheDocument();
  });

  it('always lets admin through regardless of module flags', () => {
    useAuthMock.mockReturnValue({
      profile: profile({ role: 'admin', clientId: null, canAccessProjects: false, canAccessInspections: false }),
      profileError: null,
    });
    renderProjectsRoute();
    expect(screen.getByText('Projects Content')).toBeInTheDocument();
  });
});

describe('RoleRoute role gating', () => {
  function renderAdminOnlyRoute() {
    return render(
      <MemoryRouter initialEntries={['/projects/new']}>
        <Routes>
          <Route element={<RoleRoute roles={['admin']} />}>
            <Route path="/projects/new" element={<div>Admin Only Content</div>} />
          </Route>
          <Route path="/unauthorized" element={<div>Unauthorized Page</div>} />
        </Routes>
      </MemoryRouter>
    );
  }

  it('lets admin through', () => {
    useAuthMock.mockReturnValue({ profile: profile({ role: 'admin', clientId: null }), profileError: null });
    renderAdminOnlyRoute();
    expect(screen.getByText('Admin Only Content')).toBeInTheDocument();
  });

  it('blocks upload_notes', () => {
    useAuthMock.mockReturnValue({ profile: profile({ role: 'upload_notes' }), profileError: null });
    renderAdminOnlyRoute();
    expect(screen.getByText('Unauthorized Page')).toBeInTheDocument();
  });

  it('blocks view_only', () => {
    useAuthMock.mockReturnValue({ profile: profile({ role: 'view_only' }), profileError: null });
    renderAdminOnlyRoute();
    expect(screen.getByText('Unauthorized Page')).toBeInTheDocument();
  });
});
