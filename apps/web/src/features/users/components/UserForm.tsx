import { type FormEvent, useState } from 'react';
import { ErrorMessage } from '../../../components/ErrorMessage';
import { useClientOptions } from '../../clients/hooks/useClientOptions';
import { USER_ROLES, type UserRole } from '../types/user';
import { validateUserForm, type UserFormErrors, type UserFormValues } from '../utils/validateUserForm';

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  upload_notes: 'Upload & Notes',
  view_only: 'View Only',
};

export function UserForm({
  mode,
  initial,
  currentClient,
  submitting,
  serverError,
  onSubmit,
  onCancel,
}: {
  mode: 'invite' | 'edit';
  initial?: Partial<UserFormValues>;
  /** Edit mode only: the user's existing client, shown even if it's since been deactivated (and so wouldn't otherwise appear in the active-only options list). */
  currentClient?: { id: string; name: string; isActive: boolean } | null;
  submitting: boolean;
  serverError: string | null;
  onSubmit: (values: UserFormValues) => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<UserFormValues>({
    email: initial?.email ?? '',
    fullName: initial?.fullName ?? '',
    role: initial?.role ?? 'view_only',
    clientId: initial?.clientId ?? '',
  });
  const [errors, setErrors] = useState<UserFormErrors>({});

  const { options: activeClientOptions } = useClientOptions();
  const clientOptions =
    currentClient && !activeClientOptions.some((c) => c.id === currentClient.id)
      ? [...activeClientOptions, currentClient]
      : activeClientOptions;

  const showClientField = values.role !== 'admin';

  function handleRoleChange(role: UserRole) {
    // Never leave a stale clientId attached when switching to admin — the
    // field disappears immediately, and the value backing it is cleared
    // right along with it, not just hidden.
    setValues((prev) => ({ ...prev, role, clientId: role === 'admin' ? '' : prev.clientId }));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const fieldErrors = validateUserForm(values, { requireEmail: mode === 'invite' });
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length === 0) {
      onSubmit(values);
    }
  }

  return (
    <form className="entity-form" onSubmit={handleSubmit} noValidate>
      {serverError && (
        <ErrorMessage title={`Could not ${mode === 'invite' ? 'invite' : 'save'} this user`} message={serverError} />
      )}

      {mode === 'invite' ? (
        <label>
          Email
          <input
            type="email"
            value={values.email}
            onChange={(e) => setValues({ ...values, email: e.target.value })}
            aria-invalid={Boolean(errors.email)}
          />
          {errors.email && <span className="field-error">{errors.email}</span>}
        </label>
      ) : (
        <label>
          Email
          <input type="email" value={values.email} disabled readOnly />
          <span className="field-hint">Email cannot be changed here.</span>
        </label>
      )}

      <label>
        Full name
        <input
          type="text"
          value={values.fullName}
          onChange={(e) => setValues({ ...values, fullName: e.target.value })}
          aria-invalid={Boolean(errors.fullName)}
        />
        {errors.fullName && <span className="field-error">{errors.fullName}</span>}
      </label>

      <label>
        Role
        <select value={values.role} onChange={(e) => handleRoleChange(e.target.value as UserRole)}>
          {USER_ROLES.map((role) => (
            <option key={role} value={role}>
              {ROLE_LABELS[role]}
            </option>
          ))}
        </select>
      </label>

      {showClientField && (
        <label>
          Client
          <select
            value={values.clientId}
            onChange={(e) => setValues({ ...values, clientId: e.target.value })}
            aria-invalid={Boolean(errors.clientId)}
          >
            <option value="">Select a client…</option>
            {clientOptions.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
                {!client.isActive ? ' (inactive)' : ''}
              </option>
            ))}
          </select>
          {errors.clientId && <span className="field-error">{errors.clientId}</span>}
        </label>
      )}

      <div className="form-actions">
        <button type="button" onClick={onCancel} disabled={submitting}>
          Cancel
        </button>
        <button type="submit" className="button-primary" disabled={submitting}>
          {submitting ? 'Saving…' : mode === 'invite' ? 'Send Invite' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
}
