import { useNavigate } from 'react-router-dom';
import { useAsyncAction } from '../../../hooks/useAsyncAction';
import { InspectionForm } from '../components/InspectionForm';
import { createInspection } from '../services/inspectionsService';
import type { CreateInspectionInput, InspectionStatus } from '../types/inspection';
import type { InspectionFormValues } from '../utils/validateInspectionForm';

export function InspectionCreatePage() {
  const navigate = useNavigate();
  const { run, submitting, error } = useAsyncAction(createInspection);

  async function handleSubmit(values: InspectionFormValues) {
    const input: CreateInspectionInput = {
      clientId: values.clientId.trim(),
      projectId: values.projectId.trim() || undefined,
      title: values.title.trim(),
      inspectionDate: values.inspectionDate || undefined,
      status: values.status as InspectionStatus,
      summary: values.summary.trim() || undefined,
      suburb: values.suburb.trim() || undefined,
      suggestedWorks: values.suggestedWorks.trim() || undefined,
      remediationQuote: values.remediationQuote.trim() ? Number(values.remediationQuote) : undefined,
      lastInspectionDate: values.lastInspectionDate || undefined,
      nextInspectionDate: values.nextInspectionDate || undefined,
    };
    const result = await run(input);
    if (result.ok) navigate(`/inspections/${result.data.id}`);
  }

  return (
    <section>
      <h1>New Inspection</h1>
      <InspectionForm
        mode="create"
        submitting={submitting}
        serverError={error}
        onSubmit={(values) => void handleSubmit(values)}
        onCancel={() => navigate('/inspections')}
      />
    </section>
  );
}
