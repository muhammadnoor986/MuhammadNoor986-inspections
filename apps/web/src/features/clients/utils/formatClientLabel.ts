import type { ClientOption } from '../hooks/useClientOptions';

/**
 * Resolves a clientId to a display label from an already-fetched
 * useClientOptions() list — used by the read-only "Client" field in forms
 * that don't allow client reassignment (Project/Inspection edit; the
 * backend's update schemas intentionally exclude clientId). Falls back
 * gracefully while options are still loading, or if the client wasn't in
 * the fetched batch at all.
 */
export function formatClientLabel(clientOptions: ClientOption[], clientId: string | undefined, loading: boolean): string {
  if (!clientId) return '—';
  const client = clientOptions.find((c) => c.id === clientId);
  if (client) return client.isActive ? client.name : `${client.name} (inactive)`;
  return loading ? 'Loading…' : 'Unknown client';
}
