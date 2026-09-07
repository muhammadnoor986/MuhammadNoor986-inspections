import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

/** Shell for authenticated pages: header/nav + the routed page in <Outlet/>. */
export function AppLayout() {
  const { profile, logout } = useAuth();

  return (
    <div className="app-layout">
      <header className="app-header">
        <span className="app-title">Inspection Platform</span>
        <nav className="app-nav">
          <NavLink to="/" end>
            Dashboard
          </NavLink>
          {(profile?.role === 'admin' || profile?.canAccessProjects) && <NavLink to="/projects">Projects</NavLink>}
          {(profile?.role === 'admin' || profile?.canAccessInspections) && <NavLink to="/inspections">Inspections</NavLink>}
          {profile?.role === 'admin' && <NavLink to="/clients">Clients</NavLink>}
          {profile?.role === 'admin' && <NavLink to="/users">Users</NavLink>}
        </nav>
        <div className="app-user">
          {profile && (
            <span>
              {profile.email} · {profile.role}
            </span>
          )}
          <button type="button" onClick={() => void logout()}>
            Log out
          </button>
        </div>
      </header>
      <main className="app-content">
        <Outlet />
      </main>
    </div>
  );
}
