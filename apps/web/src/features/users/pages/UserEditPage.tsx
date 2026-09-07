import { useCallback } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { ErrorMessage } from '../../../components/ErrorMessage';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { useAsyncAction } from '../../../hooks/useAsyncAction';
import { UserForm } from '../components/UserForm';
import { useUser } from '../hooks/useUser';
import { updateUser } from '../services/usersService';
import type { UpdateUserInput } from '../types/user';
import type { UserFormValues } from '../utils/validateUserForm';

export function UserEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useUser(id);

  const submit = useCallback((input: UpdateUserInput) => updateUser(id!, input), [id]);
  const { run, submitting, error } = useAsyncAction(submit);

  if (!id) return <Navigate to="/users" replace />;

  if (user.status === 'loading') return <LoadingScreen label="Loading user…" />;
  if (user.status === 'error') return <ErrorMessage title="Could not load this user" message={user.error} />;

  async function handleSubmit(values: UserFormValues) {
    const input: UpdateUserInput = {
      fullName: values.fullName.trim(),
      role: values.role,
      // Explicit null (not omitted) when promoting to admin — matches
      // "clientId = null" exactly, rather than relying on the API's own
      // implicit-clear-on-promotion fallback.
      clientId: values.role === 'admin' ? null : values.clientId,
    };
    const result = await run(input);
    if (result.ok) navigate('/users');
  }

  return (
    <section>
      <h1>Edit User</h1>
      <UserForm
        mode="edit"
        initial={{
          email: user.data.email,
          fullName: user.data.fullName ?? '',
          role: user.data.role,
          clientId: user.data.clientId ?? '',
        }}
        currentClient={user.data.client}
        submitting={submitting}
        serverError={error}
        onSubmit={(values) => void handleSubmit(values)}
        onCancel={() => navigate('/users')}
      />
    </section>
  );
}
