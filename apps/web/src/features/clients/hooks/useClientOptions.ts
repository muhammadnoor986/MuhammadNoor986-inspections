import { useEffect, useState } from 'react';
import { ApiClientError } from '../../../services/apiClient';
import { listClients } from '../services/clientsService';

export interface ClientOption {
  id: string;
  name: string;
  isActive: boolean;
}

/**
 * Lightweight client list for dropdowns (e.g. the Users feature's client
 * assignment/filter pickers, and the Project/Inspection forms' client
 * selector) — reuses the real Clients API (listClients) instead of a
 * separate lookup endpoint or hand-typed IDs, mirroring
 * features/projects/hooks/useProjectOptions.ts.
 *
 * Defaults to active clients only, since only an active client should
 * normally receive a new non-admin user or a newly-created Project/
 * Inspection. Pass includeInactive for a filter dropdown or an edit form
 * that needs to keep resolving an already-assigned client even after it's
 * been deactivated — hiding it there would make existing records/users
 * impossible to find or display correctly.
 */
export function useClientOptions(opts: { includeInactive?: boolean } = {}): {
  options: ClientOption[];
  loading: boolean;
  /** Set when the fetch itself failed — distinct from a successful fetch that just returned zero clients. */
  error: string | null;
} {
  const { includeInactive = false } = opts;
  const [options, setOptions] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    listClients({ page: 1, pageSize: 100, sortBy: 'name', sortDir: 'asc', isActive: includeInactive ? undefined : 'true' })
      .then((result) => {
        if (!cancelled) setOptions(result.items.map((c) => ({ id: c.id, name: c.name, isActive: c.isActive })));
      })
      .catch((err) => {
        if (!cancelled) {
          setOptions([]);
          setError(err instanceof ApiClientError ? err.message : 'Failed to load clients');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [includeInactive]);

  return { options, loading, error };
}
