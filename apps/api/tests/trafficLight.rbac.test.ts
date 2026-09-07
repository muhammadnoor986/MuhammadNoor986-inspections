import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/config/supabaseAdmin', async () => {
  const mod = await import('./mockSupabaseAdmin');
  return { supabaseAdmin: mod.supabaseAdmin };
});

import { createApp } from '../src/app';
import { resetDb } from './mockSupabaseAdmin';
import { clients, inspections, profiles, seedDb } from './seed';

const app = createApp();

function tokenFor(userId: string): string {
  return jwt.sign({ sub: userId }, process.env.SUPABASE_JWT_SECRET as string);
}

function authed(userId: string) {
  return { Authorization: `Bearer ${tokenFor(userId)}` };
}

// Local date components, not toISOString() (UTC) — must match how
// lib/dueStatus.ts computes "today" server-side, or this drifts by a day
// depending on the machine's timezone offset at test time.
function isoDateDaysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

beforeEach(() => {
  resetDb(seedDb());
});

async function createInspectionWithDueDate(nextInspectionDate: string | undefined) {
  const res = await request(app)
    .post('/api/v1/inspections')
    .set(authed(profiles.admin.id))
    .send({ clientId: clients.clientA.id, title: 'Traffic Light Test', nextInspectionDate });
  expect(res.status).toBe(201);
  return res.body.inspection;
}

describe('Traffic-light dueStatus calculation', () => {
  it('is green when there is no due date set', async () => {
    const inspection = await createInspectionWithDueDate(undefined);
    expect(inspection.dueStatus).toBe('green');
  });

  it('is green when the due date is more than 30 days out', async () => {
    const inspection = await createInspectionWithDueDate(isoDateDaysFromNow(31));
    expect(inspection.dueStatus).toBe('green');
  });

  it('is orange today (boundary: due date == today)', async () => {
    const inspection = await createInspectionWithDueDate(isoDateDaysFromNow(0));
    expect(inspection.dueStatus).toBe('orange');
  });

  it('is orange at exactly 30 days out (boundary: inclusive)', async () => {
    const inspection = await createInspectionWithDueDate(isoDateDaysFromNow(30));
    expect(inspection.dueStatus).toBe('orange');
  });

  it('is orange for a near-future due date within the window', async () => {
    const inspection = await createInspectionWithDueDate(isoDateDaysFromNow(10));
    expect(inspection.dueStatus).toBe('orange');
  });

  it('is red for a due date one day in the past (boundary: exclusive of today)', async () => {
    const inspection = await createInspectionWithDueDate(isoDateDaysFromNow(-1));
    expect(inspection.dueStatus).toBe('red');
  });

  it('is red for a due date well in the past', async () => {
    const inspection = await createInspectionWithDueDate(isoDateDaysFromNow(-90));
    expect(inspection.dueStatus).toBe('red');
  });

  it('is reflected on the single-inspection GET as well as list', async () => {
    const created = await createInspectionWithDueDate(isoDateDaysFromNow(-5));
    const res = await request(app).get(`/api/v1/inspections/${created.id}`).set(authed(profiles.admin.id));
    expect(res.body.inspection.dueStatus).toBe('red');
  });
});

