import { useCallback, useState } from 'react';
import { ApiClientError } from '../services/apiClient';

function messageFor(err: unknown): string {
  if (err instanceof ApiClientError) return err.message;
  if (err instanceof Error) return err.message;
  return 'Something went wrong';
}

/**
 * Generic submit/mutation helper: tracks in-flight + error state around a
 * single async action (create/update/delete, etc). Used by forms and
 * mutation buttons so they don't each reimplement the same three `useState`
 * calls.
 */
export function useAsyncAction<TArgs extends unknown[], TResult>(action: (...args: TArgs) => Promise<TResult>) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (...args: TArgs): Promise<{ ok: true; data: TResult } | { ok: false }> => {
      setSubmitting(true);
      setError(null);
      try {
        const data = await action(...args);
        return { ok: true, data };
      } catch (err) {
        setError(messageFor(err));
        return { ok: false };
      } finally {
        setSubmitting(false);
      }
    },
    // action is expected to be stable-ish (a service function reference); if
    // a caller passes an inline closure, they're responsible for memoizing it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [action]
  );

  return { run, submitting, error, setError };
}
