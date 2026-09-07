import type { PaginationMeta } from '../types/api';

export function Pagination({ meta, onPageChange }: { meta: PaginationMeta; onPageChange: (page: number) => void }) {
  if (meta.totalPages <= 1) return null;

  return (
    <div className="pagination">
      <button type="button" disabled={meta.page <= 1} onClick={() => onPageChange(meta.page - 1)}>
        Previous
      </button>
      <span>
        Page {meta.page} of {meta.totalPages} · {meta.total} total
      </span>
      <button type="button" disabled={meta.page >= meta.totalPages} onClick={() => onPageChange(meta.page + 1)}>
        Next
      </button>
    </div>
  );
}
