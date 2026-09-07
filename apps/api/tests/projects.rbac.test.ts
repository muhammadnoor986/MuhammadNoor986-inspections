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

describe('GET /api/v1/projects (list)', () => {
  it('rejects unauthenticated requests', async () => {
    const res = await request(app).get('/api/v1/projects');
    expect(res.status).toBe(401);
  });

  it('rejects an invalid token', async () => {
    const res = await request(app).get('/api/v1/projects').set('Authorization', 'Bearer garbage');
    expect(res.status).toBe(401);
  });

  it('lets admin see all projects across clients', async () => {
    const res = await request(app).get('/api/v1/projects').set(authed(profiles.admin.id));
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
  });

  it('lets upload_notes see only their own client projects', async () => {
    const res = await request(app).get('/api/v1/projects').set(authed(profiles.uploadNotesA.id));
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].clientId).toBe(clients.clientA.id);
  });

  it('lets view_only see permitted projects', async () => {
    const res = await request(app).get('/api/v1/projects').set(authed(profiles.viewOnlyA.id));
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
  });

  it('blocks a client whose module access is off', async () => {
    const res = await request(app).get('/api/v1/projects').set(authed(profiles.viewOnlyB.id));
    expect(res.status).toBe(403);
  });

  it('supports filtering by a comma-separated status list', async () => {
    const res = await request(app)
      .get('/api/v1/projects?status=active,on_hold')
      .set(authed(profiles.admin.id));
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);

    const none = await request(app)
      .get('/api/v1/projects?status=completed,archived')
      .set(authed(profiles.admin.id));
    expect(none.status).toBe(200);
    expect(none.body.items).toHaveLength(0);
  });

  it('supports sorting by address', async () => {
    const res = await request(app)
      .get('/api/v1/projects?sortBy=address&sortDir=asc')
      .set(authed(profiles.admin.id));
    expect(res.status).toBe(200);
  });

  it('filters by search term across name and address', async () => {
    const match = await request(app)
      .get(`/api/v1/projects?search=${encodeURIComponent('Project A1')}`)
      .set(authed(profiles.admin.id));
    expect(match.status).toBe(200);
    expect(match.body.items).toHaveLength(1);

    const noMatch = await request(app)
      .get('/api/v1/projects?search=no-such-project')
      .set(authed(profiles.admin.id));
    expect(noMatch.status).toBe(200);
    expect(noMatch.body.items).toHaveLength(0);
  });
});

describe('GET /api/v1/projects/:id (single)', () => {
  it('allows a client user to read their own project', async () => {
    const res = await request(app).get(`/api/v1/projects/${projects[0].id}`).set(authed(profiles.viewOnlyA.id));
    expect(res.status).toBe(200);
    expect(res.body.project.id).toBe(projects[0].id);
  });

  it('blocks a client whose module access is off', async () => {
    const res = await request(app).get(`/api/v1/projects/${projects[0].id}`).set(authed(profiles.viewOnlyB.id));
    expect(res.status).toBe(403);
  });

  it('blocks a client user (with module access) from reading another client project', async () => {
    const res = await request(app).get(`/api/v1/projects/${projects[0].id}`).set(authed(profiles.viewOnlyC.id));
    expect(res.status).toBe(403);
  });

  it('returns 404 for a missing project', async () => {
    const res = await request(app)
      .get('/api/v1/projects/00000000-0000-0000-0000-000000000000')
      .set(authed(profiles.admin.id));
    expect(res.status).toBe(404);
  });
});

describe('POST /api/v1/projects (create)', () => {
  const payload = { clientId: clients.clientA.id, name: 'New Project' };

  it('allows admin to create', async () => {
    const res = await request(app).post('/api/v1/projects').set(authed(profiles.admin.id)).send(payload);
    expect(res.status).toBe(201);
    expect(res.body.project.name).toBe('New Project');
  });

  it('blocks upload_notes from creating', async () => {
    const res = await request(app)
      .post('/api/v1/projects')
      .set(authed(profiles.uploadNotesA.id))
      .send(payload);
    expect(res.status).toBe(403);
  });

  it('blocks view_only from creating', async () => {
    const res = await request(app).post('/api/v1/projects').set(authed(profiles.viewOnlyA.id)).send(payload);
    expect(res.status).toBe(403);
  });

  it('rejects an invalid body', async () => {
    const res = await request(app)
      .post('/api/v1/projects')
      .set(authed(profiles.admin.id))
      .send({ clientId: 'not-a-uuid' });
    expect(res.status).toBe(400);
  });
});

describe('PATCH /api/v1/projects/:id (update)', () => {
  it('allows admin to update', async () => {
    const res = await request(app)
      .patch(`/api/v1/projects/${projects[0].id}`)
      .set(authed(profiles.admin.id))
      .send({ name: 'Renamed' });
    expect(res.status).toBe(200);
    expect(res.body.project.name).toBe('Renamed');
  });

  it('blocks upload_notes from updating', async () => {
    const res = await request(app)
      .patch(`/api/v1/projects/${projects[0].id}`)
      .set(authed(profiles.uploadNotesA.id))
      .send({ name: 'Renamed' });
    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/v1/projects/:id', () => {
  it('blocks view_only from deleting', async () => {
    const res = await request(app).delete(`/api/v1/projects/${projects[0].id}`).set(authed(profiles.viewOnlyA.id));
    expect(res.status).toBe(403);
  });

  it('allows admin to delete', async () => {
    const res = await request(app).delete(`/api/v1/projects/${projects[0].id}`).set(authed(profiles.admin.id));
    expect(res.status).toBe(204);
  });
});
