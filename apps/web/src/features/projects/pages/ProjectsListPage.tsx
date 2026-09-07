import { useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState } from '../../../components/EmptyState';
import { ErrorMessage } from '../../../components/ErrorMessage';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { Pagination } from '../../../components/Pagination';
import { useAuth } from '../../../hooks/useAuth';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { ProjectFilters, type ProjectFiltersValue, type QuickStatusFilter } from '../components/ProjectFilters';
import { ProjectsTable } from '../components/ProjectsTable';
import { useProjectsList } from '../hooks/useProjectsList';
import type { ProjectsQuery } from '../types/project';

const STATUS_FOR_QUICK_FILTER: Record<QuickStatusFilter, string | undefined> = {
  all: undefined,
  current: 'active,on_hold',
  completed: 'completed',
  archived: 'archived',
};

const PAGE_SIZE = 20;

export function ProjectsListPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';

  const [filters, setFilters] = useState<ProjectFiltersValue>({
    search: '',
    statusFilter: 'current',
    sortBy: 'address',
    sortDir: 'asc',
    clientId: '',
  });
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(filters.search);

  const query: ProjectsQuery = {
    page,
    pageSize: PAGE_SIZE,
    sortBy: filters.sortBy,
    sortDir: filters.sortDir,
    status: STATUS_FOR_QUICK_FILTER[filters.statusFilter],
    search: debouncedSearch.trim() || undefined,
    clientId: isAdmin && filters.clientId.trim() ? filters.clientId.trim() : undefined,
  };

  const result = useProjectsList(query);

  function handleFiltersChange(next: ProjectFiltersValue) {
    setFilters(next);
    setPage(1);
  }

  const isFiltered = Boolean(query.search || filters.statusFilter !== 'all' || query.clientId);

  return (
    <section>
      <div className="page-header">
        <h1>Projects</h1>
        {isAdmin && (
          <Link to="/projects/new" className="button-primary">
            New Project
          </Link>
        )}
      </div>

      <ProjectFilters value={filters} onChange={handleFiltersChange} isAdmin={isAdmin} />

      {result.status === 'loading' && <LoadingScreen label="Loading projects…" />}

      {result.status === 'error' && (
        <ErrorMessage title="Could not load projects" message={result.error} />
      )}

      {result.status === 'success' && result.data.items.length === 0 && (
        <EmptyState
          title={isFiltered ? 'No projects match your filters' : 'No projects yet'}
          message={
            isFiltered
              ? 'Try a different search term or status.'
              : isAdmin
                ? 'Create the first project to get started.'
                : 'Nothing has been added for your organization yet.'
          }
          action={
            isAdmin && !isFiltered ? (
              <Link to="/projects/new" className="button-primary">
                New Project
              </Link>
            ) : undefined
          }
        />
      )}

      {result.status === 'success' && result.data.items.length > 0 && (
        <>
          <ProjectsTable projects={result.data.items} />
          <Pagination meta={result.data.meta} onPageChange={setPage} />
        </>
      )}
    </section>
  );
}
