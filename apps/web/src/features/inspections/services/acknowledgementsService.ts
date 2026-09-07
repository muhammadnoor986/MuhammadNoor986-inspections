import { apiFetch } from '../../../services/apiClient';
import type { Paginated } from '../../../types/api';
import type { Acknowledgement } from '../types/inspection';

// Wraps apps/api's nested /inspections/:id/acknowledge(ments) routes.

export function listAcknowledgements(inspectionId: string): Promise<Paginated<Acknowledgement>> {
  return apiFetch<Paginated<Acknowledgement>>(`/inspections/${inspectionId}/acknowledgements`, {
    query: { pageSize: 20, sortDir: 'desc' },
  });
}

export function acknowledgeInspection(inspectionId: string): Promise<Acknowledgement> {
  return apiFetch<{ acknowledgement: Acknowledgement }>(`/inspections/${inspectionId}/acknowledge`, {
    method: 'POST',
  }).then((res) => res.acknowledgement);
}
