import { useCallback, useEffect, useState } from 'react';
import { ApiClientError } from '../../../services/apiClient';
import type { AsyncState } from '../../../types/asyncState';
import { acknowledgeInspection, listAcknowledgements } from '../services/acknowledgementsService';
import type { Acknowledgement } from '../types/inspection';

export function useAcknowledgements(inspectionId: string | undefined) {
  const [state, setState] = useState<AsyncState<Acknowledgement[]>>({ status: 'loading' });

  const load = useCallback(() => {
    if (!inspectionId) return;
    setState({ status: 'loading' });
    listAcknowledgements(inspectionId)
      .then((data) => setState({ status: 'success', data: data.items }))
      .catch((err) =>
        setState({
          status: 'error',
          error: err instanceof ApiClientError ? err.message : 'Failed to load acknowledgement history',
        })
      );
  }, [inspectionId]);

  useEffect(() => {
    load();
  }, [load]);

  const acknowledge = useCallback(async () => {
    if (!inspectionId) throw new Error('No inspection to acknowledge');
    const created = await acknowledgeInspection(inspectionId);
    setState((prev) => (prev.status === 'success' ? { status: 'success', data: [created, ...prev.data] } : prev));
    return created;
  }, [inspectionId]);

  return { ...state, refetch: load, acknowledge };
}
