import { apiFetch } from '../../../services/apiClient';
import type { Paginated } from '../../../types/api';
import type { Note } from '../types/inspection';

// Wraps apps/api's nested /inspections/:id/notes routes.

export function listInspectionNotes(inspectionId: string): Promise<Paginated<Note>> {
  return apiFetch<Paginated<Note>>(`/inspections/${inspectionId}/notes`, {
    query: { pageSize: 100, sortDir: 'desc' },
  });
}

export function createInspectionNote(inspectionId: string, body: string): Promise<Note> {
  return apiFetch<{ note: Note }>(`/inspections/${inspectionId}/notes`, {
    method: 'POST',
    body: { body },
  }).then((res) => res.note);
}
