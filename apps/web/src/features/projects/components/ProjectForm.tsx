import { type FormEvent, useState } from 'react';
import { ErrorMessage } from '../../../components/ErrorMessage';
import { useClientOptions } from '../../clients/hooks/useClientOptions';
import { formatClientLabel } from '../../clients/utils/formatClientLabel';
import { PROJECT_STATUSES, type ProjectStatus } from '../types/project';
import { validateProjectForm, type ProjectFormErrors, type ProjectFormValues } from '../utils/validateProjectForm';

const STATUS_LABELS: Record<ProjectStatus, string> = {
  active: 'Active',
  on_hold: 'On Hold',
  completed: 'Completed',
  archived: 'Archived',
};

export function ProjectForm({
  mode,
  initial,
  submitting,
  serverError,
  onSubmit,
  onCancel,
}: {
  mode: 'create' | 'edit';
  initial?: Partial<ProjectFormValues>;
  submitting: boolean;
  serverError: string | null;
  onSubmit: (values: ProjectFormValues) => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<ProjectFormValues>({
    clientId: initial?.clientId ?? '',
    name: initial?.name ?? '',
    description: initial?.description ?? '',
    address: initial?.address ?? '',
    status: initial?.status ?? 'active',
  });
  const [errors, setErrors] = useState<ProjectFormErrors>({});

  // Create: only active clients are offered, since a brand-new project
  // shouldn't normally be assigned to a suspended client. Edit: the API
  // doesn't allow reassigning a project's client at all (see
  // updateProjectSchema), so this is only ever used to *display* the
  // current one by name below — includeInactive so that lookup still
  // resolves correctly even if the client has since been deactivated.
  const { options: clientOptions, loading: clientsLoading, error: clientsError } = useClientOptions({
    includeInactive: mode === 'edit',
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const fieldErrors = validateProjectForm(values, { requireClientId: mode === 'create' });
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length === 0) {
      onSubmit(values);
    }
  }

  return (
    <form className="entity-form" onSubmit={handleSubmit} noValidate>
      {serverError && <ErrorMessage title="Could not save this project" message={serverError} />}

      {mode === 'create' ? (
        <label>
          Client
          <select
            value={values.clientId}
            onChange={(e) => setValues({ ...values, clientId: e.target.value })}
            disabled={clientsLoading}
            aria-invalid={Boolean(errors.clientId)}
            required
          >
            <option value="">Select client</option>
            {clientOptions.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
          {clientsLoading && <span className="field-hint">Loading clients…</span>}
          {clientsError && <ErrorMessage title="Could not load clients" message={clientsError} />}
          {!clientsLoading && !clientsError && clientOptions.length === 0 && (
            <span className="field-hint">No clients available yet — create a client first.</span>
          )}
          {errors.clientId && <span className="field-error">{errors.clientId}</span>}
        </label>
      ) : (
        <label>
          Client
          <input type="text" value={formatClientLabel(clientOptions, initial?.clientId, clientsLoading)} disabled readOnly />
          <span className="field-hint">The client on a project can&apos;t be changed here.</span>
        </label>
      )}

      <label>
        Name
        <input
          type="text"
          value={values.name}
          onChange={(e) => setValues({ ...values, name: e.target.value })}
          aria-invalid={Boolean(errors.name)}
        />
        {errors.name && <span className="field-error">{errors.name}</span>}
      </label>

      <label>
        Address
        <input type="text" value={values.address} onChange={(e) => setValues({ ...values, address: e.target.value })} />
        {errors.address && <span className="field-error">{errors.address}</span>}
      </label>

      <label>
        Description
        <textarea
          rows={4}
          value={values.description}
          onChange={(e) => setValues({ ...values, description: e.target.value })}
        />
        {errors.description && <span className="field-error">{errors.description}</span>}
      </label>

      <label>
        Status
        <select value={values.status} onChange={(e) => setValues({ ...values, status: e.target.value })}>
          {PROJECT_STATUSES.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABELS[status]}
            </option>
          ))}
        </select>
      </label>

      <div className="form-actions">
        <button type="button" onClick={onCancel} disabled={submitting}>
          Cancel
        </button>
        <button type="submit" className="button-primary" disabled={submitting}>
          {submitting ? 'Saving…' : mode === 'create' ? 'Create Project' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
}
