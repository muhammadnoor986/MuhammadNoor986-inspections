import { Outlet } from 'react-router-dom';

/** Centered shell used by public pages (login, etc) — no nav, no auth state required. */
export function AuthLayout() {
  return (
    <div className="auth-layout">
      <Outlet />
    </div>
  );
}
