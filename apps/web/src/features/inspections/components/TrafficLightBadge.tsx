import type { DueStatus } from '../types/inspection';

const LABELS: Record<DueStatus, string> = {
  green: 'Up to date',
  orange: 'Due',
  red: 'Overdue',
};

/** Renders the server-computed traffic light — never recomputes it. See DueStatus in types/inspection.ts. */
export function TrafficLightBadge({ status }: { status: DueStatus }) {
  return (
    <span className={`traffic-light-badge traffic-light-${status}`}>
      <span className="traffic-light-dot" aria-hidden="true" />
      {LABELS[status]}
    </span>
  );
}
