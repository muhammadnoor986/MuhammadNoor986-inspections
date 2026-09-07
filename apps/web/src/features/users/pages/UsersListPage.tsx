import { useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState } from '../../../components/EmptyState';
import { ErrorMessage } from '../../../components/ErrorMessage';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { Pagination } from '../../../components/Pagination';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { useClientOptions } from '../../clients/hooks/useClientOptions';
import { UserFilters, type UserFiltersValue } from '../components/UserFilters';
import { UsersTable } from '../components/UsersTable';
import { useUsersList } from '../hooks/useUsersList';
import type { UsersQuery } from '../types/user';

const IS_ACTIVE_FOR_QUICK_FILTER: Record<'all' | 'active' | 'inactive', 'true' | 'false' | undefined> = {
  all: undefined,
  active: 'true',
  inactive: 'false',
};

const PAGE_SIZE = 20;

export function UsersListPage() {
  const [filters, setFilters] = useState<UserFiltersValue>({
    search: '',
    roleFilter: 'all',
    clientId: '',
    statusFilter: 'all',
    sortBy: 'email',
    sortDir: 'asc',
  });
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(filters.search);
  // Filtering should be able to find users on an already-deactivated
  // client, unlike the assignment dropdowns in UserForm — so this widens
  // the options beyond the default active-only set.
  const { options: clientOptions } = useClientOptions({ includeInactive: true });

  const query: UsersQuery = {
    page,
    pageSize: PAGE_SIZE,
    sortBy: filters.sortBy,
    sortDir: filters.sortDir,
    search: debouncedSearch.trim() || undefined,
    role: filters.roleFilter === 'all' ? undefined : filters.roleFilter,
    clientId: filters.clientId || undefined,
    isActive: IS_ACTIVE_FOR_QUICK_FILTER[filters.statusFilter],
  };

  const result = useUsersList(query);

  function handleFiltersChange(next: UserFiltersValue) {
    setFilters(next);
    setPage(1);
  }

  const isFiltered = Boolean(query.search || query.role || query.clientId || filters.statusFilter !== 'all');

  return (
    <section>
      <div className="page-header">
        <h1>Users</h1>
        <Link to="/users/new" className="button-primary">
          Invite User
        </Link>
      </div>

      <UserFilters value={filters} onChange={handleFiltersChange} clientOptions={clientOptions} />

      {result.status === 'loading' && <LoadingScreen label="Loading users…" />}

      {result.status === 'error' && <ErrorMessage title="Could not load users" message={result.error} />}

      {result.status === 'success' && result.data.items.length === 0 && (
        <EmptyState
          title={isFiltered ? 'No users match your filters' : 'No users yet'}
          message={
            isFiltered ? 'Try a different search term, role, client, or status.' : 'Invite the first user to get started.'
          }
          action={
            !isFiltered ? (
              <Link to="/users/new" className="button-primary">
                Invite User
              </Link>
            ) : undefined
          }
        />
      )}

      {result.status === 'success' && result.data.items.length > 0 && (
        <>
          <UsersTable users={result.data.items} onChanged={result.refetch} />
          <Pagination meta={result.data.meta} onPageChange={setPage} />
        </>
      )}
    </section>
  );
}
