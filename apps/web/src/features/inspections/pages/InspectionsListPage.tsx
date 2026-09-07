import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState } from '../../../components/EmptyState';
import { ErrorMessage } from '../../../components/ErrorMessage';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { Pagination } from '../../../components/Pagination';
import { useAuth } from '../../../hooks/useAuth';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { useProjectOptions } from '../../projects/hooks/useProjectOptions';
import {
  InspectionFilters,
  type InspectionFiltersValue,
  type QuickStatusFilter,
} from '../components/InspectionFilters';
import { InspectionsTable } from '../components/InspectionsTable';
import { useInspectionsList } from '../hooks/useInspectionsList';
import type { InspectionsQuery } from '../types/inspection';

const STATUS_FOR_QUICK_FILTER: Record<QuickStatusFilter, string | undefined> = {
  all: undefined,
  current: 'scheduled,in_progress',
  completed: 'completed',
  cancelled: 'cancelled',
};

const PAGE_SIZE = 20;

export function InspectionsListPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';

  const [filters, setFilters] = useState<InspectionFiltersValue>({
    search: '',
    statusFilter: 'current',
    trafficLightFilter: 'all',
    projectId: '',
    dateFrom: '',
    dateTo: '',
    dueDateFrom: '',
    dueDateTo: '',
    sortBy: 'next_inspection_date',
    sortDir: 'asc',
    clientId: '',
  });
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(filters.search);

  // "Address" isn't a real inspections column (it lives on the linked
  // project) — sortBy sent to the API falls back to due date, and the
  // loaded page is re-sorted client-side using the project address map
  // below. See useProjectOptions.
  const sortingByAddress = filters.sortBy === 'address';

  const query: InspectionsQuery = {
    page,
    pageSize: PAGE_SIZE,
    sortBy: filters.sortBy === 'address' ? 'next_inspection_date' : filters.sortBy,
    sortDir: filters.sortDir,
    status: STATUS_FOR_QUICK_FILTER[filters.statusFilter],
    dueStatus: filters.trafficLightFilter === 'all' ? undefined : filters.trafficLightFilter,
    projectId: filters.projectId || undefined,
    dateFrom: filters.dateFrom || undefined,
    dateTo: filters.dateTo || undefined,
    dueDateFrom: filters.dueDateFrom || undefined,
    dueDateTo: filters.dueDateTo || undefined,
    search: debouncedSearch.trim() || undefined,
    clientId: isAdmin && filters.clientId.trim() ? filters.clientId.trim() : undefined,
  };

  const result = useInspectionsList(query);
  const { options: projectOptions } = useProjectOptions(isAdmin ? filters.clientId.trim() || undefined : undefined);

  const projectAddressById = useMemo(
    () => new Map(projectOptions.map((p) => [p.id, p.address] as const)),
    [projectOptions]
  );

  const displayedItems = useMemo(() => {
    if (result.status !== 'success') return [];
    if (!sortingByAddress) return result.data.items;
    const addressOf = (projectId: string | null) => (projectId ? (projectAddressById.get(projectId) ?? '') : '');
    const sorted = [...result.data.items].sort((a, b) => addressOf(a.projectId).localeCompare(addressOf(b.projectId)));
    return filters.sortDir === 'desc' ? sorted.reverse() : sorted;
  }, [result, sortingByAddress, projectAddressById, filters.sortDir]);

  function handleFiltersChange(next: InspectionFiltersValue) {
    setFilters(next);
    setPage(1);
  }

  const isFiltered = Boolean(
    query.search ||
      filters.statusFilter !== 'all' ||
      filters.trafficLightFilter !== 'all' ||
      query.projectId ||
      query.dateFrom ||
      query.dueDateFrom ||
      query.clientId
  );

  return (
    <section>
      <div className="page-header">
        <h1>Inspections</h1>
        {isAdmin && (
          <Link to="/inspections/new" className="button-primary">
            New Inspection
          </Link>
        )}
      </div>

      <InspectionFilters value={filters} onChange={handleFiltersChange} isAdmin={isAdmin} projectOptions={projectOptions} />

      {result.status === 'loading' && <LoadingScreen label="Loading inspections…" />}

      {result.status === 'error' && <ErrorMessage title="Could not load inspections" message={result.error} />}

      {result.status === 'success' && result.data.items.length === 0 && (
        <EmptyState
          title={isFiltered ? 'No inspections match your filters' : 'No inspections yet'}
          message={
            isFiltered
              ? 'Try a different search term, project, or date range.'
              : isAdmin
                ? 'Create the first inspection to get started.'
                : 'Nothing has been added for your organization yet.'
          }
          action={
            isAdmin && !isFiltered ? (
              <Link to="/inspections/new" className="button-primary">
                New Inspection
              </Link>
            ) : undefined
          }
        />
      )}

      {result.status === 'success' && result.data.items.length > 0 && (
        <>
          <InspectionsTable inspections={displayedItems} projectAddressById={projectAddressById} />
          <Pagination meta={result.data.meta} onPageChange={setPage} />
        </>
      )}
    </section>
  );
}
