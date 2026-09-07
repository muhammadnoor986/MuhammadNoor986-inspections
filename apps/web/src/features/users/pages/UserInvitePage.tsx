import { useNavigate } from 'react-router-dom';
import { useAsyncAction } from '../../../hooks/useAsyncAction';
import { UserForm } from '../components/UserForm';
import { inviteUser } from '../services/usersService';
import type { InviteUserInput } from '../types/user';
import type { UserFormValues } from '../utils/validateUserForm';

export function UserInvitePage() {
  const navigate = useNavigate();
  const { run, submitting, error } = useAsyncAction(inviteUser);

  async function handleSubmit(values: UserFormValues) {
    const input: InviteUserInput = {
      email: values.email.trim(),
      fullName: values.fullName.trim(),
      role: values.role,
      // Never send a client for admin — the field is already hidden/cleared
      // in UserForm, this is the belt-and-braces guarantee at the request
      // boundary itself.
      clientId: values.role === 'admin' ? undefined : values.clientId,
    };
    const result = await run(input);
    // No dedicated user detail page — landing back on the (freshly
    // refetched) list, showing the newly provisioned user, is this app's
    // existing "success feedback" pattern (see ClientCreatePage).
    if (result.ok) navigate('/users');
  }

  return (
    <section>
      <h1>Invite User</h1>
      <UserForm
        mode="invite"
        submitting={submitting}
        serverError={error}
        onSubmit={(values) => void handleSubmit(values)}
        onCancel={() => navigate('/users')}
      />
    </section>
  );
}
