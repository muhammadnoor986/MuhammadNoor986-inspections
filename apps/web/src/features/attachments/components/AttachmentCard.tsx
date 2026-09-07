import { useRef } from 'react';
import { formatBytes } from '../utils/formatBytes';
import type { Attachment } from '../types/attachment';

const CATEGORY_LABEL: Record<string, string> = {
  before: 'Before',
  progress: 'Progress',
  completion: 'Completion',
};

export function AttachmentCard({
  attachment,
  canModify,
  onView,
  onDelete,
  onReplace,
}: {
  attachment: Attachment;
  canModify: boolean;
  onView: () => void;
  onDelete: () => void;
  onReplace: (file: File) => void;
}) {
  const replaceInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="attachment-card">
      <button type="button" className="attachment-card-thumb" onClick={onView} aria-label={`View ${attachment.fileName}`}>
        {attachment.kind === 'photo' ? '🖼️' : '📄'}
      </button>
      <div className="attachment-card-body">
        <span className="attachment-card-name" title={attachment.fileName}>
          {attachment.fileName}
        </span>
        <span className="attachment-card-meta">
          {attachment.category && <span className="status-badge">{CATEGORY_LABEL[attachment.category]}</span>}{' '}
          {formatBytes(attachment.fileSize)} · {new Date(attachment.createdAt).toLocaleDateString()}
        </span>
      </div>
      {canModify && (
        <div className="attachment-card-actions">
          <button type="button" onClick={() => replaceInputRef.current?.click()}>
            Replace
          </button>
          <input
            ref={replaceInputRef}
            type="file"
            hidden
            accept={attachment.kind === 'photo' ? 'image/*' : 'application/pdf,image/*'}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onReplace(file);
              e.target.value = '';
            }}
          />
          <button type="button" className="danger" onClick={onDelete}>
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
