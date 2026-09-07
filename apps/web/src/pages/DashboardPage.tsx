import { useAuth } from '../hooks/useAuth';

// Placeholder landing page. Projects/Inspections UI lands in a later step.
export function DashboardPage() {
  const { profile } = useAuth();

  return (
    <section>
      <h1>Dashboard</h1>
      {profile && (
        <p>
          Signed in as <strong>{profile.email}</strong> ({profile.role}).
        </p>
      )}
    </section>
  );
}
