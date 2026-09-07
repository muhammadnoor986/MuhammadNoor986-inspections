// Mirrors the API's consistent error shape (apps/api/src/middleware/errorHandler.ts)
// and pagination metadata (apps/api/src/lib/pagination.ts).
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
  };
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  items: T[];
  meta: PaginationMeta;
}
