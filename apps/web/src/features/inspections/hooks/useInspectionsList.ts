import { useCallback, useEffect, useState } from 'react';
import { ApiClientError } from '../../../services/apiClient';
import type { Paginated } from '../../../types/api';
import type { AsyncState } from '../../../types/asyncState';
import { listInspections } from '../services/inspectionsService';
import type { Inspection, InspectionsQuery } from '../types/inspection';

export function useInspectionsList(query: InspectionsQuery, enabled = true) {
  const [state, setState] = useState<AsyncState<Paginated<Inspection>>>({ status: 'loading' });
  // Query is small and JSON-serializable — stringifying it gives a stable
  // effect dependency without asking every caller to useMemo their filters.
  const queryKey = JSON.stringify(query);

  const load = useCallback(() => {
    if (!enabled) return;
    setState({ status: 'loading' });
    listInspections(query)
      .then((data) => setState({ status: 'success', data }))
      .catch((err) =>
        setState({
          status: 'error',
          error: err instanceof ApiClientError ? err.message : 'Failed to load inspections',
        })
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey, enabled]);

  useEffect(() => {
    load();
  }, [load]);

  return { ...state, refetch: load };
}
