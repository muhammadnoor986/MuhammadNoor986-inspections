// Mirrors createProjectSchema / updateProjectSchema in
// apps/api/src/schemas/projects.schema.ts — kept in sync by hand since the
// web app doesn't share a validation library with the API. The API remains
// the source of truth; this only exists to give the user field-level
// feedback before a round trip.

export interface ProjectFormValues {
  clientId: string;
  name: string;
  description: string;
  address: string;
  status: string;
}

export type ProjectFormErrors = Partial<Record<keyof ProjectFormValues, string>>;

export function validateProjectForm(values: ProjectFormValues, opts: { requireClientId: boolean }): ProjectFormErrors {
  const errors: ProjectFormErrors = {};

  // clientId is chosen from a <select> of real clients (see ProjectForm),
  // so it's either a known id or empty — no format to validate, only
  // presence.
  if (opts.requireClientId && !values.clientId.trim()) {
    errors.clientId = 'Client is required';
  }

  const name = values.name.trim();
  if (!name) {
    errors.name = 'Name is required';
  } else if (name.length > 200) {
    errors.name = 'Name must be 200 characters or fewer';
  }

  if (values.description.length > 5000) {
    errors.description = 'Description must be 5000 characters or fewer';
  }

  if (values.address.length > 500) {
    errors.address = 'Address must be 500 characters or fewer';
  }

  return errors;
}
