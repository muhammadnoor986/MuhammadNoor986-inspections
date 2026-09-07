import { useNavigate } from 'react-router-dom';
import { useAsyncAction } from '../../../hooks/useAsyncAction';
import { ProjectForm } from '../components/ProjectForm';
import { createProject } from '../services/projectsService';
import type { CreateProjectInput, ProjectStatus } from '../types/project';
import type { ProjectFormValues } from '../utils/validateProjectForm';

export function ProjectCreatePage() {
  const navigate = useNavigate();
  const { run, submitting, error } = useAsyncAction(createProject);

  async function handleSubmit(values: ProjectFormValues) {
    const input: CreateProjectInput = {
      clientId: values.clientId.trim(),
      name: values.name.trim(),
      description: values.description.trim() || undefined,
      address: values.address.trim() || undefined,
      status: values.status as ProjectStatus,
    };
    const result = await run(input);
    if (result.ok) navigate(`/projects/${result.data.id}`);
  }

  return (
    <section>
      <h1>New Project</h1>
      <ProjectForm
        mode="create"
        submitting={submitting}
        serverError={error}
        onSubmit={(values) => void handleSubmit(values)}
        onCancel={() => navigate('/projects')}
      />
    </section>
  );
}
