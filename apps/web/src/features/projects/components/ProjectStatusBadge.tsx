import type { ProjectStatus } from '../types/project';

const LABELS: Record<ProjectStatus, string> = {
  active: 'Active',
  on_hold: 'On Hold',
  completed: 'Completed',
  archived: 'Archived',
};

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  return <span className={`status-badge status-${status}`}>{LABELS[status]}</span>;
}
