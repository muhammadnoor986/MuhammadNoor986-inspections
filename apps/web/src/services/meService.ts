import type { Profile } from '../types/auth';
import { apiFetch } from './apiClient';

// Calls GET /api/v1/me (apps/api/src/routes/v1/me.ts), proving the auth
// pipeline end-to-end and giving the web app the role/client scope it needs
// for role-aware rendering and routing.
export async function fetchMe(): Promise<Profile> {
  const { user } = await apiFetch<{ user: Profile }>('/me');
  return user;
}
