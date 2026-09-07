import type { ProjectSortField } from '../types/project';

export type QuickStatusFilter = 'all' | 'current' | 'completed' | 'archived';

const QUICK_FILTERS: { value: QuickStatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'current', label: 'Current' },
  { value: 'completed', label: 'Completed' },
  { value: 'archived', label: 'Archived' },
];

const SORT_OPTIONS: { value: ProjectSortField; label: string }[] = [
  { value: 'address', label: 'Address' },
  { value: 'name', label: 'Name' },
  { value: 'status', label: 'Status' },
  { value: 'updated_at', label: 'Last updated' },
  { value: 'created_at', label: 'Date created' },
];

export interface ProjectFiltersValue {
  search: string;
  statusFilter: QuickStatusFilter;
  sortBy: ProjectSortField;
  sortDir: 'asc' | 'desc';
  /** Admin-only. */
  clientId: string;
}

export function ProjectFilters({
  value,
  onChange,
  isAdmin,
}: {
  value: ProjectFiltersValue;
  onChange: (next: ProjectFiltersValue) => void;
  isAdmin: boolean;
}) {
  return (
    <div className="project-filters">
      <input
        type="search"
        placeholder="Search by name or address…"
        value={value.search}
        onChange={(e) => onChange({ ...value, search: e.target.value })}
        aria-label="Search projects"
      />

      <div className="quick-filters" role="group" aria-label="Filter by status">
        {QUICK_FILTERS.map((filter) => (
          <button
            key={filter.value}
            type="button"
            className={filter.value === value.statusFilter ? 'active' : ''}
            onClick={() => onChange({ ...value, statusFilter: filter.value })}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <label className="filter-field">
        Sort by
        <select
          value={value.sortBy}
          onChange={(e) => onChange({ ...value, sortBy: e.target.value as ProjectSortField })}
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>

      <button
        type="button"
        className="sort-dir-toggle"
        onClick={() => onChange({ ...value, sortDir: value.sortDir === 'asc' ? 'desc' : 'asc' })}
        aria-label={`Sort direction: ${value.sortDir === 'asc' ? 'ascending' : 'descending'}`}
        title={value.sortDir === 'asc' ? 'Ascending' : 'Descending'}
      >
        {value.sortDir === 'asc' ? '↑' : '↓'}
      </button>

      {isAdmin && (
        <label className="filter-field">
          Client ID
          <input
            type="text"
            placeholder="All clients"
            value={value.clientId}
            onChange={(e) => onChange({ ...value, clientId: e.target.value })}
            aria-label="Filter by client ID"
          />
        </label>
      )}
    </div>
  );
}
