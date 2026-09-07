import { useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState } from '../../../components/EmptyState';
import { ErrorMessage } from '../../../components/ErrorMessage';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { Pagination } from '../../../components/Pagination';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { ClientFilters, type ClientFiltersValue, type QuickStatusFilter } from '../components/ClientFilters';
import { ClientsTable } from '../components/ClientsTable';
import { useClientsList } from '../hooks/useClientsList';
import type { ClientsQuery } from '../types/client';

const IS_ACTIVE_FOR_QUICK_FILTER: Record<QuickStatusFilter, 'true' | 'false' | undefined> = {
  all: undefined,
  active: 'true',
  inactive: 'false',
};

const PAGE_SIZE = 20;

export function ClientsListPage() {
  const [filters, setFilters] = useState<ClientFiltersValue>({
    search: '',
    statusFilter: 'all',
    sortBy: 'name',
    sortDir: 'asc',
  });
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(filters.search);

  const query: ClientsQuery = {
    page,
    pageSize: PAGE_SIZE,
    sortBy: filters.sortBy,
    sortDir: filters.sortDir,
    search: debouncedSearch.trim() || undefined,
    isActive: IS_ACTIVE_FOR_QUICK_FILTER[filters.statusFilter],
  };

  const result = useClientsList(query);

  function handleFiltersChange(next: ClientFiltersValue) {
    setFilters(next);
    setPage(1);
  }

  const isFiltered = Boolean(query.search || filters.statusFilter !== 'all');

  return (
    <section>
      <div className="page-header">
        <h1>Clients</h1>
        <Link to="/clients/new" className="button-primary">
          New Client
        </Link>
      </div>

      <ClientFilters value={filters} onChange={handleFiltersChange} />

      {result.status === 'loading' && <LoadingScreen label="Loading clients…" />}

      {result.status === 'error' && <ErrorMessage title="Could not load clients" message={result.error} />}

      {result.status === 'success' && result.data.items.length === 0 && (
        <EmptyState
          title={isFiltered ? 'No clients match your filters' : 'No clients yet'}
          message={isFiltered ? 'Try a different search term or status.' : 'Create the first client to get started.'}
          action={
            !isFiltered ? (
              <Link to="/clients/new" className="button-primary">
                New Client
              </Link>
            ) : undefined
          }
        />
      )}

      {result.status === 'success' && result.data.items.length > 0 && (
        <>
          <ClientsTable clients={result.data.items} onChanged={result.refetch} />
          <Pagination meta={result.data.meta} onPageChange={setPage} />
        </>
      )}
    </section>
  );
}
