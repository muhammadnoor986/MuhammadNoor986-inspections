import { useCallback, useEffect, useState } from 'react';
import { ApiClientError } from '../../../services/apiClient';
import type { AsyncState } from '../../../types/asyncState';
import { createInspectionNote, listInspectionNotes } from '../services/notesService';
import type { Note } from '../types/inspection';

export function useInspectionNotes(inspectionId: string | undefined) {
  const [state, setState] = useState<AsyncState<Note[]>>({ status: 'loading' });

  const load = useCallback(() => {
    if (!inspectionId) return;
    setState({ status: 'loading' });
    listInspectionNotes(inspectionId)
      .then((data) => setState({ status: 'success', data: data.items }))
      .catch((err) =>
        setState({ status: 'error', error: err instanceof ApiClientError ? err.message : 'Failed to load notes' })
      );
  }, [inspectionId]);

  useEffect(() => {
    load();
  }, [load]);

  const addNote = useCallback(
    async (body: string) => {
      if (!inspectionId) return;
      const note = await createInspectionNote(inspectionId, body);
      setState((prev) => (prev.status === 'success' ? { status: 'success', data: [note, ...prev.data] } : prev));
    },
    [inspectionId]
  );

  return { ...state, refetch: load, addNote };
}
