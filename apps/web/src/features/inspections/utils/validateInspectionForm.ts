// Mirrors createInspectionSchema / updateInspectionSchema in
// apps/api/src/schemas/inspections.schema.ts — kept in sync by hand since
// the web app doesn't share a validation library with the API. The API
// remains the source of truth; this only exists to give the user
// field-level feedback before a round trip.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface InspectionFormValues {
  clientId: string;
  projectId: string;
  title: string;
  inspectionDate: string;
  status: string;
  summary: string;
  suburb: string;
  suggestedWorks: string;
  remediationQuote: string;
  lastInspectionDate: string;
  nextInspectionDate: string;
}

export type InspectionFormErrors = Partial<Record<keyof InspectionFormValues, string>>;

export function validateInspectionForm(
  values: InspectionFormValues,
  opts: { requireClientId: boolean }
): InspectionFormErrors {
  const errors: InspectionFormErrors = {};

  // clientId is chosen from a <select> of real clients (see InspectionForm),
  // so it's either a known id or empty — no format to validate, only
  // presence. (projectId below is still free-typed indirectly via its own
  // dropdown value, but keeps its UUID check since that's unrelated to this.)
  if (opts.requireClientId && !values.clientId.trim()) {
    errors.clientId = 'Client is required';
  }

  if (values.projectId.trim() && !UUID_RE.test(values.projectId.trim())) {
    errors.projectId = 'Project ID must be a valid UUID';
  }

  const title = values.title.trim();
  if (!title) {
    errors.title = 'Title is required';
  } else if (title.length > 200) {
    errors.title = 'Title must be 200 characters or fewer';
  }

  if (values.summary.length > 5000) {
    errors.summary = 'Summary must be 5000 characters or fewer';
  }

  if (values.suburb.length > 200) {
    errors.suburb = 'Suburb must be 200 characters or fewer';
  }

  if (values.suggestedWorks.length > 5000) {
    errors.suggestedWorks = 'Suggested works must be 5000 characters or fewer';
  }

  if (values.remediationQuote.trim()) {
    const quote = Number(values.remediationQuote);
    if (Number.isNaN(quote) || quote < 0) {
      errors.remediationQuote = 'Remediation quote must be a non-negative number';
    }
  }

  return errors;
}
