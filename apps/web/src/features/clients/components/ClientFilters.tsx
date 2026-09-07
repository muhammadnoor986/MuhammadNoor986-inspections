import type { ClientSortField } from '../types/client';

export type QuickStatusFilter = 'all' | 'active' | 'inactive';

const QUICK_FILTERS: { value: QuickStatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

const SORT_OPTIONS: { value: ClientSortField; label: string }[] = [
  { value: 'name', label: 'Name' },
  { value: 'updated_at', label: 'Last updated' },
  { value: 'created_at', label: 'Date created' },
];

export interface ClientFiltersValue {
  search: string;
  statusFilter: QuickStatusFilter;
  sortBy: ClientSortField;
  sortDir: 'asc' | 'desc';
}

export function ClientFilters({
  value,
  onChange,
}: {
  value: ClientFiltersValue;
  onChange: (next: ClientFiltersValue) => void;
}) {
  return (
    <div className="project-filters">
      <input
        type="search"
        placeholder="Search by client name…"
        value={value.search}
        onChange={(e) => onChange({ ...value, search: e.target.value })}
        aria-label="Search clients"
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
        <select value={value.sortBy} onChange={(e) => onChange({ ...value, sortBy: e.target.value as ClientSortField })}>
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
    </div>
  );
}
