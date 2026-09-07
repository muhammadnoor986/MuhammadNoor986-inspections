import { useCallback, useEffect, useState } from 'react';
import { ApiClientError } from '../../../services/apiClient';
import type { AsyncState } from '../../../types/asyncState';
import { getUser } from '../services/usersService';
import type { User } from '../types/user';

export function useUser(id: string | undefined) {
  const [state, setState] = useState<AsyncState<User>>({ status: 'loading' });

  const load = useCallback(() => {
    if (!id) return;
    setState({ status: 'loading' });
    getUser(id)
      .then((data) => setState({ status: 'success', data }))
      .catch((err) =>
        setState({
          status: 'error',
          error: err instanceof ApiClientError ? err.message : 'Failed to load this user',
        })
      );
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  return { ...state, refetch: load };
}
