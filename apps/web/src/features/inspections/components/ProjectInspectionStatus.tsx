import { ErrorMessage } from '../../../components/ErrorMessage';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { useAuth } from '../../../hooks/useAuth';
import { useInspectionsList } from '../hooks/useInspectionsList';
import { TrafficLightBadge } from './TrafficLightBadge';
import type { DueStatus } from '../types/inspection';

const SEVERITY: Record<DueStatus, number> = { red: 0, orange: 1, green: 2 };

/**
 * Project/property-level rollup of its inspections' traffic-light status —
 * "worst" color wins (a project with one overdue inspection reads as
 * overdue, even if its other inspections are up to date). Hidden entirely
 * for a caller without inspections module access, same as the Inspections
 * nav link (see AppLayout).
 */
export function ProjectInspectionStatus({ projectId }: { projectId: string }) {
  const { profile } = useAuth();
  const hasInspectionsAccess = profile?.role === 'admin' || profile?.canAccessInspections;

  const result = useInspectionsList({ projectId, pageSize: 100 }, hasInspectionsAccess);

  if (!hasInspectionsAccess) return null;
  if (result.status === 'loading') return <LoadingScreen label="Loading inspection status…" />;
  if (result.status === 'error') return <ErrorMessage title="Could not load inspection status" message={result.error} />;
  if (result.data.items.length === 0) return null;

  const worst = result.data.items.reduce((current, inspection) =>
    SEVERITY[inspection.dueStatus] < SEVERITY[current.dueStatus] ? inspection : current
  );

  return (
    <section className="project-inspection-status">
      <h2>Inspection Status</h2>
      <p>
        <TrafficLightBadge status={worst.dueStatus} /> across {result.data.items.length} inspection
        {result.data.items.length === 1 ? '' : 's'}
      </p>
    </section>
  );
}
