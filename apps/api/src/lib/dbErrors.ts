import type { PostgrestError } from '@supabase/supabase-js';
import { ApiError } from './ApiError';

/** Maps a Supabase/Postgres error to a meaningful HTTP error. */
export function mapDbError(error: PostgrestError): ApiError {
  switch (error.code) {
    case '23503': // foreign_key_violation
      return ApiError.badRequest('Referenced record does not exist');
    case '23505': // unique_violation
      return new ApiError(409, 'conflict', 'Record already exists');
    case 'PGRST116': // 0 or >1 rows for .single()
      return ApiError.notFound();
    default:
      return new ApiError(500, 'database_error', error.message);
  }
}
