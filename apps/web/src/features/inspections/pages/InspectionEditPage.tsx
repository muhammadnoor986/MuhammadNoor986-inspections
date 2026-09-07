import { useCallback } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { ErrorMessage } from '../../../components/ErrorMessage';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { useAsyncAction } from '../../../hooks/useAsyncAction';
import { InspectionForm } from '../components/InspectionForm';
import { useInspection } from '../hooks/useInspection';
import { updateInspection } from '../services/inspectionsService';
import type { InspectionStatus, UpdateInspectionInput } from '../types/inspection';
import type { InspectionFormValues } from '../utils/validateInspectionForm';

/** '' from a cleared text/date/number input means "clear this field" — the API needs an explicit null for that, not an empty string. */
function orNull(value: string): string | null {
  return value.trim() ? value.trim() : null;
}

export function InspectionEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const inspection = useInspection(id);

  const submit = useCallback((input: UpdateInspectionInput) => updateInspection(id!, input), [id]);
  const { run, submitting, error } = useAsyncAction(submit);

  if (!id) return <Navigate to="/inspections" replace />;

  if (inspection.status === 'loading') return <LoadingScreen label="Loading inspection…" />;
  if (inspection.status === 'error') {
    return <ErrorMessage title="Could not load this inspection" message={inspection.error} />;
  }

  async function handleSubmit(values: InspectionFormValues) {
    const input: UpdateInspectionInput = {
      projectId: orNull(values.projectId),
      title: values.title.trim(),
      inspectionDate: orNull(values.inspectionDate),
      status: values.status as InspectionStatus,
      summary: orNull(values.summary),
      suburb: orNull(values.suburb),
      suggestedWorks: orNull(values.suggestedWorks),
      remediationQuote: values.remediationQuote.trim() ? Number(values.remediationQuote) : null,
      lastInspectionDate: orNull(values.lastInspectionDate),
      nextInspectionDate: orNull(values.nextInspectionDate),
    };
    const result = await run(input);
    if (result.ok) navigate(`/inspections/${result.data.id}`);
  }

  return (
    <section>
      <h1>Edit Inspection</h1>
      <InspectionForm
        mode="edit"
        fixedClientId={inspection.data.clientId}
        initial={{
          clientId: inspection.data.clientId,
          projectId: inspection.data.projectId ?? '',
          title: inspection.data.title,
          inspectionDate: inspection.data.inspectionDate ?? '',
          status: inspection.data.status,
          summary: inspection.data.summary ?? '',
          suburb: inspection.data.suburb ?? '',
          suggestedWorks: inspection.data.suggestedWorks ?? '',
          remediationQuote: inspection.data.remediationQuote != null ? String(inspection.data.remediationQuote) : '',
          lastInspectionDate: inspection.data.lastInspectionDate ?? '',
          nextInspectionDate: inspection.data.nextInspectionDate ?? '',
        }}
        submitting={submitting}
        serverError={error}
        onSubmit={(values) => void handleSubmit(values)}
        onCancel={() => navigate(`/inspections/${id}`)}
      />
    </section>
  );
}
