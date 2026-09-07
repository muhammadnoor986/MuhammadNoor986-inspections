import { Route, Routes } from 'react-router-dom';
import { ClientCreatePage } from '../features/clients/pages/ClientCreatePage';
import { ClientEditPage } from '../features/clients/pages/ClientEditPage';
import { ClientsListPage } from '../features/clients/pages/ClientsListPage';
import { InspectionCreatePage } from '../features/inspections/pages/InspectionCreatePage';
import { InspectionDetailPage } from '../features/inspections/pages/InspectionDetailPage';
import { InspectionEditPage } from '../features/inspections/pages/InspectionEditPage';
import { InspectionsListPage } from '../features/inspections/pages/InspectionsListPage';
import { ProjectCreatePage } from '../features/projects/pages/ProjectCreatePage';
import { ProjectDetailPage } from '../features/projects/pages/ProjectDetailPage';
import { ProjectEditPage } from '../features/projects/pages/ProjectEditPage';
import { ProjectsListPage } from '../features/projects/pages/ProjectsListPage';
import { UserEditPage } from '../features/users/pages/UserEditPage';
import { UserInvitePage } from '../features/users/pages/UserInvitePage';
import { UsersListPage } from '../features/users/pages/UsersListPage';
import { AppLayout } from '../layouts/AppLayout';
import { AuthLayout } from '../layouts/AuthLayout';
import { AcceptInvitePage } from '../pages/AcceptInvitePage';
import { DashboardPage } from '../pages/DashboardPage';
import { LoginPage } from '../pages/LoginPage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { UnauthorizedPage } from '../pages/UnauthorizedPage';
import { ProtectedRoute } from './ProtectedRoute';
import { RoleRoute } from './RoleRoute';

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
        {/* Public — reached from the Supabase invite email, before the user has a normal application session. See src/pages/AcceptInvitePage.tsx. */}
        <Route path="/accept-invite" element={<AcceptInvitePage />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/unauthorized" element={<UnauthorizedPage />} />

          <Route element={<RoleRoute module="projects" />}>
            <Route path="/projects" element={<ProjectsListPage />} />
            <Route path="/projects/:id" element={<ProjectDetailPage />} />

            <Route element={<RoleRoute roles={['admin']} />}>
              <Route path="/projects/new" element={<ProjectCreatePage />} />
              <Route path="/projects/:id/edit" element={<ProjectEditPage />} />
            </Route>
          </Route>

          <Route element={<RoleRoute module="inspections" />}>
            <Route path="/inspections" element={<InspectionsListPage />} />
            <Route path="/inspections/:id" element={<InspectionDetailPage />} />

            <Route element={<RoleRoute roles={['admin']} />}>
              <Route path="/inspections/new" element={<InspectionCreatePage />} />
              <Route path="/inspections/:id/edit" element={<InspectionEditPage />} />
            </Route>
          </Route>

          {/* Client and User management are entirely admin-only — unlike Projects/Inspections, there's no module-access variant for other roles. */}
          <Route element={<RoleRoute roles={['admin']} />}>
            <Route path="/clients" element={<ClientsListPage />} />
            <Route path="/clients/new" element={<ClientCreatePage />} />
            <Route path="/clients/:id/edit" element={<ClientEditPage />} />

            <Route path="/users" element={<UsersListPage />} />
            <Route path="/users/new" element={<UserInvitePage />} />
            <Route path="/users/:id/edit" element={<UserEditPage />} />
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
