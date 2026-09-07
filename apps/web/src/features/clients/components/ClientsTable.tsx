import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { ErrorMessage } from '../../../components/ErrorMessage';
import { useAsyncAction } from '../../../hooks/useAsyncAction';
import { activateClient, deactivateClient } from '../services/clientsService';
import { ClientStatusBadge } from './ClientStatusBadge';
import type { Client } from '../types/client';

function ModuleAccessBadge({ enabled }: { enabled: boolean }) {
  return <span className={`status-badge ${enabled ? 'status-active' : 'status-archived'}`}>{enabled ? 'Enabled' : 'Disabled'}</span>;
}

function ClientTableRow({ client, onChanged }: { client: Client; onChanged: () => void }) {
  const [confirmingDeactivate, setConfirmingDeactivate] = useState(false);
  const { run: runActivate, submitting: activating, error: activateError } = useAsyncAction(activateClient);
  const { run: runDeactivate, submitting: deactivating, error: deactivateError } = useAsyncAction(deactivateClient);

  const busy = activating || deactivating;

  async function handleActivate() {
    const result = await runActivate(client.id);
    if (result.ok) onChanged();
  }

  async function handleConfirmDeactivate() {
    const result = await runDeactivate(client.id);
    if (result.ok) {
      setConfirmingDeactivate(false);
      onChanged();
    }
  }

  return (
    <>
      <tr>
        <td>
          <Link to={`/clients/${client.id}/edit`}>{client.name}</Link>
        </td>
        <td>
          <ModuleAccessBadge enabled={client.canAccessProjects} />
        </td>
        <td>
          <ModuleAccessBadge enabled={client.canAccessInspections} />
        </td>
        <td>
          <ClientStatusBadge isActive={client.isActive} />
        </td>
        <td className="table-actions">
          <Link to={`/clients/${client.id}/edit`}>Edit</Link>
          {client.isActive ? (
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
          <td colSpan={5}>
            <ErrorMessage title="Could not update this client" message={(activateError ?? deactivateError) as string} />
          </td>
        </tr>
      )}

      {confirmingDeactivate && (
        <ConfirmDialog
          title="Deactivate client"
          message={`Deactivate "${client.name}"? Their users will no longer be able to sign in until the client is reactivated. This can be reversed at any time.`}
          confirmLabel="Deactivate"
          busy={deactivating}
          onCancel={() => setConfirmingDeactivate(false)}
          onConfirm={() => void handleConfirmDeactivate()}
        />
      )}
    </>
  );
}

export function ClientsTable({ clients, onChanged }: { clients: Client[]; onChanged: () => void }) {
  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Client</th>
          <th>Projects Access</th>
          <th>Inspections Access</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {clients.map((client) => (
          <ClientTableRow key={client.id} client={client} onChanged={onChanged} />
        ))}
      </tbody>
    </table>
  );
}
