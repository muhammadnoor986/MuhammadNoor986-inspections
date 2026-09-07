// A minimal in-memory stand-in for the Supabase/Postgrest client, just
// enough of the fluent query builder surface that our services/middleware
// use (select/insert/update/delete + eq/gte/lte/order/range/single/
// maybeSingle), plus the two Supabase Auth Admin API methods
// users.service.ts calls (auth.admin.inviteUserByEmail/updateUserById).
// Lets RBAC and route tests run without a real Supabase project. Not a
// general-purpose Postgrest mock — extend as needed.

import { vi } from 'vitest';

type Row = Record<string, any>;
type Db = Record<string, Row[]>;

let nextId = 1;
// Real ids matter here (not just uniqueness) — several schemas validate
// path/body ids with z.string().uuid() (e.g. attachmentIdParamSchema), so a
// non-UUID placeholder like "table-generated-1" would fail validation
// before a test's assertions even run.
function freshId(_prefix: string): string {
  const n = (nextId++).toString(16).padStart(12, '0');
  return `00000000-0000-4000-8000-${n}`;
}

export const db: Db = {};

/** Splits on `sep` but ignores separators nested inside parentheses — needed to split PostgREST's and(...)/or(...) groups correctly. */
function splitTopLevel(str: string, sep: string): string[] {
  const result: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of str) {
    if (ch === '(') depth += 1;
    if (ch === ')') depth -= 1;
    if (ch === sep && depth === 0) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

function parseSimpleClause(clause: string): (row: Row) => boolean {
  const [field, op, ...rest] = clause.split('.');
  const rawValue = rest.join('.');
  switch (op) {
    case 'ilike': {
      const term = rawValue.replace(/^%|%$/g, '').replace(/\\([%,()])/g, '$1').toLowerCase();
      return (row) => typeof row[field] === 'string' && row[field].toLowerCase().includes(term);
    }
    case 'eq':
      return (row) => row[field] === rawValue;
    case 'is':
      return (row) => (rawValue === 'null' ? row[field] == null : row[field] === rawValue);
    case 'lt':
      return (row) => row[field] != null && row[field] < rawValue;
    case 'lte':
      return (row) => row[field] != null && row[field] <= rawValue;
    case 'gt':
      return (row) => row[field] != null && row[field] > rawValue;
    case 'gte':
      return (row) => row[field] != null && row[field] >= rawValue;
    default:
      throw new Error(`FakeQueryBuilder.or: unsupported operator "${op}"`);
  }
}

function parseClause(clause: string): (row: Row) => boolean {
  const trimmed = clause.trim();
  if (trimmed.startsWith('and(') && trimmed.endsWith(')')) {
    const subs = splitTopLevel(trimmed.slice(4, -1), ',').map(parseClause);
    return (row) => subs.every((matches) => matches(row));
  }
  if (trimmed.startsWith('or(') && trimmed.endsWith(')')) {
    const subs = splitTopLevel(trimmed.slice(3, -1), ',').map(parseClause);
    return (row) => subs.some((matches) => matches(row));
  }
  return parseSimpleClause(trimmed);
}

function parseOrExpression(expression: string): (row: Row) => boolean {
  const clauses = splitTopLevel(expression, ',').map(parseClause);
  return (row) => clauses.some((matches) => matches(row));
}

class FakeQueryBuilder implements PromiseLike<{ data: any; error: any; count: number | null }> {
  private filters: Array<(row: Row) => boolean> = [];
  private op: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private payload?: Row;
  private withCount = false;
  private orderField?: string;
  private orderAsc = true;
  private rangeFrom?: number;
  private rangeTo?: number;

  constructor(private table: string) {}

  select(_columns?: string, opts?: { count?: 'exact' }) {
    this.withCount = opts?.count === 'exact';
    return this;
  }

  insert(payload: Row) {
    this.op = 'insert';
    this.payload = payload;
    return this;
  }

  update(payload: Row) {
    this.op = 'update';
    this.payload = payload;
    return this;
  }

  delete(opts?: { count?: 'exact' }) {
    this.op = 'delete';
    this.withCount = opts?.count === 'exact';
    return this;
  }

  eq(field: string, value: unknown) {
    this.filters.push((row) => row[field] === value);
    return this;
  }

  in(field: string, values: unknown[]) {
    this.filters.push((row) => values.includes(row[field]));
    return this;
  }

  gte(field: string, value: unknown) {
    this.filters.push((row) => row[field] >= value);
    return this;
  }

  lte(field: string, value: unknown) {
    this.filters.push((row) => row[field] <= value);
    return this;
  }

  /**
   * Minimal stand-in for PostgREST's or() filter — supports the subset of
   * syntax this codebase actually generates: top-level OR'd clauses,
   * optionally grouped with and(...)/or(...), using ilike/eq/lt/lte/gt/gte
   * and `is.null`. See listProjects()'s search filter and
   * listInspections()'s dueStatus filter for real examples.
   */
  or(expression: string) {
    const predicate = parseOrExpression(expression);
    this.filters.push(predicate);
    return this;
  }

  order(field: string, opts?: { ascending?: boolean }) {
    this.orderField = field;
    this.orderAsc = opts?.ascending ?? true;
    return this;
  }

  range(from: number, to: number) {
    this.rangeFrom = from;
    this.rangeTo = to;
    return this;
  }

  single() {
    return this.execute(true, false);
  }

  maybeSingle() {
    return this.execute(false, true);
  }

  then<T1 = any, T2 = never>(
    onFulfilled?: ((value: { data: any; error: any; count: number | null }) => T1 | PromiseLike<T1>) | null,
    onRejected?: ((reason: any) => T2 | PromiseLike<T2>) | null
  ): PromiseLike<T1 | T2> {
    return this.execute(false, false).then(onFulfilled, onRejected);
  }

  private matched(): Row[] {
    return (db[this.table] ?? []).filter((row) => this.filters.every((f) => f(row)));
  }

  private async execute(single: boolean, maybeSingle: boolean) {
    if (this.op === 'insert') {
      const now = new Date().toISOString();
      const row: Row = { id: freshId(this.table), created_at: now, updated_at: now, ...this.payload };
      db[this.table] = [...(db[this.table] ?? []), row];
      return { data: row, error: null, count: null };
    }

    if (this.op === 'update') {
      const matched = this.matched();
      const now = new Date().toISOString();
      matched.forEach((row) => Object.assign(row, this.payload, { updated_at: now }));
      if (single) {
        if (matched.length !== 1) return { data: null, error: { code: 'PGRST116', message: 'no rows' }, count: matched.length };
        return { data: matched[0], error: null, count: matched.length };
      }
      const data = maybeSingle ? matched[0] ?? null : matched;
      return { data, error: null, count: matched.length };
    }

    if (this.op === 'delete') {
      const toDelete = new Set(this.matched());
      const before = (db[this.table] ?? []).length;
      db[this.table] = (db[this.table] ?? []).filter((row) => !toDelete.has(row));
      const count = before - db[this.table].length;
      return { data: null, error: null, count };
    }

    // select
    let rows = this.matched();
    const count = this.withCount ? rows.length : null;

    if (this.orderField) {
      const field = this.orderField;
      rows = [...rows].sort((a, b) => {
        if (a[field] < b[field]) return this.orderAsc ? -1 : 1;
        if (a[field] > b[field]) return this.orderAsc ? 1 : -1;
        return 0;
      });
    }
    if (this.rangeFrom !== undefined) {
      rows = rows.slice(this.rangeFrom, (this.rangeTo ?? rows.length) + 1);
    }

    if (single) {
      if (rows.length !== 1) {
        return { data: null, error: { code: 'PGRST116', message: 'no rows' }, count };
      }
      return { data: rows[0], error: null, count };
    }
    if (maybeSingle) {
      return { data: rows[0] ?? null, error: null, count };
    }
    return { data: rows, error: null, count };
  }
}

// Default inviteUserByEmail behavior: creates an auth user id and inserts
// the same unprovisioned profiles row handle_new_user() would in real
// Postgres (0001_init.sql / 0005_fix_profile_provisioning.sql) — role
// defaults to 'view_only', client_id NULL, provisioned false. Lets
// users.service.ts's provisioning UPDATE step find a real row to update,
// exactly like it would against a real trigger. Tests that need a
// different outcome (Auth failure, no row created, etc.) override this
// per-test with mockImplementationOnce/mockResolvedValueOnce.
async function defaultInviteUserByEmail(email: string) {
  const id = freshId('auth-user');
  const now = new Date().toISOString();
  db.profiles = [
    ...(db.profiles ?? []),
    {
      id,
      email,
      full_name: null,
      role: 'view_only',
      client_id: null,
      provisioned: false,
      is_active: true,
      created_at: now,
      updated_at: now,
    },
  ];
  return { data: { user: { id, email } }, error: null };
}

async function defaultUpdateUserById(uid: string) {
  return { data: { user: { id: uid } }, error: null };
}

export const authAdminMocks = {
  inviteUserByEmail: vi.fn(defaultInviteUserByEmail),
  updateUserById: vi.fn(defaultUpdateUserById),
};

export const supabaseAdmin = {
  from(table: string) {
    return new FakeQueryBuilder(table);
  },
  auth: {
    admin: authAdminMocks,
  },
} as any;

export function resetDb(seed: Db) {
  for (const key of Object.keys(db)) delete db[key];
  for (const [table, rows] of Object.entries(seed)) {
    db[table] = rows.map((row) => ({ ...row }));
  }
}

/** Clears call history and restores the default implementations above — call from beforeEach alongside resetDb(). */
export function resetAuthAdminMocks() {
  authAdminMocks.inviteUserByEmail.mockReset();
  authAdminMocks.inviteUserByEmail.mockImplementation(defaultInviteUserByEmail);
  authAdminMocks.updateUserById.mockReset();
  authAdminMocks.updateUserById.mockImplementation(defaultUpdateUserById);
}
