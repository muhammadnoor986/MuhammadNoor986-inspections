import { apiFetch } from '../../../services/apiClient';
import type { Paginated } from '../../../types/api';
import type { CreateProjectInput, Project, ProjectsQuery, UpdateProjectInput } from '../types/project';

// Thin wrapper around apps/api's /projects routes (src/routes/v1/projects.ts).
// No business logic here — just request shaping. Callers (hooks) own
// loading/error state.

export function listProjects(query: ProjectsQuery): Promise<Paginated<Project>> {
  return apiFetch<Paginated<Project>>('/projects', { query: { ...query } });
}

export function getProject(id: string): Promise<Project> {
  return apiFetch<{ project: Project }>(`/projects/${id}`).then((res) => res.project);
}

export function createProject(input: CreateProjectInput): Promise<Project> {
  return apiFetch<{ project: Project }>('/projects', { method: 'POST', body: input }).then((res) => res.project);
}

export function updateProject(id: string, input: UpdateProjectInput): Promise<Project> {
  return apiFetch<{ project: Project }>(`/projects/${id}`, { method: 'PATCH', body: input }).then(
    (res) => res.project
  );
}

export function deleteProject(id: string): Promise<void> {
  return apiFetch<void>(`/projects/${id}`, { method: 'DELETE' });
}
