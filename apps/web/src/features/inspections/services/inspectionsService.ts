import { apiFetch } from '../../../services/apiClient';
import type { Paginated } from '../../../types/api';
import type { CreateInspectionInput, Inspection, InspectionsQuery, UpdateInspectionInput } from '../types/inspection';

// Thin wrapper around apps/api's /inspections routes (src/routes/v1/inspections.ts).
// No business logic here — just request shaping. Callers (hooks) own
// loading/error state.

export function listInspections(query: InspectionsQuery): Promise<Paginated<Inspection>> {
  return apiFetch<Paginated<Inspection>>('/inspections', { query: { ...query } });
}

export function getInspection(id: string): Promise<Inspection> {
  return apiFetch<{ inspection: Inspection }>(`/inspections/${id}`).then((res) => res.inspection);
}

export function createInspection(input: CreateInspectionInput): Promise<Inspection> {
  return apiFetch<{ inspection: Inspection }>('/inspections', { method: 'POST', body: input }).then(
    (res) => res.inspection
  );
}

export function updateInspection(id: string, input: UpdateInspectionInput): Promise<Inspection> {
  return apiFetch<{ inspection: Inspection }>(`/inspections/${id}`, { method: 'PATCH', body: input }).then(
    (res) => res.inspection
  );
}

export function deleteInspection(id: string): Promise<void> {
  return apiFetch<void>(`/inspections/${id}`, { method: 'DELETE' });
}
