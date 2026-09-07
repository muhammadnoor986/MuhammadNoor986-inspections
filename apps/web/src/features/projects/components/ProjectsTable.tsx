import { useNavigate } from 'react-router-dom';
import { ProjectStatusBadge } from './ProjectStatusBadge';
import type { Project } from '../types/project';

export function ProjectsTable({ projects }: { projects: Project[] }) {
  const navigate = useNavigate();

  return (
    <table className="data-table">
      <thead>
        <tr>
          <th>Name</th>
          <th>Address</th>
          <th>Status</th>
          <th>Last updated</th>
        </tr>
      </thead>
      <tbody>
        {projects.map((project) => (
          <tr
            key={project.id}
            className="clickable-row"
            tabIndex={0}
            onClick={() => navigate(`/projects/${project.id}`)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') navigate(`/projects/${project.id}`);
            }}
          >
            <td>{project.name}</td>
            <td>{project.address || '—'}</td>
            <td>
              <ProjectStatusBadge status={project.status} />
            </td>
            <td>{new Date(project.updatedAt).toLocaleDateString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
