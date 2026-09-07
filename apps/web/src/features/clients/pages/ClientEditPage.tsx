import { useCallback } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { ErrorMessage } from '../../../components/ErrorMessage';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { useAsyncAction } from '../../../hooks/useAsyncAction';
import { ClientForm } from '../components/ClientForm';
import { useClient } from '../hooks/useClient';
import { updateClient } from '../services/clientsService';
import type { UpdateClientInput } from '../types/client';
import type { ClientFormValues } from '../utils/validateClientForm';

export function ClientEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const client = useClient(id);

  const submit = useCallback((input: UpdateClientInput) => updateClient(id!, input), [id]);
  const { run, submitting, error } = useAsyncAction(submit);

  if (!id) return <Navigate to="/clients" replace />;

  if (client.status === 'loading') return <LoadingScreen label="Loading client…" />;
  if (client.status === 'error') return <ErrorMessage title="Could not load this client" message={client.error} />;

  async function handleSubmit(values: ClientFormValues) {
    const input: UpdateClientInput = {
      name: values.name.trim(),
      canAccessProjects: values.canAccessProjects,
      canAccessInspections: values.canAccessInspections,
    };
    const result = await run(input);
    if (result.ok) navigate('/clients');
  }

  return (
    <section>
      <h1>Edit Client</h1>
      <ClientForm
        mode="edit"
        initial={{
          name: client.data.name,
          canAccessProjects: client.data.canAccessProjects,
          canAccessInspections: client.data.canAccessInspections,
        }}
        submitting={submitting}
        serverError={error}
        onSubmit={(values) => void handleSubmit(values)}
        onCancel={() => navigate('/clients')}
      />
    </section>
  );
}
