import { useState } from 'react';
import { ConfirmDialog } from '../../../components/ConfirmDialog';
import { EmptyState } from '../../../components/EmptyState';
import { ErrorMessage } from '../../../components/ErrorMessage';
import { LoadingScreen } from '../../../components/LoadingScreen';
import { useAsyncAction } from '../../../hooks/useAsyncAction';
import { useAuth } from '../../../hooks/useAuth';
import { AttachmentCard } from './AttachmentCard';
import { AttachmentPreviewModal } from './AttachmentPreviewModal';
import { UploadControl } from './UploadControl';
import { UploadQueueList } from './UploadQueueList';
import { useAttachmentsList } from '../hooks/useAttachmentsList';
import { useAttachmentUpload } from '../hooks/useAttachmentUpload';
import { deleteAttachment } from '../services/attachmentsService';
import type { Attachment, AttachmentKind, AttachmentParentKind, PhotoCategory } from '../types/attachment';

const PHOTO_ACCEPT = 'image/jpeg,image/png,image/webp,image/heic,image/gif';
const DOCUMENT_ACCEPT = 'application/pdf,image/jpeg,image/png';

export function AttachmentSection({
  parentKind,
  parentId,
  kind,
  category,
  title,
  emptyMessage,
}: {
  parentKind: AttachmentParentKind;
  parentId: string;
  kind: AttachmentKind;
  category?: PhotoCategory;
  title: string;
  emptyMessage: string;
}) {
  const { profile } = useAuth();
  const canUpload = profile?.role === 'admin' || profile?.role === 'upload_notes';

  const list = useAttachmentsList(parentKind, parentId, { kind, category, pageSize: 100 });
  const { queue, uploadFiles, replaceFile, dismiss } = useAttachmentUpload(parentKind, parentId, () => list.refetch());

  const [previewing, setPreviewing] = useState<Attachment | null>(null);
  const [deleting, setDeleting] = useState<Attachment | null>(null);
  const removeAction = useAsyncAction(async (attachment: Attachment) => {
    await deleteAttachment(parentKind, parentId, attachment.id);
  });

  function canModify(attachment: Attachment): boolean {
    if (!canUpload) return false;
    return profile?.role === 'admin' || attachment.uploadedBy === profile?.id;
  }

  async function handleConfirmDelete() {
    if (!deleting) return;
    const result = await removeAction.run(deleting);
    if (result.ok) {
      setDeleting(null);
      list.refetch();
    }
  }

  return (
    <div className="attachment-section">
      <div className="attachment-section-header">
        <h3>{title}</h3>
        {canUpload && (
          <UploadControl
            label="Upload"
            accept={kind === 'photo' ? PHOTO_ACCEPT : DOCUMENT_ACCEPT}
            onFilesSelected={(files) => void uploadFiles(files, { kind, category })}
          />
        )}
      </div>

      <UploadQueueList queue={queue} onDismiss={dismiss} />

      {list.status === 'loading' && <LoadingScreen label={`Loading ${title.toLowerCase()}…`} />}
      {list.status === 'error' && <ErrorMessage title={`Could not load ${title.toLowerCase()}`} message={list.error} />}

      {list.status === 'success' && list.data.items.length === 0 && <EmptyState title="Nothing here yet" message={emptyMessage} />}

      {list.status === 'success' && list.data.items.length > 0 && (
        <div className="attachment-grid">
          {list.data.items.map((attachment) => (
            <AttachmentCard
              key={attachment.id}
              attachment={attachment}
              canModify={canModify(attachment)}
              onView={() => setPreviewing(attachment)}
              onDelete={() => setDeleting(attachment)}
              onReplace={(file) => void replaceFile(attachment.id, file, { kind })}
            />
          ))}
        </div>
      )}

      {previewing && (
        <AttachmentPreviewModal
          attachment={previewing}
          parentKind={parentKind}
          parentId={parentId}
          onClose={() => setPreviewing(null)}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Delete attachment"
          message={`Delete "${deleting.fileName}"? This cannot be undone.`}
          confirmLabel="Delete"
          busy={removeAction.submitting}
          onCancel={() => setDeleting(null)}
          onConfirm={() => void handleConfirmDelete()}
        />
      )}
      {removeAction.error && <ErrorMessage title="Could not delete attachment" message={removeAction.error} />}
    </div>
  );
}
