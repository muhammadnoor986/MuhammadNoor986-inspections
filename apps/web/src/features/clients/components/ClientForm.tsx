import { type FormEvent, useState } from 'react';
import { ErrorMessage } from '../../../components/ErrorMessage';
import { validateClientForm, type ClientFormErrors, type ClientFormValues } from '../utils/validateClientForm';

export function ClientForm({
  mode,
  initial,
  submitting,
  serverError,
  onSubmit,
  onCancel,
}: {
  mode: 'create' | 'edit';
  initial?: Partial<ClientFormValues>;
  submitting: boolean;
  serverError: string | null;
  onSubmit: (values: ClientFormValues) => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<ClientFormValues>({
    name: initial?.name ?? '',
    canAccessProjects: initial?.canAccessProjects ?? true,
    canAccessInspections: initial?.canAccessInspections ?? true,
  });
  const [errors, setErrors] = useState<ClientFormErrors>({});

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const fieldErrors = validateClientForm(values);
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length === 0) {
      onSubmit(values);
    }
  }

  return (
    <form className="entity-form" onSubmit={handleSubmit} noValidate>
      {serverError && <ErrorMessage title="Could not save this client" message={serverError} />}

      <label>
        Client name
        <input
          type="text"
          value={values.name}
          onChange={(e) => setValues({ ...values, name: e.target.value })}
          aria-invalid={Boolean(errors.name)}
        />
        {errors.name && <span className="field-error">{errors.name}</span>}
      </label>

      <label className="checkbox-field">
        <input
          type="checkbox"
          checked={values.canAccessProjects}
          onChange={(e) => setValues({ ...values, canAccessProjects: e.target.checked })}
        />
        Projects access
      </label>

      <label className="checkbox-field">
        <input
          type="checkbox"
          checked={values.canAccessInspections}
          onChange={(e) => setValues({ ...values, canAccessInspections: e.target.checked })}
        />
        Inspections access
      </label>

      <div className="form-actions">
        <button type="button" onClick={onCancel} disabled={submitting}>
          Cancel
        </button>
        <button type="submit" className="button-primary" disabled={submitting}>
          {submitting ? 'Saving…' : mode === 'create' ? 'Create Client' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
}
