import { ErrorMessage } from '../../../components/ErrorMessage';
import type { Acknowledgement, DueStatus } from '../types/inspection';

export function AcknowledgementPanel({
  dueStatus,
  acknowledgements,
  canAcknowledge,
  submitting,
  error,
  onAcknowledge,
}: {
  dueStatus: DueStatus;
  acknowledgements: Acknowledgement[];
  canAcknowledge: boolean;
  submitting: boolean;
  error: string | null;
  onAcknowledge: () => void;
}) {
  const latest = acknowledgements[0] ?? null;
  // Acknowledging only makes sense while something is actually due/overdue
  // — it never changes dueStatus itself (that stays purely date-derived).
  const isDue = dueStatus === 'orange' || dueStatus === 'red';

  return (
    <div className="acknowledgement-panel">
      <h2>Acknowledgement</h2>

      {error && <ErrorMessage title="Could not record acknowledgement" message={error} />}

      {latest ? (
        <p className="text-muted">
          Last acknowledged by {latest.acknowledgedByEmail ?? 'someone'} on{' '}
          {new Date(latest.acknowledgedAt).toLocaleString()}
        </p>
      ) : (
        <p className="text-muted">Not yet acknowledged.</p>
      )}

      {canAcknowledge && isDue && (
        <button type="button" className="button-primary" disabled={submitting} onClick={onAcknowledge}>
          {submitting ? 'Acknowledging…' : 'Acknowledge'}
        </button>
      )}
    </div>
  );
}
