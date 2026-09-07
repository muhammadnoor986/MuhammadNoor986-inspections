import { supabaseAdmin } from '../config/supabaseAdmin';
import { mapDbError } from '../lib/dbErrors';
import { buildPaginationMeta, toRange, type PaginationMeta } from '../lib/pagination';
import type { AcknowledgementsListQuery } from '../schemas/acknowledgements.schema';

export interface Acknowledgement {
  id: string;
  inspectionId: string;
  acknowledgedBy: string | null;
  acknowledgedByEmail: string | null;
  acknowledgedAt: string;
  nextInspectionDateAtAck: string | null;
}

interface AcknowledgementRow {
  id: string;
  inspection_id: string;
  acknowledged_by: string | null;
  acknowledged_at: string;
  next_inspection_date_at_ack: string | null;
  profiles: { email: string } | null;
}

function toAcknowledgement(row: AcknowledgementRow): Acknowledgement {
  return {
    id: row.id,
    inspectionId: row.inspection_id,
    acknowledgedBy: row.acknowledged_by,
    acknowledgedByEmail: row.profiles?.email ?? null,
    acknowledgedAt: row.acknowledged_at,
    nextInspectionDateAtAck: row.next_inspection_date_at_ack,
  };
}

export async function listAcknowledgements(
  inspectionId: string,
  query: AcknowledgementsListQuery
): Promise<{ items: Acknowledgement[]; meta: PaginationMeta }> {
  const [from, to] = toRange(query);

  const { data, error, count } = await supabaseAdmin
    .from('inspection_acknowledgements')
    .select('id, inspection_id, acknowledged_by, acknowledged_at, next_inspection_date_at_ack, profiles ( email )', {
      count: 'exact',
    })
    .eq('inspection_id', inspectionId)
    .order('acknowledged_at', { ascending: query.sortDir === 'asc' })
    .range(from, to);

  if (error) throw mapDbError(error);

  return {
    items: (data as unknown as AcknowledgementRow[]).map(toAcknowledgement),
    meta: buildPaginationMeta(query, count ?? 0),
  };
}

export async function createAcknowledgement(
  inspectionId: string,
  acknowledgedBy: string,
  nextInspectionDateAtAck: string | null
): Promise<Acknowledgement> {
  const { data, error } = await supabaseAdmin
    .from('inspection_acknowledgements')
    .insert({
      inspection_id: inspectionId,
      acknowledged_by: acknowledgedBy,
      acknowledged_at: new Date().toISOString(),
      next_inspection_date_at_ack: nextInspectionDateAtAck,
    })
    .select('id, inspection_id, acknowledged_by, acknowledged_at, next_inspection_date_at_ack, profiles ( email )')
    .single();

  if (error) throw mapDbError(error);
  return toAcknowledgement(data as unknown as AcknowledgementRow);
}
