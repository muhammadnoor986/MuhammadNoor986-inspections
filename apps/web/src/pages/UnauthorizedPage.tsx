import { Link } from 'react-router-dom';

export function UnauthorizedPage() {
  return (
    <section className="centered-screen">
      <h1>You don't have access to this page</h1>
      <Link to="/">Back to dashboard</Link>
    </section>
  );
}
