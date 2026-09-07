import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/config/supabaseAdmin', async () => {
  const mod = await import('./mockSupabaseAdmin');
  return { supabaseAdmin: mod.supabaseAdmin };
});

import { createApp } from '../src/app';
import { resetDb } from './mockSupabaseAdmin';
import { clients, profiles, projects, seedDb } from './seed';

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

async function createTestClient(overrides: Partial<{ name: string; canAccessProjects: boolean; canAccessInspections: boolean }> = {}) {
  const res = await request(app)
    .post('/api/v1/clients')
    .set(authed(profiles.admin.id))
    .send({ name: 'New Client', canAccessProjects: true, canAccessInspections: false, ...overrides });
  return res;
}

describe('Client management — authorization', () => {
  it('1. admin can list clients', async () => {
    const res = await request(app).get('/api/v1/clients').set(authed(profiles.admin.id));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  it('2. admin can get a client', async () => {
    const res = await request(app).get(`/api/v1/clients/${clients.clientA.id}`).set(authed(profiles.admin.id));
    expect(res.status).toBe(200);
    expect(res.body.client.id).toBe(clients.clientA.id);
  });

  it('3. admin can create a client', async () => {
    const res = await createTestClient();
    expect(res.status).toBe(201);
    expect(res.body.client.name).toBe('New Client');
  });

  it('4. admin can update a client', async () => {
    const res = await request(app)
      .patch(`/api/v1/clients/${clients.clientB.id}`)
      .set(authed(profiles.admin.id))
      .send({ name: 'Renamed Client B' });
    expect(res.status).toBe(200);
    expect(res.body.client.name).toBe('Renamed Client B');
  });

  it('5. admin can activate a client', async () => {
    const res = await request(app)
      .patch(`/api/v1/clients/${clients.clientInactive.id}/activate`)
      .set(authed(profiles.admin.id));
    expect(res.status).toBe(200);
    expect(res.body.client.isActive).toBe(true);
  });

  it('6. admin can deactivate a client', async () => {
    const res = await request(app)
      .patch(`/api/v1/clients/${clients.clientA.id}/deactivate`)
      .set(authed(profiles.admin.id));
    expect(res.status).toBe(200);
    expect(res.body.client.isActive).toBe(false);
  });

  it('7. upload_notes cannot access client management', async () => {
    const results = await Promise.all([
      request(app).get('/api/v1/clients').set(authed(profiles.uploadNotesA.id)),
      request(app).get(`/api/v1/clients/${clients.clientA.id}`).set(authed(profiles.uploadNotesA.id)),
      request(app).post('/api/v1/clients').set(authed(profiles.uploadNotesA.id)).send({ name: 'X', canAccessProjects: true, canAccessInspections: true }),
      request(app).patch(`/api/v1/clients/${clients.clientA.id}`).set(authed(profiles.uploadNotesA.id)).send({ name: 'X' }),
      request(app).patch(`/api/v1/clients/${clients.clientA.id}/activate`).set(authed(profiles.uploadNotesA.id)),
      request(app).patch(`/api/v1/clients/${clients.clientA.id}/deactivate`).set(authed(profiles.uploadNotesA.id)),
    ]);
    for (const res of results) expect(res.status).toBe(403);
  });

  it('8. view_only cannot access client management', async () => {
    const results = await Promise.all([
      request(app).get('/api/v1/clients').set(authed(profiles.viewOnlyA.id)),
      request(app).get(`/api/v1/clients/${clients.clientA.id}`).set(authed(profiles.viewOnlyA.id)),
      request(app).post('/api/v1/clients').set(authed(profiles.viewOnlyA.id)).send({ name: 'X', canAccessProjects: true, canAccessInspections: true }),
      request(app).patch(`/api/v1/clients/${clients.clientA.id}`).set(authed(profiles.viewOnlyA.id)).send({ name: 'X' }),
      request(app).patch(`/api/v1/clients/${clients.clientA.id}/activate`).set(authed(profiles.viewOnlyA.id)),
      request(app).patch(`/api/v1/clients/${clients.clientA.id}/deactivate`).set(authed(profiles.viewOnlyA.id)),
    ]);
    for (const res of results) expect(res.status).toBe(403);
  });

  it('9. unauthenticated requests are rejected', async () => {
    const results = await Promise.all([
      request(app).get('/api/v1/clients'),
      request(app).get(`/api/v1/clients/${clients.clientA.id}`),
      request(app).post('/api/v1/clients').send({ name: 'X', canAccessProjects: true, canAccessInspections: true }),
      request(app).patch(`/api/v1/clients/${clients.clientA.id}`).send({ name: 'X' }),
      request(app).patch(`/api/v1/clients/${clients.clientA.id}/activate`),
      request(app).patch(`/api/v1/clients/${clients.clientA.id}/deactivate`),
    ]);
    for (const res of results) expect(res.status).toBe(401);
  });
});

describe('Client management — create validation', () => {
  it('10. missing name rejected', async () => {
    const res = await request(app)
      .post('/api/v1/clients')
      .set(authed(profiles.admin.id))
      .send({ canAccessProjects: true, canAccessInspections: true });
    expect(res.status).toBe(400);
  });

  it('11. empty/whitespace name rejected', async () => {
    const empty = await createTestClient({ name: '' });
    expect(empty.status).toBe(400);

    const whitespace = await createTestClient({ name: '   ' });
    expect(whitespace.status).toBe(400);
  });

  it('12. invalid canAccessProjects rejected', async () => {
    const res = await request(app)
      .post('/api/v1/clients')
      .set(authed(profiles.admin.id))
      .send({ name: 'X', canAccessProjects: 'yes', canAccessInspections: true });
    expect(res.status).toBe(400);
  });

  it('13. invalid canAccessInspections rejected', async () => {
    const res = await request(app)
      .post('/api/v1/clients')
      .set(authed(profiles.admin.id))
      .send({ name: 'X', canAccessProjects: true, canAccessInspections: 'no' });
    expect(res.status).toBe(400);
  });

  it('14. new client defaults to isActive = true', async () => {
    const res = await createTestClient();
    expect(res.status).toBe(201);
    expect(res.body.client.isActive).toBe(true);
  });

  it('15. caller cannot inject id', async () => {
    const injectedId = '99999999-9999-9999-9999-999999999999';
    const res = await request(app)
      .post('/api/v1/clients')
      .set(authed(profiles.admin.id))
      .send({ id: injectedId, name: 'X', canAccessProjects: true, canAccessInspections: true });
    expect(res.status).toBe(201);
    expect(res.body.client.id).not.toBe(injectedId);
  });

  it('16. caller cannot inject isActive', async () => {
    const res = await request(app)
      .post('/api/v1/clients')
      .set(authed(profiles.admin.id))
      .send({ name: 'X', canAccessProjects: true, canAccessInspections: true, isActive: false });
    expect(res.status).toBe(201);
    expect(res.body.client.isActive).toBe(true);
  });
});

describe('Client management — update behavior', () => {
  it('17. partial update works', async () => {
    const res = await request(app)
      .patch(`/api/v1/clients/${clients.clientA.id}`)
      .set(authed(profiles.admin.id))
      .send({ canAccessInspections: false });
    expect(res.status).toBe(200);
    expect(res.body.client.canAccessInspections).toBe(false);
    expect(res.body.client.name).toBe(clients.clientA.name);
  });

  it('18. empty PATCH rejected', async () => {
    const res = await request(app).patch(`/api/v1/clients/${clients.clientA.id}`).set(authed(profiles.admin.id)).send({});
    expect(res.status).toBe(400);
  });

  it('19. invalid UUID rejected', async () => {
    const res = await request(app)
      .patch('/api/v1/clients/not-a-uuid')
      .set(authed(profiles.admin.id))
      .send({ name: 'X' });
    expect(res.status).toBe(400);
  });

  it('20. non-existent client returns standard not-found response', async () => {
    const missingId = '00000000-0000-0000-0000-000000000000';
    const get = await request(app).get(`/api/v1/clients/${missingId}`).set(authed(profiles.admin.id));
    expect(get.status).toBe(404);

    const patch = await request(app).patch(`/api/v1/clients/${missingId}`).set(authed(profiles.admin.id)).send({ name: 'X' });
    expect(patch.status).toBe(404);
  });

  it('21. update cannot change isActive', async () => {
    const res = await request(app)
      .patch(`/api/v1/clients/${clients.clientA.id}`)
      .set(authed(profiles.admin.id))
      .send({ name: 'Still Active Client', isActive: false });
    expect(res.status).toBe(200);
    expect(res.body.client.name).toBe('Still Active Client');
    expect(res.body.client.isActive).toBe(true);
  });
});

describe('Client management — activate/deactivate', () => {
  it('22. activate sets isActive = true', async () => {
    const res = await request(app)
      .patch(`/api/v1/clients/${clients.clientInactive.id}/activate`)
      .set(authed(profiles.admin.id));
    expect(res.status).toBe(200);
    expect(res.body.client.isActive).toBe(true);
  });

  it('23. deactivate sets isActive = false', async () => {
    const res = await request(app)
      .patch(`/api/v1/clients/${clients.clientA.id}/deactivate`)
      .set(authed(profiles.admin.id));
    expect(res.status).toBe(200);
    expect(res.body.client.isActive).toBe(false);
  });

  it('24. activate is idempotent', async () => {
    const first = await request(app).patch(`/api/v1/clients/${clients.clientA.id}/activate`).set(authed(profiles.admin.id));
    const second = await request(app).patch(`/api/v1/clients/${clients.clientA.id}/activate`).set(authed(profiles.admin.id));
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body.client.isActive).toBe(true);
  });

  it('25. deactivate is idempotent', async () => {
    const first = await request(app).patch(`/api/v1/clients/${clients.clientInactive.id}/deactivate`).set(authed(profiles.admin.id));
    const second = await request(app).patch(`/api/v1/clients/${clients.clientInactive.id}/deactivate`).set(authed(profiles.admin.id));
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body.client.isActive).toBe(false);
  });

  it('26. deactivation does not delete the client', async () => {
    await request(app).patch(`/api/v1/clients/${clients.clientA.id}/deactivate`).set(authed(profiles.admin.id));
    const res = await request(app).get(`/api/v1/clients/${clients.clientA.id}`).set(authed(profiles.admin.id));
    expect(res.status).toBe(200);
    expect(res.body.client.id).toBe(clients.clientA.id);
  });

  it('27. deactivation does not modify unrelated projects/inspections data', async () => {
    await request(app).patch(`/api/v1/clients/${clients.clientA.id}/deactivate`).set(authed(profiles.admin.id));

    const project = await request(app).get(`/api/v1/projects/${projects[0].id}`).set(authed(profiles.admin.id));
    expect(project.status).toBe(200);
    expect(project.body.project.clientId).toBe(clients.clientA.id);
    expect(project.body.project.name).toBe(projects[0].name);
  });
});

