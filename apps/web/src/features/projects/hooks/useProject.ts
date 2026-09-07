import { useCallback, useEffect, useState } from 'react';
import { ApiClientError } from '../../../services/apiClient';
import type { AsyncState } from '../../../types/asyncState';
import { getProject } from '../services/projectsService';
import type { Project } from '../types/project';

export function useProject(id: string | undefined) {
  const [state, setState] = useState<AsyncState<Project>>({ status: 'loading' });

  const load = useCallback(() => {
    if (!id) return;
    setState({ status: 'loading' });
    getProject(id)
      .then((data) => setState({ status: 'success', data }))
      .catch((err) =>
        setState({
          status: 'error',
          error: err instanceof ApiClientError ? err.message : 'Failed to load this project',
        })
      );
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  return { ...state, refetch: load };
}
