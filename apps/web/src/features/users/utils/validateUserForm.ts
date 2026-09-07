// Mirrors inviteUserSchema / updateUserSchema in
// apps/api/src/schemas/users.schema.ts — kept in sync by hand since the web
// app doesn't share a validation library with the API. The API remains the
// source of truth; this only exists to give the user field-level feedback
// before a round trip.
import type { UserRole } from '../types/user';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface UserFormValues {
  /** Only used/validated in invite mode — the API doesn't allow changing it via update. */
  email: string;
  fullName: string;
  role: UserRole;
  /** '' means "no client selected" — required for every role except admin. */
  clientId: string;
}

export type UserFormErrors = Partial<Record<'email' | 'fullName' | 'clientId', string>>;

export function validateUserForm(values: UserFormValues, opts: { requireEmail: boolean }): UserFormErrors {
  const errors: UserFormErrors = {};

  if (opts.requireEmail) {
    const email = values.email.trim();
    if (!email) {
      errors.email = 'Email is required';
    } else if (!EMAIL_RE.test(email)) {
      errors.email = 'Email must be a valid email address';
    }
  }

  const fullName = values.fullName.trim();
  if (!fullName) {
    errors.fullName = 'Full name is required';
  } else if (fullName.length > 200) {
    errors.fullName = 'Full name must be 200 characters or fewer';
  }

  // Mirrors admin_has_no_client / client_user_has_client: every role except
  // admin requires a client; admin must not have one (enforced by the form
  // itself never submitting clientId when role === 'admin' — see UserForm).
  if (values.role !== 'admin' && !values.clientId) {
    errors.clientId = 'Client is required for this role';
  }

  return errors;
}
