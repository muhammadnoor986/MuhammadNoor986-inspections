import { type FormEvent, useState } from 'react';
import { ErrorMessage } from '../../../components/ErrorMessage';
import { useClientOptions } from '../../clients/hooks/useClientOptions';
import { formatClientLabel } from '../../clients/utils/formatClientLabel';
import { useProjectOptions } from '../../projects/hooks/useProjectOptions';
import { INSPECTION_STATUSES, type InspectionStatus } from '../types/inspection';
import {
  validateInspectionForm,
  type InspectionFormErrors,
  type InspectionFormValues,
} from '../utils/validateInspectionForm';

const STATUS_LABELS: Record<InspectionStatus, string> = {
  scheduled: 'Scheduled',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export function InspectionForm({
  mode,
  initial,
  /** For edit: the inspection's fixed client, used to scope the project dropdown. For create: leave unset — the dropdown narrows once a client is selected below. */
  fixedClientId,
  submitting,
  serverError,
  onSubmit,
  onCancel,
}: {
  mode: 'create' | 'edit';
  initial?: Partial<InspectionFormValues>;
  fixedClientId?: string;
  submitting: boolean;
  serverError: string | null;
  onSubmit: (values: InspectionFormValues) => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<InspectionFormValues>({
    clientId: initial?.clientId ?? '',
    projectId: initial?.projectId ?? '',
    title: initial?.title ?? '',
    inspectionDate: initial?.inspectionDate ?? '',
    status: initial?.status ?? 'scheduled',
    summary: initial?.summary ?? '',
    suburb: initial?.suburb ?? '',
    suggestedWorks: initial?.suggestedWorks ?? '',
    remediationQuote: initial?.remediationQuote ?? '',
    lastInspectionDate: initial?.lastInspectionDate ?? '',
    nextInspectionDate: initial?.nextInspectionDate ?? '',
  });
  const [errors, setErrors] = useState<InspectionFormErrors>({});

  const projectScopeClientId = fixedClientId ?? (values.clientId.trim() || undefined);
  const { options: projectOptions } = useProjectOptions(projectScopeClientId);

  // Create: only active clients are offered, since a brand-new inspection
  // shouldn't normally be assigned to a suspended client. Edit: the API
  // doesn't allow reassigning an inspection's client at all (see
  // updateInspectionSchema), so this is only ever used to *display* the
  // current one by name below — includeInactive so that lookup still
  // resolves correctly even if the client has since been deactivated.
  const { options: clientOptions, loading: clientsLoading, error: clientsError } = useClientOptions({
    includeInactive: mode === 'edit',
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const fieldErrors = validateInspectionForm(values, { requireClientId: mode === 'create' });
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length === 0) {
      onSubmit(values);
    }
  }

  return (
    <form className="entity-form" onSubmit={handleSubmit} noValidate>
      {serverError && <ErrorMessage title="Could not save this inspection" message={serverError} />}

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
          <span className="field-hint">The client on an inspection can&apos;t be changed here.</span>
        </label>
      )}

      <label>
        Title
        <input
          type="text"
          value={values.title}
          onChange={(e) => setValues({ ...values, title: e.target.value })}
          aria-invalid={Boolean(errors.title)}
        />
        {errors.title && <span className="field-error">{errors.title}</span>}
      </label>

      <label>
        Project
        <select value={values.projectId} onChange={(e) => setValues({ ...values, projectId: e.target.value })}>
          <option value="">No linked project</option>
          {projectOptions.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
        <span className="field-hint">The property address shown on this inspection comes from its linked project.</span>
      </label>

      <label>
        Suburb
        <input type="text" value={values.suburb} onChange={(e) => setValues({ ...values, suburb: e.target.value })} />
        {errors.suburb && <span className="field-error">{errors.suburb}</span>}
      </label>

      <label>
        Status
        <select value={values.status} onChange={(e) => setValues({ ...values, status: e.target.value })}>
          {INSPECTION_STATUSES.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABELS[status]}
            </option>
          ))}
        </select>
      </label>

      <label>
        Inspection date
        <input
          type="date"
          value={values.inspectionDate}
          onChange={(e) => setValues({ ...values, inspectionDate: e.target.value })}
        />
      </label>

      <label>
        Last inspection date
        <input
          type="date"
          value={values.lastInspectionDate}
          onChange={(e) => setValues({ ...values, lastInspectionDate: e.target.value })}
        />
      </label>

      <label>
        Next inspection date (due date)
        <input
          type="date"
          value={values.nextInspectionDate}
          onChange={(e) => setValues({ ...values, nextInspectionDate: e.target.value })}
        />
      </label>

      <label>
        Inspection report / summary
        <textarea rows={4} value={values.summary} onChange={(e) => setValues({ ...values, summary: e.target.value })} />
        {errors.summary && <span className="field-error">{errors.summary}</span>}
      </label>

      <label>
        Suggested works / remediation notes
        <textarea
          rows={4}
          value={values.suggestedWorks}
          onChange={(e) => setValues({ ...values, suggestedWorks: e.target.value })}
        />
        {errors.suggestedWorks && <span className="field-error">{errors.suggestedWorks}</span>}
      </label>

      <label>
        Remediation quote ($)
        <input
          type="number"
          min="0"
          step="0.01"
          value={values.remediationQuote}
          onChange={(e) => setValues({ ...values, remediationQuote: e.target.value })}
          aria-invalid={Boolean(errors.remediationQuote)}
        />
        {errors.remediationQuote && <span className="field-error">{errors.remediationQuote}</span>}
      </label>

      <div className="form-actions">
        <button type="button" onClick={onCancel} disabled={submitting}>
          Cancel
        </button>
        <button type="submit" className="button-primary" disabled={submitting}>
          {submitting ? 'Saving…' : mode === 'create' ? 'Create Inspection' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
}
