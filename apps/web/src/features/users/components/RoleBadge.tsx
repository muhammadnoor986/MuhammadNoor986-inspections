import type { UserRole } from '../types/user';

const LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  upload_notes: 'Upload & Notes',
  view_only: 'View Only',
};

// Role isn't a status with a meaningful color axis (unlike active/inactive),
// so this deliberately reuses the neutral archived/grey badge style for
// every role rather than inventing new CSS just for color-coding roles.
export function RoleBadge({ role }: { role: UserRole }) {
  return <span className="status-badge status-archived">{LABELS[role]}</span>;
}
