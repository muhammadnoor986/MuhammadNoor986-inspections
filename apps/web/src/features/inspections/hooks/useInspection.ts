import { useCallback, useEffect, useState } from 'react';
import { ApiClientError } from '../../../services/apiClient';
import type { AsyncState } from '../../../types/asyncState';
import { getInspection } from '../services/inspectionsService';
import type { Inspection } from '../types/inspection';

export function useInspection(id: string | undefined) {
  const [state, setState] = useState<AsyncState<Inspection>>({ status: 'loading' });

  const load = useCallback(() => {
    if (!id) return;
    setState({ status: 'loading' });
    getInspection(id)
      .then((data) => setState({ status: 'success', data }))
      .catch((err) =>
        setState({
          status: 'error',
          error: err instanceof ApiClientError ? err.message : 'Failed to load this inspection',
        })
      );
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  return { ...state, refetch: load };
}
