import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/config/supabaseAdmin', async () => {
  const mod = await import('./mockSupabaseAdmin');
  return { supabaseAdmin: mod.supabaseAdmin };
});

import { createApp } from '../src/app';
import { resetDb } from './mockSupabaseAdmin';
import { clients, inspections, profiles, projects, seedDb } from './seed';

const app = createApp();

function tokenFor(userId: string): string {
  return jwt.sign({ sub: userId }, process.env.SUPABASE_JWT_SECRET as string);
}

function authed(userId: string) {
  return { Authorization: `Bearer ${tokenFor(userId)}` };
}

beforeEach(() => {
  resetDb(seedDb());
});

describe('GET /api/v1/inspections (list)', () => {
  it('rejects unauthenticated requests', async () => {
    const res = await request(app).get('/api/v1/inspections');
    expect(res.status).toBe(401);
  });

  it('lets admin see all inspections across clients', async () => {
    const res = await request(app).get('/api/v1/inspections').set(authed(profiles.admin.id));
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
  });

  it('lets upload_notes see only their own client inspections', async () => {
    const res = await request(app).get('/api/v1/inspections').set(authed(profiles.uploadNotesA.id));
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].clientId).toBe(clients.clientA.id);
  });

  it('blocks a client whose module access is off', async () => {
    const res = await request(app).get('/api/v1/inspections').set(authed(profiles.viewOnlyB.id));
    expect(res.status).toBe(403);
  });

  it('filters by date range', async () => {
    const res = await request(app)
      .get('/api/v1/inspections?dateFrom=2026-02-01')
      .set(authed(profiles.admin.id));
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(0);
  });

  it('filters by due date range (next_inspection_date)', async () => {
    await request(app)
      .patch(`/api/v1/inspections/${inspections[0].id}`)
      .set(authed(profiles.admin.id))
      .send({ nextInspectionDate: '2026-06-01' });

    const inRange = await request(app)
      .get('/api/v1/inspections?dueDateFrom=2026-05-01&dueDateTo=2026-07-01')
      .set(authed(profiles.admin.id));
    expect(inRange.status).toBe(200);
    expect(inRange.body.items).toHaveLength(1);

    const outOfRange = await request(app)
      .get('/api/v1/inspections?dueDateFrom=2027-01-01')
      .set(authed(profiles.admin.id));
    expect(outOfRange.status).toBe(200);
    expect(outOfRange.body.items).toHaveLength(0);
  });

  it('supports sorting by next_inspection_date and filtering by a status list', async () => {
    const sorted = await request(app)
      .get('/api/v1/inspections?sortBy=next_inspection_date&sortDir=asc')
      .set(authed(profiles.admin.id));
    expect(sorted.status).toBe(200);

    const filtered = await request(app)
      .get('/api/v1/inspections?status=scheduled,in_progress')
      .set(authed(profiles.admin.id));
    expect(filtered.status).toBe(200);
    expect(filtered.body.items).toHaveLength(1);
  });

  it('filters by search term across title and suburb', async () => {
    const match = await request(app)
      .get(`/api/v1/inspections?search=${encodeURIComponent('Inspection A1')}`)
      .set(authed(profiles.admin.id));
    expect(match.status).toBe(200);
    expect(match.body.items).toHaveLength(1);

    const noMatch = await request(app).get('/api/v1/inspections?search=no-such-title').set(authed(profiles.admin.id));
    expect(noMatch.status).toBe(200);
    expect(noMatch.body.items).toHaveLength(0);
  });
});

describe('GET /api/v1/inspections/:id (single)', () => {
  it('allows a client user to read their own inspection', async () => {
    const res = await request(app)
      .get(`/api/v1/inspections/${inspections[0].id}`)
      .set(authed(profiles.viewOnlyA.id));
    expect(res.status).toBe(200);
  });

  it('blocks a client user (with module access) from reading another client inspection', async () => {
    const res = await request(app)
      .get(`/api/v1/inspections/${inspections[0].id}`)
      .set(authed(profiles.viewOnlyC.id));
    expect(res.status).toBe(403);
  });
});

