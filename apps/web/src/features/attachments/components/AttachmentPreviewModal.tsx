import { useEffect, useState } from 'react';
import { ErrorMessage } from '../../../components/ErrorMessage';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { getAttachmentDownloadUrl } from '../services/attachmentsService';
import type { Attachment, AttachmentParentKind } from '../types/attachment';

export function AttachmentPreviewModal({
  attachment,
  parentKind,
  parentId,
  onClose,
}: {
  attachment: Attachment;
  parentKind: AttachmentParentKind;
  parentId: string;
  onClose: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getAttachmentDownloadUrl(parentKind, parentId, attachment.id)
      .then((resolved) => {
        if (!cancelled) setUrl(resolved);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load this file');
      });
    return () => {
      cancelled = true;
    };
  }, [parentKind, parentId, attachment.id]);

  return (
    <div className="dialog-backdrop" role="presentation" onClick={onClose}>
      <div
        className="dialog attachment-preview-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={attachment.fileName}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dialog-actions" style={{ justifyContent: 'space-between' }}>
          <strong>{attachment.fileName}</strong>
          <button type="button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        {!url && !error && <LoadingScreen label="Loading preview…" />}
        {error && <ErrorMessage title="Could not load this file" message={error} />}

        {url && attachment.kind === 'photo' && <img src={url} alt={attachment.fileName} className="attachment-preview-image" />}
        {url && attachment.kind === 'document' && (
          <p>
            <a href={url} target="_blank" rel="noreferrer">
              Open {attachment.fileName} in a new tab
            </a>
          </p>
        )}
      </div>
    </div>
  );
}
