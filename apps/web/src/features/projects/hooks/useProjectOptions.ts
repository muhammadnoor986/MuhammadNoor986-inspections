import { useEffect, useState } from 'react';
import { listProjects } from '../services/projectsService';

export interface ProjectOption {
  id: string;
  name: string;
  address: string | null;
}

/**
 * Lightweight project list for dropdowns (e.g. the Inspections "filter by
 * project" / "linked project" pickers) — reuses the real Projects API
 * instead of a separate lookup endpoint or, worse, hand-typed IDs.
 * `clientId` narrows the list once one is known (e.g. while creating an
 * inspection for a specific client); omit it to fetch across accessible
 * projects (what non-admins get anyway, since the API auto-scopes them).
 */
export function useProjectOptions(clientId?: string): { options: ProjectOption[]; loading: boolean } {
  const [options, setOptions] = useState<ProjectOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listProjects({ page: 1, pageSize: 100, sortBy: 'name', sortDir: 'asc', clientId })
      .then((result) => {
        if (!cancelled) setOptions(result.items.map((p) => ({ id: p.id, name: p.name, address: p.address })));
      })
      .catch(() => {
        if (!cancelled) setOptions([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  return { options, loading };
}