describe('Client management — list behavior', () => {
  it('28. pagination works', async () => {
    await createTestClient({ name: 'Pagination Client 1' });
    await createTestClient({ name: 'Pagination Client 2' });

    const res = await request(app).get('/api/v1/clients?page=1&pageSize=1').set(authed(profiles.admin.id));
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.meta.pageSize).toBe(1);
    expect(res.body.meta.total).toBeGreaterThanOrEqual(6); // 4 seeded + 2 created
    expect(res.body.meta.totalPages).toBeGreaterThanOrEqual(6);
  });

  it('29. name search works', async () => {
    const res = await request(app).get(`/api/v1/clients?search=${encodeURIComponent('Client A')}`).set(authed(profiles.admin.id));
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].id).toBe(clients.clientA.id);
  });

  it('30. active/inactive filtering works', async () => {
    const inactiveOnly = await request(app).get('/api/v1/clients?isActive=false').set(authed(profiles.admin.id));
    expect(inactiveOnly.status).toBe(200);
    expect(inactiveOnly.body.items.every((c: { isActive: boolean }) => c.isActive === false)).toBe(true);
    expect(inactiveOnly.body.items.some((c: { id: string }) => c.id === clients.clientInactive.id)).toBe(true);

    const activeOnly = await request(app).get('/api/v1/clients?isActive=true').set(authed(profiles.admin.id));
    expect(activeOnly.status).toBe(200);
    expect(activeOnly.body.items.every((c: { isActive: boolean }) => c.isActive === true)).toBe(true);
    expect(activeOnly.body.items.some((c: { id: string }) => c.id === clients.clientInactive.id)).toBe(false);
  });

  it('31. sorting works', async () => {
    const asc = await request(app).get('/api/v1/clients?sortBy=name&sortDir=asc&pageSize=100').set(authed(profiles.admin.id));
    expect(asc.status).toBe(200);
    const ascNames = asc.body.items.map((c: { name: string }) => c.name);
    expect(ascNames).toEqual([...ascNames].sort());

    const desc = await request(app).get('/api/v1/clients?sortBy=name&sortDir=desc&pageSize=100').set(authed(profiles.admin.id));
    expect(desc.status).toBe(200);
    const descNames = desc.body.items.map((c: { name: string }) => c.name);
    expect(descNames).toEqual([...ascNames].sort().reverse());
  });
});
