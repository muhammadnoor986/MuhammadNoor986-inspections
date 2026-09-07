import type { InspectionStatus } from '../types/inspection';

const LABELS: Record<InspectionStatus, string> = {
  scheduled: 'Scheduled',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export function InspectionStatusBadge({ status }: { status: InspectionStatus }) {
  return <span className={`status-badge inspection-status-${status}`}>{LABELS[status]}</span>;
}
