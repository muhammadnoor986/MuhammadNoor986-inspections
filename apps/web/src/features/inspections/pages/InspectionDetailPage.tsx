import { useCallback, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { ErrorMessage } from '../../../components/ErrorMessage';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { useAsyncAction } from '../../../hooks/useAsyncAction';
import { useAuth } from '../../../hooks/useAuth';
import { useProject } from '../../projects/hooks/useProject';
import { InspectionAttachments } from '../../attachments/components/InspectionAttachments';
import { AcknowledgementPanel } from '../components/AcknowledgementPanel';
import { InspectionStatusBadge } from '../components/InspectionStatusBadge';
import { NotesPanel } from '../components/NotesPanel';
import { TrafficLightBadge } from '../components/TrafficLightBadge';
import { useAcknowledgements } from '../hooks/useAcknowledgements';
import { useInspection } from '../hooks/useInspection';
import { useInspectionNotes } from '../hooks/useInspectionNotes';
import { deleteInspection } from '../services/inspectionsService';

export function InspectionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const inspection = useInspection(id);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const removeAction = useCallback(() => deleteInspection(id!), [id]);
  const { run: runDelete, submitting: deleting, error: deleteError } = useAsyncAction(removeAction);

  const linkedProjectId = inspection.status === 'success' ? inspection.data.projectId : undefined;
  const project = useProject(linkedProjectId ?? undefined);

  const notes = useInspectionNotes(id);
  const { run: runAddNote, submitting: addingNote, error: addNoteError } = useAsyncAction(notes.addNote);

  const acknowledgements = useAcknowledgements(id);
  const {
    run: runAcknowledge,
    submitting: acknowledging,
    error: acknowledgeError,
  } = useAsyncAction(acknowledgements.acknowledge);

  if (!id) return <Navigate to="/inspections" replace />;

  if (inspection.status === 'loading') return <LoadingScreen label="Loading inspection…" />;

  if (inspection.status === 'error') {
    return (
      <section>
        <ErrorMessage title="Could not load this inspection" message={inspection.error} />
        <p>
          <Link to="/inspections">Back to inspections</Link>
        </p>
      </section>
    );
  }

  const isAdmin = profile?.role === 'admin';
  const canAddNotes = profile?.role === 'admin' || profile?.role === 'upload_notes';
  const { data: insp } = inspection;

  const address = linkedProjectId && project.status === 'success' ? project.data.address : null;

  async function handleDelete() {
    const result = await runDelete();
    if (result.ok) navigate('/inspections');
  }

  return (
    <section>
      <div className="page-header">
        <h1>{insp.title}</h1>
        {isAdmin && (
          <div className="page-actions">
            <Link to={`/inspections/${insp.id}/edit`} className="button-primary">
              Edit
            </Link>
            <button type="button" className="danger" onClick={() => setConfirmingDelete(true)}>
              Delete
            </button>
          </div>
        )}
      </div>

      {deleteError && <ErrorMessage title="Could not delete this inspection" message={deleteError} />}

      <dl className="detail-list">
        <dt>Status</dt>
        <dd>
          <InspectionStatusBadge status={insp.status} />
        </dd>

        <dt>Address</dt>
        <dd>{linkedProjectId ? (address ?? '—') : 'No linked project'}</dd>

        <dt>Suburb</dt>
        <dd>{insp.suburb || '—'}</dd>

        <dt>Inspection date</dt>
        <dd>{insp.inspectionDate ?? '—'}</dd>

        <dt>Last inspection date</dt>
        <dd>{insp.lastInspectionDate ?? '—'}</dd>

        <dt>Next inspection (due) date</dt>
        <dd>
          {insp.nextInspectionDate ?? '—'} <TrafficLightBadge status={insp.dueStatus} />
        </dd>

        <dt>Inspection report</dt>
        <dd>{insp.summary || '—'}</dd>

        <dt>Suggested works</dt>
        <dd>{insp.suggestedWorks || '—'}</dd>

        <dt>Remediation quote</dt>
        <dd>{insp.remediationQuote != null ? `$${insp.remediationQuote.toFixed(2)}` : '—'}</dd>
      </dl>

      {acknowledgements.status === 'loading' && <LoadingScreen label="Loading acknowledgement history…" />}
      {acknowledgements.status === 'error' && (
        <ErrorMessage title="Could not load acknowledgement history" message={acknowledgements.error} />
      )}
      {acknowledgements.status === 'success' && (
        <AcknowledgementPanel
          dueStatus={insp.dueStatus}
          acknowledgements={acknowledgements.data}
          canAcknowledge={canAddNotes}
          submitting={acknowledging}
          error={acknowledgeError}
          onAcknowledge={() => void runAcknowledge()}
        />
      )}

      <InspectionAttachments inspectionId={insp.id} />

      <p>
        <Link to="/inspections">Back to inspections</Link>
      </p>

      {notes.status === 'loading' && <LoadingScreen label="Loading notes…" />}
      {notes.status === 'error' && <ErrorMessage title="Could not load notes" message={notes.error} />}
      {notes.status === 'success' && (
        <NotesPanel
          notes={notes.data}
          canAdd={canAddNotes}
          submitting={addingNote}
          error={addNoteError}
          onAdd={async (body) => (await runAddNote(body)).ok}
        />
      )}

      {confirmingDelete && (
        <ConfirmDialog
          title="Delete inspection"
          message={`Delete "${insp.title}"? This cannot be undone.`}
          confirmLabel="Delete"
          busy={deleting}
          onCancel={() => setConfirmingDelete(false)}
          onConfirm={() => void handleDelete()}
        />
      )}
    </section>
  );
}
