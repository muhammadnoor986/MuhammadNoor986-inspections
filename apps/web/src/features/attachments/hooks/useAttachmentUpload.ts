import { useCallback, useState } from 'react';
import { ApiClientError } from '../../../services/apiClient';
import {
  confirmAttachmentUpload,
  presignAttachmentUpload,
  putFileToS3,
  replaceAttachment as replaceAttachmentApi,
} from '../services/attachmentsService';
import type { Attachment, AttachmentKind, AttachmentParentKind, PhotoCategory } from '../types/attachment';

export interface UploadQueueItem {
  id: string;
  fileName: string;
  progress: number;
  status: 'uploading' | 'confirming' | 'done' | 'error';
  error?: string;
}

function messageFor(err: unknown): string {
  if (err instanceof ApiClientError) return err.message;
  if (err instanceof Error) return err.message;
  return 'Upload failed';
}

/**
 * Orchestrates the presign -> PUT-to-S3 -> confirm flow (see
 * attachmentsService) for one or more files, tracking per-file
 * progress/status for the UI. Files upload one at a time — simple, and
 * avoids surprising a slow connection with N parallel large uploads.
 */
export function useAttachmentUpload(
  parentKind: AttachmentParentKind,
  parentId: string,
  onUploaded?: (attachment: Attachment) => void
) {
  const [queue, setQueue] = useState<UploadQueueItem[]>([]);

  const updateItem = useCallback((id: string, patch: Partial<UploadQueueItem>) => {
    setQueue((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }, []);

  const uploadOne = useCallback(
    async (file: File, opts: { kind: AttachmentKind; category?: PhotoCategory }) => {
      const id = crypto.randomUUID();
      setQueue((prev) => [...prev, { id, fileName: file.name, progress: 0, status: 'uploading' }]);

      try {
        const presign = await presignAttachmentUpload(parentKind, parentId, {
          fileName: file.name,
          contentType: file.type,
          kind: opts.kind,
          category: opts.category,
        });
        await putFileToS3(presign.uploadUrl, file, (percent) => updateItem(id, { progress: percent }));
        updateItem(id, { status: 'confirming', progress: 100 });
        const attachment = await confirmAttachmentUpload(parentKind, parentId, {
          key: presign.key,
          fileName: file.name,
          contentType: file.type,
          fileSize: file.size,
          kind: opts.kind,
          category: opts.category,
        });
        updateItem(id, { status: 'done' });
        onUploaded?.(attachment);
      } catch (err) {
        updateItem(id, { status: 'error', error: messageFor(err) });
      }
    },
    [parentKind, parentId, onUploaded, updateItem]
  );

  const uploadFiles = useCallback(
    async (files: FileList | File[], opts: { kind: AttachmentKind; category?: PhotoCategory }) => {
      for (const file of Array.from(files)) {
        await uploadOne(file, opts);
      }
    },
    [uploadOne]
  );

  const replaceFile = useCallback(
    async (attachmentId: string, file: File, opts: { kind: AttachmentKind }) => {
      const id = crypto.randomUUID();
      setQueue((prev) => [...prev, { id, fileName: file.name, progress: 0, status: 'uploading' }]);

      try {
        const presign = await presignAttachmentUpload(parentKind, parentId, {
          fileName: file.name,
          contentType: file.type,
          kind: opts.kind,
        });
        await putFileToS3(presign.uploadUrl, file, (percent) => updateItem(id, { progress: percent }));
        updateItem(id, { status: 'confirming', progress: 100 });
        const attachment = await replaceAttachmentApi(parentKind, parentId, attachmentId, {
          key: presign.key,
          fileName: file.name,
          contentType: file.type,
          fileSize: file.size,
        });
        updateItem(id, { status: 'done' });
        onUploaded?.(attachment);
      } catch (err) {
        updateItem(id, { status: 'error', error: messageFor(err) });
      }
    },
    [parentKind, parentId, onUploaded, updateItem]
  );

  const dismiss = useCallback((id: string) => {
    setQueue((prev) => prev.filter((item) => item.id !== id));
  }, []);

  return { queue, uploadFiles, replaceFile, dismiss };
}
