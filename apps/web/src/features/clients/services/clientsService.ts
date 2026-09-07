import { apiFetch } from '../../../services/apiClient';
import type { Paginated } from '../../../types/api';
import type { Client, ClientsQuery, CreateClientInput, UpdateClientInput } from '../types/client';

// Thin wrapper around apps/api's /clients routes (src/routes/v1/clients.ts).
// No business logic here — just request shaping. Callers (hooks) own
// loading/error state.

export function listClients(query: ClientsQuery): Promise<Paginated<Client>> {
  return apiFetch<Paginated<Client>>('/clients', { query: { ...query } });
}

export function getClient(id: string): Promise<Client> {
  return apiFetch<{ client: Client }>(`/clients/${id}`).then((res) => res.client);
}

export function createClient(input: CreateClientInput): Promise<Client> {
  return apiFetch<{ client: Client }>('/clients', { method: 'POST', body: input }).then((res) => res.client);
}

export function updateClient(id: string, input: UpdateClientInput): Promise<Client> {
  return apiFetch<{ client: Client }>(`/clients/${id}`, { method: 'PATCH', body: input }).then((res) => res.client);
}

export function activateClient(id: string): Promise<Client> {
  return apiFetch<{ client: Client }>(`/clients/${id}/activate`, { method: 'PATCH' }).then((res) => res.client);
}

export function deactivateClient(id: string): Promise<Client> {
  return apiFetch<{ client: Client }>(`/clients/${id}/deactivate`, { method: 'PATCH' }).then((res) => res.client);
}
