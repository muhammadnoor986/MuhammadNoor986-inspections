import { useNavigate } from 'react-router-dom';
import { useAsyncAction } from '../../../hooks/useAsyncAction';
import { ClientForm } from '../components/ClientForm';
import { createClient } from '../services/clientsService';
import type { CreateClientInput } from '../types/client';
import type { ClientFormValues } from '../utils/validateClientForm';

export function ClientCreatePage() {
  const navigate = useNavigate();
  const { run, submitting, error } = useAsyncAction(createClient);

  async function handleSubmit(values: ClientFormValues) {
    const input: CreateClientInput = {
      name: values.name.trim(),
      canAccessProjects: values.canAccessProjects,
      canAccessInspections: values.canAccessInspections,
    };
    const result = await run(input);
    // No dedicated client detail page — landing back on the (freshly
    // refetched) list is this app's existing "success feedback" pattern
    // (see ProjectCreatePage/InspectionCreatePage's equivalent navigation).
    if (result.ok) navigate('/clients');
  }

  return (
    <section>
      <h1>New Client</h1>
      <ClientForm
        mode="create"
        submitting={submitting}
        serverError={error}
        onSubmit={(values) => void handleSubmit(values)}
        onCancel={() => navigate('/clients')}
      />
    </section>
  );
}