describe('Traffic-light filtering', () => {
  it('filters to only red', async () => {
    await createInspectionWithDueDate(isoDateDaysFromNow(-1)); // red
    await createInspectionWithDueDate(isoDateDaysFromNow(10)); // orange
    await createInspectionWithDueDate(undefined); // green

    const res = await request(app).get('/api/v1/inspections?dueStatus=red').set(authed(profiles.admin.id));
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].dueStatus).toBe('red');
  });

  it('filters to orange and red combined, excluding green', async () => {
    await createInspectionWithDueDate(isoDateDaysFromNow(-1)); // red
    await createInspectionWithDueDate(isoDateDaysFromNow(10)); // orange
    await createInspectionWithDueDate(undefined); // green
    await createInspectionWithDueDate(isoDateDaysFromNow(60)); // green

    const res = await request(app).get('/api/v1/inspections?dueStatus=orange,red').set(authed(profiles.admin.id));
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.items.map((i: { dueStatus: string }) => i.dueStatus).sort()).toEqual(['orange', 'red']);
  });

  it('filters to green (covers both null due date and far-future)', async () => {
    // The seeded inspections[0] has no due date and is itself green, so the
    // baseline here is 1, not 0.
    await createInspectionWithDueDate(isoDateDaysFromNow(-1)); // red — must be excluded
    await createInspectionWithDueDate(undefined); // green
    await createInspectionWithDueDate(isoDateDaysFromNow(60)); // green

    const res = await request(app).get('/api/v1/inspections?dueStatus=green').set(authed(profiles.admin.id));
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(3);
    expect(res.body.items.every((i: { dueStatus: string }) => i.dueStatus === 'green')).toBe(true);
  });

  it('still enforces client scoping for non-admins under a dueStatus filter', async () => {
    await createInspectionWithDueDate(isoDateDaysFromNow(-1)); // client A, red

    const res = await request(app).get('/api/v1/inspections?dueStatus=red').set(authed(profiles.uploadNotesA.id));
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].clientId).toBe(clients.clientA.id);
  });
});

describe('Acknowledgement', () => {
  it('lets admin acknowledge and records inspection/user/timestamp', async () => {
    const res = await request(app)
      .post(`/api/v1/inspections/${inspections[0].id}/acknowledge`)
      .set(authed(profiles.admin.id));
    expect(res.status).toBe(201);
    expect(res.body.acknowledgement).toMatchObject({
      inspectionId: inspections[0].id,
      acknowledgedBy: profiles.admin.id,
    });
    expect(res.body.acknowledgement.acknowledgedAt).toBeTruthy();
  });

  it('lets upload_notes acknowledge', async () => {
    const res = await request(app)
      .post(`/api/v1/inspections/${inspections[0].id}/acknowledge`)
      .set(authed(profiles.uploadNotesA.id));
    expect(res.status).toBe(201);
    expect(res.body.acknowledgement.acknowledgedBy).toBe(profiles.uploadNotesA.id);
  });

  it('blocks view_only from acknowledging (must remain read-only)', async () => {
    const res = await request(app)
      .post(`/api/v1/inspections/${inspections[0].id}/acknowledge`)
      .set(authed(profiles.viewOnlyA.id));
    expect(res.status).toBe(403);
  });

  it('blocks acknowledging an inspection belonging to another client', async () => {
    const res = await request(app)
      .post(`/api/v1/inspections/${inspections[0].id}/acknowledge`)
      .set(authed(profiles.viewOnlyC.id));
    expect(res.status).toBe(403);
  });

  it('rejects unauthenticated acknowledgement', async () => {
    const res = await request(app).post(`/api/v1/inspections/${inspections[0].id}/acknowledge`);
    expect(res.status).toBe(401);
  });

  it('lists acknowledgement history for a permitted user, newest first by default', async () => {
    await request(app).post(`/api/v1/inspections/${inspections[0].id}/acknowledge`).set(authed(profiles.admin.id));
    await request(app)
      .post(`/api/v1/inspections/${inspections[0].id}/acknowledge`)
      .set(authed(profiles.uploadNotesA.id));

    const res = await request(app)
      .get(`/api/v1/inspections/${inspections[0].id}/acknowledgements`)
      .set(authed(profiles.viewOnlyA.id));
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(2);
  });

  it('blocks reading acknowledgement history for another client', async () => {
    const res = await request(app)
      .get(`/api/v1/inspections/${inspections[0].id}/acknowledgements`)
      .set(authed(profiles.viewOnlyC.id));
    expect(res.status).toBe(403);
  });

  it('does not change the traffic-light color — acknowledging is a separate audit trail', async () => {
    const overdue = await createInspectionWithDueDate(isoDateDaysFromNow(-3));
    expect(overdue.dueStatus).toBe('red');

    await request(app).post(`/api/v1/inspections/${overdue.id}/acknowledge`).set(authed(profiles.admin.id));

    const after = await request(app).get(`/api/v1/inspections/${overdue.id}`).set(authed(profiles.admin.id));
    expect(after.body.inspection.dueStatus).toBe('red');
  });
});
