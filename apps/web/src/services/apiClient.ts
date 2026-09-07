import type { ApiErrorBody } from '../types/api';
import { env } from '../utils/env';
import { supabase } from './supabaseClient';

export class ApiClientError extends Error {
  code: string;
  status: number;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
  }
}

type QueryValue = string | number | boolean | undefined;

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, QueryValue>;
}

function buildUrl(path: string, query?: Record<string, QueryValue>): string {
  const url = new URL(env.apiBaseUrl.replace(/\/$/, '') + path);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

/**
 * Every call re-reads the current Supabase session so the API client never
 * holds a token that could go stale — supabase-js refreshes it in the
 * background, this just always grabs whatever is current.
 */
async function currentAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

/**
 * Thin fetch wrapper for the Node API (apps/api). Attaches the caller's
 * Supabase JWT as a bearer token; the API re-derives role/client scope from
 * it server-side rather than trusting anything the client asserts. Throws
 * ApiClientError on any non-2xx response, using the API's { error: { code,
 * message } } shape when present.
 */
export async function apiFetch<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const token = await currentAccessToken();
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';

  let response: Response;
  try {
    response = await fetch(buildUrl(path, options.query), {
      method: options.method ?? 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new ApiClientError(0, 'network_error', 'Could not reach the API. Check your connection and try again.');
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const body = payload as ApiErrorBody | null;
    throw new ApiClientError(
      response.status,
      body?.error?.code ?? 'unknown_error',
      body?.error?.message ?? 'Something went wrong'
    );
  }

  return payload as T;
}
