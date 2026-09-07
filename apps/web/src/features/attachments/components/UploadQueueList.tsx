import type { UploadQueueItem } from '../hooks/useAttachmentUpload';

const STATUS_LABEL: Record<UploadQueueItem['status'], string> = {
  uploading: 'Uploading…',
  confirming: 'Finishing…',
  done: 'Done',
  error: 'Failed',
};

export function UploadQueueList({ queue, onDismiss }: { queue: UploadQueueItem[]; onDismiss: (id: string) => void }) {
  if (queue.length === 0) return null;

  return (
    <ul className="upload-queue">
      {queue.map((item) => (
        <li key={item.id} className={`upload-queue-item upload-queue-${item.status}`}>
          <span className="upload-queue-name">{item.fileName}</span>
          <div className="upload-queue-bar">
            <div className="upload-queue-bar-fill" style={{ width: `${item.progress}%` }} />
          </div>
          <span className="upload-queue-status">
            {item.status === 'error' ? item.error : STATUS_LABEL[item.status]}
          </span>
          {(item.status === 'done' || item.status === 'error') && (
            <button type="button" className="upload-queue-dismiss" onClick={() => onDismiss(item.id)} aria-label="Dismiss">
              ×
            </button>
          )}
        </li>
      ))}
    </ul>
  );
}
