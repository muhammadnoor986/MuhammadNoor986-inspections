import { useCallback, useEffect, useState } from 'react';
import { ApiClientError } from '../../../services/apiClient';
import type { Paginated } from '../../../types/api';
import type { AsyncState } from '../../../types/asyncState';
import { listProjects } from '../services/projectsService';
import type { Project, ProjectsQuery } from '../types/project';

export function useProjectsList(query: ProjectsQuery) {
  const [state, setState] = useState<AsyncState<Paginated<Project>>>({ status: 'loading' });
  // Query is small and JSON-serializable — stringifying it gives a stable
  // effect dependency without asking every caller to useMemo their filters.
  const queryKey = JSON.stringify(query);

  const load = useCallback(() => {
    setState({ status: 'loading' });
    listProjects(query)
      .then((data) => setState({ status: 'success', data }))
      .catch((err) =>
        setState({
          status: 'error',
          error: err instanceof ApiClientError ? err.message : 'Failed to load projects',
        })
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey]);

  useEffect(() => {
    load();
  }, [load]);

  return { ...state, refetch: load };
}
