/**
 * The inspection "traffic light". Always derived from
 * inspections.next_inspection_date at read time — never stored — so it can
 * never drift out of sync with the date it represents. This is the single
 * place that definition lives; both serialization (attach dueStatus to an
 * inspection) and filtering (list inspections by color) go through it.
 */
export type DueStatus = 'green' | 'orange' | 'red';

/** How many days out counts as "due now" (orange) rather than "up to date" (green). Tune here only. */
export const DUE_SOON_DAYS = 30;

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Local Y-M-D, not toISOString() (UTC) — a local midnight Date shifted to UTC can land on the wrong calendar day depending on timezone offset. */
function toLocalIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00`);
}

/** No due date set at all = nothing to be due yet = green, by definition. */
export function computeDueStatus(nextInspectionDate: string | null, today: Date = new Date()): DueStatus {
  if (!nextInspectionDate) return 'green';

  const due = parseDateOnly(nextInspectionDate);
  const from = startOfDay(today);
  const diffDays = Math.floor((due.getTime() - from.getTime()) / 86_400_000);

  if (diffDays < 0) return 'red';
  if (diffDays <= DUE_SOON_DAYS) return 'orange';
  return 'green';
}

/**
 * The inclusive [greenBoundary, todayIso] pair that separates orange from
 * green/red, as ISO date strings — used to translate a dueStatus filter
 * into next_inspection_date range conditions in listInspections().
 */
export function dueStatusBoundaries(today: Date = new Date()): { todayIso: string; orangeEndIso: string } {
  const from = startOfDay(today);
  const orangeEnd = new Date(from);
  orangeEnd.setDate(orangeEnd.getDate() + DUE_SOON_DAYS);
  return { todayIso: toLocalIsoDate(from), orangeEndIso: toLocalIsoDate(orangeEnd) };
}
