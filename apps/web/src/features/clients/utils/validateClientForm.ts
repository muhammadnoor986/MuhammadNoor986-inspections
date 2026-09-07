// Mirrors createClientSchema / updateClientSchema in
// apps/api/src/schemas/clients.schema.ts — kept in sync by hand since the
// web app doesn't share a validation library with the API. The API remains
// the source of truth; this only exists to give the user field-level
// feedback before a round trip.

export interface ClientFormValues {
  name: string;
  canAccessProjects: boolean;
  canAccessInspections: boolean;
}

export type ClientFormErrors = Partial<Record<'name', string>>;

export function validateClientForm(values: ClientFormValues): ClientFormErrors {
  const errors: ClientFormErrors = {};

  const name = values.name.trim();
  if (!name) {
    errors.name = 'Client name is required';
  } else if (name.length > 200) {
    errors.name = 'Client name must be 200 characters or fewer';
  }

  return errors;
}
