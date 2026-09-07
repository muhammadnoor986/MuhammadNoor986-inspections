export function ClientStatusBadge({ isActive }: { isActive: boolean }) {
  return <span className={`status-badge ${isActive ? 'status-active' : 'status-archived'}`}>{isActive ? 'Active' : 'Inactive'}</span>;
}
