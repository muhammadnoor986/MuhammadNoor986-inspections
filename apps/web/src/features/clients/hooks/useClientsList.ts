import { useCallback, useEffect, useState } from 'react';
import { ApiClientError } from '../../../services/apiClient';
import type { Paginated } from '../../../types/api';
import type { AsyncState } from '../../../types/asyncState';
import { listClients } from '../services/clientsService';
import type { Client, ClientsQuery } from '../types/client';

export function useClientsList(query: ClientsQuery) {
  const [state, setState] = useState<AsyncState<Paginated<Client>>>({ status: 'loading' });
  // Query is small and JSON-serializable — stringifying it gives a stable
  // effect dependency without asking every caller to useMemo their filters.
  const queryKey = JSON.stringify(query);

  const load = useCallback(() => {
    setState({ status: 'loading' });
    listClients(query)
      .then((data) => setState({ status: 'success', data }))
      .catch((err) =>
        setState({
          status: 'error',
          error: err instanceof ApiClientError ? err.message : 'Failed to load clients',
        })
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey]);

  useEffect(() => {
    load();
  }, [load]);

  return { ...state, refetch: load };
}
