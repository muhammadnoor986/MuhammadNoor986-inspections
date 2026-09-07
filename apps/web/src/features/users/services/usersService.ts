import { apiFetch } from '../../../services/apiClient';
import type { Paginated } from '../../../types/api';
import type { InviteUserInput, UpdateUserInput, User, UsersQuery } from '../types/user';

// Thin wrapper around apps/api's /users routes (src/routes/v1/users.ts).
// No business logic here — just request shaping. Callers (hooks) own
// loading/error state.

export function listUsers(query: UsersQuery): Promise<Paginated<User>> {
  return apiFetch<Paginated<User>>('/users', { query: { ...query } });
}

export function getUser(id: string): Promise<User> {
  return apiFetch<{ user: User }>(`/users/${id}`).then((res) => res.user);
}

export function inviteUser(input: InviteUserInput): Promise<User> {
  return apiFetch<{ user: User }>('/users/invite', { method: 'POST', body: input }).then((res) => res.user);
}

export function updateUser(id: string, input: UpdateUserInput): Promise<User> {
  return apiFetch<{ user: User }>(`/users/${id}`, { method: 'PATCH', body: input }).then((res) => res.user);
}

export function activateUser(id: string): Promise<User> {
  return apiFetch<{ user: User }>(`/users/${id}/activate`, { method: 'PATCH' }).then((res) => res.user);
}

export function deactivateUser(id: string): Promise<User> {
  return apiFetch<{ user: User }>(`/users/${id}/deactivate`, { method: 'PATCH' }).then((res) => res.user);
}
