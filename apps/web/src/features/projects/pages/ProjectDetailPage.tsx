import { useCallback, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { ErrorMessage } from '../../../components/ErrorMessage';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { useAsyncAction } from '../../../hooks/useAsyncAction';
import { useAuth } from '../../../hooks/useAuth';
import { ProjectPhotoGallery } from '../../attachments/components/ProjectPhotoGallery';
import { ProjectInspectionStatus } from '../../inspections/components/ProjectInspectionStatus';
import { ProjectStatusBadge } from '../components/ProjectStatusBadge';
import { useProject } from '../hooks/useProject';
import { deleteProject } from '../services/projectsService';

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const project = useProject(id);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const removeAction = useCallback(() => deleteProject(id!), [id]);
  const { run: runDelete, submitting: deleting, error: deleteError } = useAsyncAction(removeAction);

  if (!id) return <Navigate to="/projects" replace />;

  if (project.status === 'loading') return <LoadingScreen label="Loading project…" />;

  if (project.status === 'error') {
    return (
      <section>
        <ErrorMessage title="Could not load this project" message={project.error} />
        <p>
          <Link to="/projects">Back to projects</Link>
        </p>
      </section>
    );
  }

  const isAdmin = profile?.role === 'admin';
  const { data: proj } = project;

  async function handleDelete() {
    const result = await runDelete();
    if (result.ok) navigate('/projects');
  }

  return (
    <section>
      <div className="page-header">
        <h1>{proj.name}</h1>
        {isAdmin && (
          <div className="page-actions">
            <Link to={`/projects/${proj.id}/edit`} className="button-primary">
              Edit
            </Link>
            <button type="button" className="danger" onClick={() => setConfirmingDelete(true)}>
              Delete
            </button>
          </div>
        )}
      </div>

      {deleteError && <ErrorMessage title="Could not delete this project" message={deleteError} />}

      <dl className="detail-list">
        <dt>Status</dt>
        <dd>
          <ProjectStatusBadge status={proj.status} />
        </dd>
        <dt>Address</dt>
        <dd>{proj.address || '—'}</dd>
        <dt>Description</dt>
        <dd>{proj.description || '—'}</dd>
        <dt>Last updated</dt>
        <dd>{new Date(proj.updatedAt).toLocaleString()}</dd>
      </dl>

      <ProjectInspectionStatus projectId={proj.id} />

      <ProjectPhotoGallery projectId={proj.id} />

      <p>
        <Link to="/projects">Back to projects</Link>
      </p>

      {confirmingDelete && (
        <ConfirmDialog
          title="Delete project"
          message={`Delete "${proj.name}"? This cannot be undone.`}
          confirmLabel="Delete"
          busy={deleting}
          onCancel={() => setConfirmingDelete(false)}
          onConfirm={() => void handleDelete()}
        />
      )}
    </section>
  );
}
