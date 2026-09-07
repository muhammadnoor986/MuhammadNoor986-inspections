import { useNavigate } from 'react-router-dom';
import { InspectionStatusBadge } from './InspectionStatusBadge';
import { TrafficLightBadge } from './TrafficLightBadge';
import type { Inspection } from '../types/inspection';

export function InspectionsTable({
  inspections,
  projectAddressById,
}: {
  inspections: Inspection[];
  /** projectId -> address, for the "Address" column — see useProjectOptions in ProjectsListPage's inspections counterpart. */
  projectAddressById: Map<string, string | null>;
}) {
  const navigate = useNavigate();

  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Title</th>
          <th>Address</th>
          <th>Suburb</th>
          <th>Status</th>
          <th>Inspection date</th>
          <th>Due date</th>
          <th>Due status</th>
        </tr>
      </thead>
      <tbody>
        {inspections.map((inspection) => {
          const address = inspection.projectId ? (projectAddressById.get(inspection.projectId) ?? null) : null;
          return (
            <tr
              key={inspection.id}
              className="clickable-row"
              tabIndex={0}
              onClick={() => navigate(`/inspections/${inspection.id}`)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') navigate(`/inspections/${inspection.id}`);
              }}
            >
              <td>{inspection.title}</td>
              <td>{address || '—'}</td>
              <td>{inspection.suburb || '—'}</td>
              <td>
                <InspectionStatusBadge status={inspection.status} />
              </td>
              <td>{inspection.inspectionDate ?? '—'}</td>
              <td>{inspection.nextInspectionDate ?? '—'}</td>
              <td>
                <TrafficLightBadge status={inspection.dueStatus} />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
