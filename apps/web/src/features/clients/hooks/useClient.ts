import { useCallback, useEffect, useState } from 'react';
import { ApiClientError } from '../../../services/apiClient';
import type { AsyncState } from '../../../types/asyncState';
import { getClient } from '../services/clientsService';
import type { Client } from '../types/client';

export function useClient(id: string | undefined) {
  const [state, setState] = useState<AsyncState<Client>>({ status: 'loading' });

  const load = useCallback(() => {
    if (!id) return;
    setState({ status: 'loading' });
    getClient(id)
      .then((data) => setState({ status: 'success', data }))
      .catch((err) =>
        setState({
          status: 'error',
          error: err instanceof ApiClientError ? err.message : 'Failed to load this client',
        })
      );
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  return { ...state, refetch: load };
}
