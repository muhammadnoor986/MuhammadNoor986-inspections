import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { ErrorMessage } from '../../../components/ErrorMessage';
import { useAsyncAction } from '../../../hooks/useAsyncAction';
import { activateUser, deactivateUser } from '../services/usersService';
import { RoleBadge } from './RoleBadge';
import type { User } from '../types/user';

function UserTableRow({ user, onChanged }: { user: User; onChanged: () => void }) {
  const [confirmingDeactivate, setConfirmingDeactivate] = useState(false);
  const { run: runActivate, submitting: activating, error: activateError } = useAsyncAction(activateUser);
  const { run: runDeactivate, submitting: deactivating, error: deactivateError } = useAsyncAction(deactivateUser);

  const busy = activating || deactivating;
  const displayName = user.fullName || user.email;

  async function handleActivate() {
    const result = await runActivate(user.id);
    if (result.ok) onChanged();
  }

  async function handleConfirmDeactivate() {
    const result = await runDeactivate(user.id);
    if (result.ok) {
      setConfirmingDeactivate(false);
      onChanged();
    }
  }

  return (
    <>
      <tr>
        <td>
          <Link to={`/users/${user.id}/edit`}>{displayName}</Link>
        </td>
        <td>{user.email}</td>
        <td>
          <RoleBadge role={user.role} />
        </td>
        <td>{user.role === 'admin' ? '—' : (user.client?.name ?? '—')}</td>
        <td>
          <span className={`status-badge ${user.isActive ? 'status-active' : 'status-archived'}`}>
            {user.isActive ? 'Active' : 'Inactive'}
          </span>
        </td>
        <td className="table-actions">
          <Link to={`/users/${user.id}/edit`}>Edit</Link>
          {user.isActive ? (
            <button type="button" className="danger" disabled={busy} onClick={() => setConfirmingDeactivate(true)}>
              Deactivate
            </button>
          ) : (
            <button type="button" disabled={busy} onClick={() => void handleActivate()}>
              {activating ? 'Activating…' : 'Activate'}
            </button>
          )}
        </td>
      </tr>

      {(activateError || deactivateError) && (
        <tr>
          <td colSpan={6}>
            <ErrorMessage title="Could not update this user" message={(activateError ?? deactivateError) as string} />
          </td>
        </tr>
      )}

      {confirmingDeactivate && (
        <ConfirmDialog
          title="Deactivate user"
          message={`Deactivate "${displayName}"? They will no longer be able to sign in until reactivated. This can be reversed at any time.`}
          confirmLabel="Deactivate"
          busy={deactivating}
          onCancel={() => setConfirmingDeactivate(false)}
          onConfirm={() => void handleConfirmDeactivate()}
        />
      )}
    </>
  );
}

export function UsersTable({ users, onChanged }: { users: User[]; onChanged: () => void }) {
  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>User</th>
          <th>Email</th>
          <th>Role</th>
          <th>Client</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {users.map((user) => (
          <UserTableRow key={user.id} user={user} onChanged={onChanged} />
        ))}
      </tbody>
    </table>
  );
}
