import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/config/supabaseAdmin', async () => {
  const mod = await import('./mockSupabaseAdmin');
  return { supabaseAdmin: mod.supabaseAdmin };
});

import { createApp } from '../src/app';
import { resetDb } from './mockSupabaseAdmin';
import { profiles, seedDb } from './seed';

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

// requireAuth is exercised here via GET /me — the simplest protected route,
// with no RBAC/module logic layered on top, so these tests isolate
// authentication behavior specifically (see apps/api/src/middleware/auth.ts).
describe('requireAuth — profile provisioning/active/client-active gating', () => {
  it('case 1: an active, provisioned admin (no client) is authenticated', async () => {
    const res = await request(app).get('/api/v1/me').set(authed(profiles.admin.id));
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ id: profiles.admin.id, role: 'admin', clientId: null });
  });

  it('case 2: an active, provisioned client user with an active client is authenticated', async () => {
    const res = await request(app).get('/api/v1/me').set(authed(profiles.viewOnlyA.id));
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ id: profiles.viewOnlyA.id, role: 'view_only' });
  });

  it('case 3: an unprovisioned profile is rejected', async () => {
    const res = await request(app).get('/api/v1/me').set(authed(profiles.unprovisioned.id));
    expect(res.status).toBe(401);
  });

  it('case 4: an inactive profile is rejected, even though provisioned', async () => {
    const res = await request(app).get('/api/v1/me').set(authed(profiles.inactiveProfile.id));
    expect(res.status).toBe(401);
  });

  it('case 5: an active, provisioned profile with an inactive client is rejected', async () => {
    const res = await request(app).get('/api/v1/me').set(authed(profiles.inactiveClientUser.id));
    expect(res.status).toBe(401);
  });

  it('case 6: an active, provisioned admin with no client is authenticated (admins never need a client)', async () => {
    const res = await request(app).get('/api/v1/me').set(authed(profiles.adminNoClient.id));
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ role: 'admin', clientId: null });
  });

  it('case 7: a non-admin with no client is rejected (existing client_id-required rule preserved)', async () => {
    const res = await request(app).get('/api/v1/me').set(authed(profiles.noClientNonAdmin.id));
    expect(res.status).toBe(401);
  });

  it('gives an identical, generic response for every rejection reason — no account-state leakage', async () => {
    const [missing, unprovisioned, inactive, inactiveClient, noClient] = await Promise.all([
      request(app).get('/api/v1/me').set(authed('user-does-not-exist')),
      request(app).get('/api/v1/me').set(authed(profiles.unprovisioned.id)),
      request(app).get('/api/v1/me').set(authed(profiles.inactiveProfile.id)),
      request(app).get('/api/v1/me').set(authed(profiles.inactiveClientUser.id)),
      request(app).get('/api/v1/me').set(authed(profiles.noClientNonAdmin.id)),
    ]);

    for (const res of [missing, unprovisioned, inactive, inactiveClient, noClient]) {
      expect(res.status).toBe(401);
      expect(res.body).toEqual(missing.body);
    }
  });
});
