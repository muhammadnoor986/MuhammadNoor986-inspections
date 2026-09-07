import { useCallback } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { ErrorMessage } from '../../../components/ErrorMessage';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { useAsyncAction } from '../../../hooks/useAsyncAction';
import { ProjectForm } from '../components/ProjectForm';
import { useProject } from '../hooks/useProject';
import { updateProject } from '../services/projectsService';
import type { ProjectStatus, UpdateProjectInput } from '../types/project';
import type { ProjectFormValues } from '../utils/validateProjectForm';

export function ProjectEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const project = useProject(id);

  const submit = useCallback((input: UpdateProjectInput) => updateProject(id!, input), [id]);
  const { run, submitting, error } = useAsyncAction(submit);

  if (!id) return <Navigate to="/projects" replace />;

  if (project.status === 'loading') return <LoadingScreen label="Loading project…" />;
  if (project.status === 'error') return <ErrorMessage title="Could not load this project" message={project.error} />;

  async function handleSubmit(values: ProjectFormValues) {
    const input: UpdateProjectInput = {
      name: values.name.trim(),
      description: values.description.trim(),
      address: values.address.trim(),
      status: values.status as ProjectStatus,
    };
    const result = await run(input);
    if (result.ok) navigate(`/projects/${result.data.id}`);
  }

  return (
    <section>
      <h1>Edit Project</h1>
      <ProjectForm
        mode="edit"
        initial={{
          clientId: project.data.clientId,
          name: project.data.name,
          description: project.data.description ?? '',
          address: project.data.address ?? '',
          status: project.data.status,
        }}
        submitting={submitting}
        serverError={error}
        onSubmit={(values) => void handleSubmit(values)}
        onCancel={() => navigate(`/projects/${id}`)}
      />
    </section>
  );
}
