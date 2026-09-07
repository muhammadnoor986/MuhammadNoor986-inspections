import { type FormEvent, useState } from 'react';
import { ErrorMessage } from '../../../components/ErrorMessage';
import type { Note } from '../types/inspection';

export function NotesPanel({
  notes,
  canAdd,
  submitting,
  error,
  onAdd,
}: {
  notes: Note[];
  canAdd: boolean;
  submitting: boolean;
  error: string | null;
  /** Resolves to whether the note was added successfully — the draft is only cleared on success. */
  onAdd: (body: string) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const body = draft.trim();
    if (!body) {
      setValidationError('Note cannot be empty');
      return;
    }
    if (body.length > 5000) {
      setValidationError('Note must be 5000 characters or fewer');
      return;
    }
    setValidationError(null);
    onAdd(body).then((success) => {
      if (success) setDraft('');
    });
  }

  return (
    <div className="notes-panel">
      <h2>Notes</h2>

      {notes.length === 0 && <p className="text-muted">No notes yet.</p>}

      <ul className="notes-list">
        {notes.map((note) => (
          <li key={note.id} className="note-item">
            <p>{note.body}</p>
            <span className="note-meta">
              {note.authorEmail ?? 'Unknown'} · {new Date(note.createdAt).toLocaleString()}
            </span>
          </li>
        ))}
      </ul>

      {canAdd && (
        <form className="note-form" onSubmit={handleSubmit}>
          {error && <ErrorMessage title="Could not add note" message={error} />}
          <textarea
            rows={3}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add a note…"
            aria-invalid={Boolean(validationError)}
          />
          {validationError && <span className="field-error">{validationError}</span>}
          <button type="submit" className="button-primary" disabled={submitting}>
            {submitting ? 'Adding…' : 'Add Note'}
          </button>
        </form>
      )}
    </div>
  );
}