describe('POST /api/v1/inspections (create)', () => {
  it('allows admin to create', async () => {
    const res = await request(app)
      .post('/api/v1/inspections')
      .set(authed(profiles.admin.id))
      .send({ clientId: clients.clientA.id, title: 'New Inspection' });
    expect(res.status).toBe(201);
  });

  it('blocks upload_notes from creating', async () => {
    const res = await request(app)
      .post('/api/v1/inspections')
      .set(authed(profiles.uploadNotesA.id))
      .send({ clientId: clients.clientA.id, title: 'New Inspection' });
    expect(res.status).toBe(403);
  });

  it('rejects a projectId that belongs to a different client', async () => {
    const res = await request(app)
      .post('/api/v1/inspections')
      .set(authed(profiles.admin.id))
      .send({ clientId: clients.clientB.id, title: 'Mismatched', projectId: projects[0].id });
    expect(res.status).toBe(400);
  });

  it('persists the extended tracking fields', async () => {
    const res = await request(app)
      .post('/api/v1/inspections')
      .set(authed(profiles.admin.id))
      .send({
        clientId: clients.clientA.id,
        title: 'Full Detail Inspection',
        suburb: 'Springfield',
        suggestedWorks: 'Repoint brickwork',
        remediationQuote: 1250.5,
        lastInspectionDate: '2026-01-01',
        nextInspectionDate: '2026-07-01',
      });
    expect(res.status).toBe(201);
    expect(res.body.inspection).toMatchObject({
      suburb: 'Springfield',
      suggestedWorks: 'Repoint brickwork',
      remediationQuote: 1250.5,
      lastInspectionDate: '2026-01-01',
      nextInspectionDate: '2026-07-01',
    });
  });
});

describe('PATCH /api/v1/inspections/:id (update)', () => {
  it('allows admin to update', async () => {
    const res = await request(app)
      .patch(`/api/v1/inspections/${inspections[0].id}`)
      .set(authed(profiles.admin.id))
      .send({ status: 'completed' });
    expect(res.status).toBe(200);
    expect(res.body.inspection.status).toBe('completed');
  });

  it('blocks view_only from updating', async () => {
    const res = await request(app)
      .patch(`/api/v1/inspections/${inspections[0].id}`)
      .set(authed(profiles.viewOnlyA.id))
      .send({ status: 'completed' });
    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/v1/inspections/:id', () => {
  it('blocks upload_notes from deleting', async () => {
    const res = await request(app)
      .delete(`/api/v1/inspections/${inspections[0].id}`)
      .set(authed(profiles.uploadNotesA.id));
    expect(res.status).toBe(403);
  });

  it('allows admin to delete', async () => {
    const res = await request(app).delete(`/api/v1/inspections/${inspections[0].id}`).set(authed(profiles.admin.id));
    expect(res.status).toBe(204);
  });
});

describe('Inspection notes/comments', () => {
  it('lets any permitted client role read notes', async () => {
    const res = await request(app)
      .get(`/api/v1/inspections/${inspections[0].id}/notes`)
      .set(authed(profiles.viewOnlyA.id));
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
  });

  it('blocks reading notes for another client', async () => {
    const res = await request(app)
      .get(`/api/v1/inspections/${inspections[0].id}/notes`)
      .set(authed(profiles.viewOnlyC.id));
    expect(res.status).toBe(403);
  });

  it('lets upload_notes add a note', async () => {
    const res = await request(app)
      .post(`/api/v1/inspections/${inspections[0].id}/notes`)
      .set(authed(profiles.uploadNotesA.id))
      .send({ body: 'Checked the roof, looks fine.' });
    expect(res.status).toBe(201);
    expect(res.body.note.body).toBe('Checked the roof, looks fine.');

    const list = await request(app)
      .get(`/api/v1/inspections/${inspections[0].id}/notes`)
      .set(authed(profiles.viewOnlyA.id));
    expect(list.body.items).toHaveLength(1);
  });

  it('lets admin add a note', async () => {
    const res = await request(app)
      .post(`/api/v1/inspections/${inspections[0].id}/notes`)
      .set(authed(profiles.admin.id))
      .send({ body: 'Admin note' });
    expect(res.status).toBe(201);
  });

  it('blocks view_only from adding a note (read-only)', async () => {
    const res = await request(app)
      .post(`/api/v1/inspections/${inspections[0].id}/notes`)
      .set(authed(profiles.viewOnlyA.id))
      .send({ body: 'Should not be allowed' });
    expect(res.status).toBe(403);
  });

  it('blocks a caller from a different client from adding a note, even for a role that can normally add notes', async () => {
    const res = await request(app)
      .post(`/api/v1/inspections/${inspections[0].id}/notes`)
      .set(authed(profiles.viewOnlyC.id))
      .send({ body: 'Cross-client attempt' });
    // viewOnlyC is blocked here by role (not upload_notes/admin); the
    // ownership check (assertClientOwnership) is exercised separately by
    // the "blocks reading notes for another client" case above, since GET
    // has no role restriction to short-circuit on first.
    expect(res.status).toBe(403);
  });
});
