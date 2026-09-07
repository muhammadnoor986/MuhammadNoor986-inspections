import type { ProjectOption } from '../../projects/hooks/useProjectOptions';
import type { DueStatus, InspectionSortField } from '../types/inspection';

export type QuickStatusFilter = 'all' | 'current' | 'completed' | 'cancelled';
export type SortOption = InspectionSortField | 'address';
export type TrafficLightFilter = 'all' | DueStatus;

const QUICK_FILTERS: { value: QuickStatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'current', label: 'Current' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const TRAFFIC_LIGHT_FILTERS: { value: TrafficLightFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'green', label: 'Up to date' },
  { value: 'orange', label: 'Due' },
  { value: 'red', label: 'Overdue' },
];

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'address', label: 'Address' },
  { value: 'next_inspection_date', label: 'Due date' },
  { value: 'inspection_date', label: 'Inspection date' },
  { value: 'status', label: 'Status' },
  { value: 'updated_at', label: 'Last updated' },
  { value: 'created_at', label: 'Date created' },
];

export interface InspectionFiltersValue {
  search: string;
  statusFilter: QuickStatusFilter;
  trafficLightFilter: TrafficLightFilter;
  projectId: string;
  dateFrom: string;
  dateTo: string;
  dueDateFrom: string;
  dueDateTo: string;
  sortBy: SortOption;
  sortDir: 'asc' | 'desc';
  /** Admin-only. */
  clientId: string;
}

export function InspectionFilters({
  value,
  onChange,
  isAdmin,
  projectOptions,
}: {
  value: InspectionFiltersValue;
  onChange: (next: InspectionFiltersValue) => void;
  isAdmin: boolean;
  projectOptions: ProjectOption[];
}) {
  return (
    <div className="project-filters">
      <input
        type="search"
        placeholder="Search by title or suburb…"
        value={value.search}
        onChange={(e) => onChange({ ...value, search: e.target.value })}
        aria-label="Search inspections"
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

      <div className="quick-filters" role="group" aria-label="Filter by traffic-light status">
        {TRAFFIC_LIGHT_FILTERS.map((filter) => (
          <button
            key={filter.value}
            type="button"
            className={filter.value === value.trafficLightFilter ? 'active' : ''}
            onClick={() => onChange({ ...value, trafficLightFilter: filter.value })}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <label className="filter-field">
        Project
        <select value={value.projectId} onChange={(e) => onChange({ ...value, projectId: e.target.value })}>
          <option value="">All projects</option>
          {projectOptions.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      </label>

      <label className="filter-field">
        Inspection date from
        <input type="date" value={value.dateFrom} onChange={(e) => onChange({ ...value, dateFrom: e.target.value })} />
      </label>
      <label className="filter-field">
        to
        <input type="date" value={value.dateTo} onChange={(e) => onChange({ ...value, dateTo: e.target.value })} />
      </label>

      <label className="filter-field">
        Due date from
        <input
          type="date"
          value={value.dueDateFrom}
          onChange={(e) => onChange({ ...value, dueDateFrom: e.target.value })}
        />
      </label>
      <label className="filter-field">
        to
        <input type="date" value={value.dueDateTo} onChange={(e) => onChange({ ...value, dueDateTo: e.target.value })} />
      </label>

      <label className="filter-field">
        Sort by
        <select value={value.sortBy} onChange={(e) => onChange({ ...value, sortBy: e.target.value as SortOption })}>
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
