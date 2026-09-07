// Mirrors Inspection / CreateInspectionInput / UpdateInspectionInput /
// InspectionsListQuery in apps/api/src/services/inspections.service.ts and
// schemas/inspections.schema.ts.

export type InspectionStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

export const INSPECTION_STATUSES: InspectionStatus[] = ['scheduled', 'in_progress', 'completed', 'cancelled'];

// The traffic light — green/orange/red. Always computed server-side from
// nextInspectionDate (see apps/api/src/lib/dueStatus.ts) and returned as
// part of the Inspection payload; the web app never recomputes this itself,
// so there's exactly one place the green/orange/red boundaries are defined.
export type DueStatus = 'green' | 'orange' | 'red';

export const DUE_STATUSES: DueStatus[] = ['green', 'orange', 'red'];

export interface Inspection {
  id: string;
  clientId: string;
  projectId: string | null;
  title: string;
  inspectionDate: string | null;
  status: InspectionStatus;
  summary: string | null;
  suburb: string | null;
  suggestedWorks: string | null;
  remediationQuote: number | null;
  lastInspectionDate: string | null;
  /** The inspection's due date — when the next inspection is due. Drives dueStatus. */
  nextInspectionDate: string | null;
  /** Server-computed traffic light — see the DueStatus comment above. */
  dueStatus: DueStatus;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export type InspectionSortField = 'created_at' | 'updated_at' | 'inspection_date' | 'status' | 'next_inspection_date';

export interface InspectionsQuery {
  page?: number;
  pageSize?: number;
  sortBy?: InspectionSortField;
  sortDir?: 'asc' | 'desc';
  /** Single status or comma-separated list — see apps/api's statusFilterSchema. */
  status?: InspectionStatus | string;
  projectId?: string;
  dateFrom?: string;
  dateTo?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
  /** Single value or comma-separated list — see apps/api's dueStatusFilterSchema. */
  dueStatus?: DueStatus | string;
  search?: string;
  /** Admin-only: the API ignores this for non-admin callers. */
  clientId?: string;
}

export interface CreateInspectionInput {
  clientId: string;
  projectId?: string;
  title: string;
  inspectionDate?: string;
  status?: InspectionStatus;
  summary?: string;
  suburb?: string;
  suggestedWorks?: string;
  remediationQuote?: number;
  lastInspectionDate?: string;
  nextInspectionDate?: string;
}

export interface UpdateInspectionInput {
  projectId?: string | null;
  title?: string;
  inspectionDate?: string | null;
  status?: InspectionStatus;
  summary?: string | null;
  suburb?: string | null;
  suggestedWorks?: string | null;
  remediationQuote?: number | null;
  lastInspectionDate?: string | null;
  nextInspectionDate?: string | null;
}

export interface Note {
  id: string;
  parentKind: 'project' | 'inspection';
  parentId: string;
  body: string;
  createdBy: string | null;
  authorEmail: string | null;
  createdAt: string;
}

// Records that a due/overdue inspection has been seen — a separate audit
// trail from dueStatus itself, which stays purely date-derived regardless
// of acknowledgement (see apps/api/src/services/acknowledgements.service.ts).
export interface Acknowledgement {
  id: string;
  inspectionId: string;
  acknowledgedBy: string | null;
  acknowledgedByEmail: string | null;
  acknowledgedAt: string;
  nextInspectionDateAtAck: string | null;
}
