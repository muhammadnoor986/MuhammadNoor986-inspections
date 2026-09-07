import type { ClientOption } from '../../clients/hooks/useClientOptions';
import type { UserRole, UserSortField } from '../types/user';

export type QuickStatusFilter = 'all' | 'active' | 'inactive';
export type RoleFilter = 'all' | UserRole;

const ROLE_FILTERS: { value: RoleFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'admin', label: 'Admin' },
  { value: 'upload_notes', label: 'Upload & Notes' },
  { value: 'view_only', label: 'View Only' },
];

const STATUS_FILTERS: { value: QuickStatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

const SORT_OPTIONS: { value: UserSortField; label: string }[] = [
  { value: 'email', label: 'Email' },
  { value: 'full_name', label: 'Name' },
  { value: 'updated_at', label: 'Last updated' },
  { value: 'created_at', label: 'Date created' },
];

export interface UserFiltersValue {
  search: string;
  roleFilter: RoleFilter;
  clientId: string;
  statusFilter: QuickStatusFilter;
  sortBy: UserSortField;
  sortDir: 'asc' | 'desc';
}

export function UserFilters({
  value,
  onChange,
  clientOptions,
}: {
  value: UserFiltersValue;
  onChange: (next: UserFiltersValue) => void;
  clientOptions: ClientOption[];
}) {
  return (
    <div className="project-filters">
      <input
        type="search"
        placeholder="Search by email or name…"
        value={value.search}
        onChange={(e) => onChange({ ...value, search: e.target.value })}
        aria-label="Search users"
      />

      <div className="quick-filters" role="group" aria-label="Filter by role">
        {ROLE_FILTERS.map((filter) => (
          <button
            key={filter.value}
            type="button"
            className={filter.value === value.roleFilter ? 'active' : ''}
            onClick={() => onChange({ ...value, roleFilter: filter.value })}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <div className="quick-filters" role="group" aria-label="Filter by status">
        {STATUS_FILTERS.map((filter) => (
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
        Client
        <select value={value.clientId} onChange={(e) => onChange({ ...value, clientId: e.target.value })}>
          <option value="">All clients</option>
          {clientOptions.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </select>
      </label>

      <label className="filter-field">
        Sort by
        <select value={value.sortBy} onChange={(e) => onChange({ ...value, sortBy: e.target.value as UserSortField })}>
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
