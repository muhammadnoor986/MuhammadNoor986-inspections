import { useCallback, useEffect, useState } from 'react';
import { ApiClientError } from '../../../services/apiClient';
import type { Paginated } from '../../../types/api';
import type { AsyncState } from '../../../types/asyncState';
import { listAttachments } from '../services/attachmentsService';
import type { Attachment, AttachmentParentKind, AttachmentsQuery } from '../types/attachment';

export function useAttachmentsList(parentKind: AttachmentParentKind, parentId: string, query: AttachmentsQuery) {
  const [state, setState] = useState<AsyncState<Paginated<Attachment>>>({ status: 'loading' });
  const queryKey = JSON.stringify(query);

  const load = useCallback(() => {
    setState({ status: 'loading' });
    listAttachments(parentKind, parentId, query)
      .then((data) => setState({ status: 'success', data }))
      .catch((err) =>
        setState({
          status: 'error',
          error: err instanceof ApiClientError ? err.message : 'Failed to load attachments',
        })
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parentKind, parentId, queryKey]);

  useEffect(() => {
    load();
  }, [load]);

  return { ...state, refetch: load };
}
