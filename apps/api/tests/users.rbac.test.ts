import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/config/supabaseAdmin', async () => {
  const mod = await import('./mockSupabaseAdmin');
  return { supabaseAdmin: mod.supabaseAdmin };
});

import { createApp } from '../src/app';
import { env } from '../src/config/env';
import { authAdminMocks, resetAuthAdminMocks, resetDb } from './mockSupabaseAdmin';
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
  resetAuthAdminMocks();
});

function inviteBody(overrides: Record<string, unknown> = {}) {
  return {
    email: 'newuser@test.dev',
    fullName: 'New User',
    role: 'upload_notes',
    clientId: clients.clientA.id,
    ...overrides,
  };
}

function invite(overrides: Record<string, unknown> = {}) {
  return request(app).post('/api/v1/users/invite').set(authed(profiles.admin.id)).send(inviteBody(overrides));
}

describe('User management — authorization', () => {
  it('1. admin can list users', async () => {
    const res = await request(app).get('/api/v1/users').set(authed(profiles.admin.id));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
  });

  it('2. admin can get a user', async () => {
    const res = await request(app).get(`/api/v1/users/${profiles.viewOnlyA.id}`).set(authed(profiles.admin.id));
    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(profiles.viewOnlyA.id);
  });

  it('3. admin can invite a user', async () => {
    const res = await invite();
    expect(res.status).toBe(201);
  });

  it('4. admin can update a user', async () => {
    const res = await request(app)
      .patch(`/api/v1/users/${profiles.viewOnlyA.id}`)
      .set(authed(profiles.admin.id))
      .send({ fullName: 'Updated Name' });
    expect(res.status).toBe(200);
  });

  it('5. admin can activate a user', async () => {
    const res = await request(app).patch(`/api/v1/users/${profiles.inactiveProfile.id}/activate`).set(authed(profiles.admin.id));
    expect(res.status).toBe(200);
  });

  it('6. admin can deactivate a user', async () => {
    const res = await request(app).patch(`/api/v1/users/${profiles.viewOnlyA.id}/deactivate`).set(authed(profiles.admin.id));
    expect(res.status).toBe(200);
  });

  it('7. upload_notes is rejected', async () => {
    const results = await Promise.all([
      request(app).get('/api/v1/users').set(authed(profiles.uploadNotesA.id)),
      request(app).get(`/api/v1/users/${profiles.viewOnlyA.id}`).set(authed(profiles.uploadNotesA.id)),
      request(app).post('/api/v1/users/invite').set(authed(profiles.uploadNotesA.id)).send(inviteBody()),
      request(app).patch(`/api/v1/users/${profiles.viewOnlyA.id}`).set(authed(profiles.uploadNotesA.id)).send({ fullName: 'X' }),
      request(app).patch(`/api/v1/users/${profiles.viewOnlyA.id}/activate`).set(authed(profiles.uploadNotesA.id)),
      request(app).patch(`/api/v1/users/${profiles.viewOnlyA.id}/deactivate`).set(authed(profiles.uploadNotesA.id)),
    ]);
    for (const res of results) expect(res.status).toBe(403);
  });

  it('8. view_only is rejected', async () => {
    const results = await Promise.all([
      request(app).get('/api/v1/users').set(authed(profiles.viewOnlyA.id)),
      request(app).get(`/api/v1/users/${profiles.viewOnlyB.id}`).set(authed(profiles.viewOnlyA.id)),
      request(app).post('/api/v1/users/invite').set(authed(profiles.viewOnlyA.id)).send(inviteBody()),
      request(app).patch(`/api/v1/users/${profiles.viewOnlyB.id}`).set(authed(profiles.viewOnlyA.id)).send({ fullName: 'X' }),
      request(app).patch(`/api/v1/users/${profiles.viewOnlyB.id}/activate`).set(authed(profiles.viewOnlyA.id)),
      request(app).patch(`/api/v1/users/${profiles.viewOnlyB.id}/deactivate`).set(authed(profiles.viewOnlyA.id)),
    ]);
    for (const res of results) expect(res.status).toBe(403);
  });

  it('9. unauthenticated request is rejected', async () => {
    const results = await Promise.all([
      request(app).get('/api/v1/users'),
      request(app).get(`/api/v1/users/${profiles.viewOnlyA.id}`),
      request(app).post('/api/v1/users/invite').send(inviteBody()),
      request(app).patch(`/api/v1/users/${profiles.viewOnlyA.id}`).send({ fullName: 'X' }),
      request(app).patch(`/api/v1/users/${profiles.viewOnlyA.id}/activate`),
      request(app).patch(`/api/v1/users/${profiles.viewOnlyA.id}/deactivate`),
    ]);
    for (const res of results) expect(res.status).toBe(401);
  });
});

describe('User management — list', () => {
  it('10. pagination works', async () => {
    const res = await request(app).get('/api/v1/users?page=1&pageSize=2').set(authed(profiles.admin.id));
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.meta.pageSize).toBe(2);
  });

  it('11. search by email works', async () => {
    const res = await request(app)
      .get(`/api/v1/users?search=${encodeURIComponent(profiles.viewOnlyA.email)}`)
      .set(authed(profiles.admin.id));
    expect(res.status).toBe(200);
    expect(res.body.items.some((u: { id: string }) => u.id === profiles.viewOnlyA.id)).toBe(true);
  });

  it('12. search by full name works', async () => {
    await invite({ email: 'findme@test.dev', fullName: 'Findable Person' });
    const res = await request(app).get('/api/v1/users?search=Findable').set(authed(profiles.admin.id));
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].fullName).toBe('Findable Person');
  });

  it('13. role filter works', async () => {
    const res = await request(app).get('/api/v1/users?role=upload_notes').set(authed(profiles.admin.id));
    expect(res.status).toBe(200);
    expect(res.body.items.every((u: { role: string }) => u.role === 'upload_notes')).toBe(true);
    expect(res.body.items.some((u: { id: string }) => u.id === profiles.uploadNotesA.id)).toBe(true);
  });

  it('14. client filter works', async () => {
    const res = await request(app).get(`/api/v1/users?clientId=${clients.clientA.id}`).set(authed(profiles.admin.id));
    expect(res.status).toBe(200);
    expect(res.body.items.every((u: { clientId: string | null }) => u.clientId === clients.clientA.id)).toBe(true);
  });

  it('15. active/inactive filter works', async () => {
    const inactive = await request(app).get('/api/v1/users?isActive=false').set(authed(profiles.admin.id));
    expect(inactive.status).toBe(200);
    expect(inactive.body.items.every((u: { isActive: boolean }) => u.isActive === false)).toBe(true);
    expect(inactive.body.items.some((u: { id: string }) => u.id === profiles.inactiveProfile.id)).toBe(true);
  });

  it('16. sorting works', async () => {
    const asc = await request(app).get('/api/v1/users?sortBy=email&sortDir=asc&pageSize=100').set(authed(profiles.admin.id));
    const ascEmails = asc.body.items.map((u: { email: string }) => u.email);
    expect(ascEmails).toEqual([...ascEmails].sort());

    const desc = await request(app).get('/api/v1/users?sortBy=email&sortDir=desc&pageSize=100').set(authed(profiles.admin.id));
    const descEmails = desc.body.items.map((u: { email: string }) => u.email);
    expect(descEmails).toEqual([...ascEmails].sort().reverse());
  });
});

describe('User management — invite validation', () => {
  it('17. invalid email rejected', async () => {
    const res = await invite({ email: 'not-an-email' });
    expect(res.status).toBe(400);
  });

  it('18. missing full name rejected', async () => {
    const res = await request(app)
      .post('/api/v1/users/invite')
      .set(authed(profiles.admin.id))
      .send({ email: 'x@test.dev', role: 'upload_notes', clientId: clients.clientA.id });
    expect(res.status).toBe(400);
  });

  it('19. empty full name rejected', async () => {
    const res = await invite({ fullName: '   ' });
    expect(res.status).toBe(400);
  });

  it('20. invalid role rejected', async () => {
    const res = await invite({ role: 'superadmin' });
    expect(res.status).toBe(400);
  });

  it('21. client user without client rejected', async () => {
    const res = await invite({ clientId: undefined });
    expect(res.status).toBe(400);
  });

  it('22. admin with client rejected', async () => {
    const res = await invite({ role: 'admin', clientId: clients.clientA.id });
    expect(res.status).toBe(400);
  });

  it('23. nonexistent client rejected', async () => {
    const res = await invite({ clientId: '99999999-9999-9999-9999-999999999999' });
    expect(res.status).toBe(400);
  });

  it('24. duplicate existing user rejected', async () => {
    const res = await invite({ email: profiles.viewOnlyA.email });
    expect(res.status).toBe(409);
    expect(authAdminMocks.inviteUserByEmail).not.toHaveBeenCalled();
  });
});

describe('User management — invite behavior', () => {
  it('25. inviteUserByEmail is called', async () => {
    await invite();
    expect(authAdminMocks.inviteUserByEmail).toHaveBeenCalledTimes(1);
  });

  it('26. correct email is passed', async () => {
    await invite({ email: 'Someone@Test.dev' });
    expect(authAdminMocks.inviteUserByEmail).toHaveBeenCalledWith('someone@test.dev', expect.any(Object));
  });

  it('27. correct redirect URL is passed', async () => {
    await invite();
    expect(authAdminMocks.inviteUserByEmail).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ redirectTo: `${env.WEB_APP_URL}/accept-invite` })
    );
  });

  it('28-29. profile is provisioned (provisioned=true, isActive=true) after invitation', async () => {
    const res = await invite();
    expect(res.status).toBe(201);
    expect(res.body.user.provisioned).toBe(true);
    expect(res.body.user.isActive).toBe(true);

    const fetched = await request(app).get(`/api/v1/users/${res.body.user.id}`).set(authed(profiles.admin.id));
    expect(fetched.status).toBe(200);
    expect(fetched.body.user.provisioned).toBe(true);
    expect(fetched.body.user.isActive).toBe(true);
  });

  it('30. correct role is stored', async () => {
    const res = await invite({ role: 'view_only' });
    expect(res.body.user.role).toBe('view_only');
  });

  it('31. correct client is stored', async () => {
    const res = await invite({ clientId: clients.clientA.id });
    expect(res.body.user.clientId).toBe(clients.clientA.id);
    expect(res.body.user.client).toMatchObject({ id: clients.clientA.id });
  });

  it('supports inviting an admin (no client)', async () => {
    const res = await invite({ email: 'newadmin@test.dev', role: 'admin', clientId: undefined });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe('admin');
    expect(res.body.user.clientId).toBeNull();
  });
});

describe('User management — update', () => {
  it('32. full name can be updated', async () => {
    const res = await request(app)
      .patch(`/api/v1/users/${profiles.viewOnlyA.id}`)
      .set(authed(profiles.admin.id))
      .send({ fullName: 'Renamed' });
    expect(res.status).toBe(200);
    expect(res.body.user.fullName).toBe('Renamed');
  });

  it('33. role can be updated', async () => {
    const res = await request(app)
      .patch(`/api/v1/users/${profiles.viewOnlyA.id}`)
      .set(authed(profiles.admin.id))
      .send({ role: 'upload_notes' });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('upload_notes');
  });

  it('34. client can be updated', async () => {
    const res = await request(app)
      .patch(`/api/v1/users/${profiles.viewOnlyA.id}`)
      .set(authed(profiles.admin.id))
      .send({ clientId: clients.clientC.id });
    expect(res.status).toBe(200);
    expect(res.body.user.clientId).toBe(clients.clientC.id);
  });

  it('35. empty PATCH rejected', async () => {
    const res = await request(app).patch(`/api/v1/users/${profiles.viewOnlyA.id}`).set(authed(profiles.admin.id)).send({});
    expect(res.status).toBe(400);
  });

  it('36. invalid UUID rejected', async () => {
    const res = await request(app).patch('/api/v1/users/not-a-uuid').set(authed(profiles.admin.id)).send({ fullName: 'X' });
    expect(res.status).toBe(400);
  });

  it('37. email cannot be changed', async () => {
    const res = await request(app)
      .patch(`/api/v1/users/${profiles.viewOnlyA.id}`)
      .set(authed(profiles.admin.id))
      .send({ email: 'hacked@test.dev', fullName: 'Still Renamed' });
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(profiles.viewOnlyA.email);
    expect(res.body.user.fullName).toBe('Still Renamed');
  });

  it('38. isActive cannot be changed through update', async () => {
    const res = await request(app)
      .patch(`/api/v1/users/${profiles.viewOnlyA.id}`)
      .set(authed(profiles.admin.id))
      .send({ isActive: false, fullName: 'Still Active' });
    expect(res.status).toBe(200);
    expect(res.body.user.isActive).toBe(true);
  });

  it('39. provisioned cannot be changed through update', async () => {
    const res = await request(app)
      .patch(`/api/v1/users/${profiles.viewOnlyA.id}`)
      .set(authed(profiles.admin.id))
      .send({ provisioned: false, fullName: 'Still Provisioned' });
    expect(res.status).toBe(200);
    expect(res.body.user.provisioned).toBe(true);
  });

  it('40. admin cannot have a client — explicit combination rejected, and promoting to admin implicitly clears an existing client', async () => {
    const explicit = await request(app)
      .patch(`/api/v1/users/${profiles.viewOnlyA.id}`)
      .set(authed(profiles.admin.id))
      .send({ role: 'admin', clientId: clients.clientA.id });
    expect(explicit.status).toBe(400);

    const implicit = await request(app)
      .patch(`/api/v1/users/${profiles.viewOnlyA.id}`)
      .set(authed(profiles.admin.id))
      .send({ role: 'admin' });
    expect(implicit.status).toBe(200);
    expect(implicit.body.user.clientId).toBeNull();
  });

  it('41. non-admin cannot have null client', async () => {
    const explicitNull = await request(app)
      .patch(`/api/v1/users/${profiles.adminNoClient.id}`)
      .set(authed(profiles.admin.id))
      .send({ role: 'view_only', clientId: null });
    expect(explicitNull.status).toBe(400);

    const implicitMissing = await request(app)
      .patch(`/api/v1/users/${profiles.adminNoClient.id}`)
      .set(authed(profiles.admin.id))
      .send({ role: 'view_only' });
    expect(implicitMissing.status).toBe(400);
  });
});

describe('User management — activation', () => {
  it('42. activate sets profiles.is_active = true', async () => {
    const res = await request(app).patch(`/api/v1/users/${profiles.inactiveProfile.id}/activate`).set(authed(profiles.admin.id));
    expect(res.status).toBe(200);
    expect(res.body.user.isActive).toBe(true);
  });

  it('43. activate removes the Auth ban', async () => {
    await request(app).patch(`/api/v1/users/${profiles.inactiveProfile.id}/activate`).set(authed(profiles.admin.id));
    expect(authAdminMocks.updateUserById).toHaveBeenCalledWith(profiles.inactiveProfile.id, { ban_duration: 'none' });
  });

  it('44. activate is idempotent', async () => {
    const first = await request(app).patch(`/api/v1/users/${profiles.viewOnlyA.id}/activate`).set(authed(profiles.admin.id));
    const second = await request(app).patch(`/api/v1/users/${profiles.viewOnlyA.id}/activate`).set(authed(profiles.admin.id));
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body.user.isActive).toBe(true);
  });
});

describe('User management — deactivation', () => {
  it('45. deactivate sets profiles.is_active = false', async () => {
    const res = await request(app).patch(`/api/v1/users/${profiles.viewOnlyA.id}/deactivate`).set(authed(profiles.admin.id));
    expect(res.status).toBe(200);
    expect(res.body.user.isActive).toBe(false);
  });

  it('46. deactivate bans the Auth account', async () => {
    await request(app).patch(`/api/v1/users/${profiles.viewOnlyA.id}/deactivate`).set(authed(profiles.admin.id));
    expect(authAdminMocks.updateUserById).toHaveBeenCalledWith(profiles.viewOnlyA.id, { ban_duration: '876000h' });
  });

  it('47. deactivate is idempotent', async () => {
    const first = await request(app).patch(`/api/v1/users/${profiles.inactiveProfile.id}/deactivate`).set(authed(profiles.admin.id));
    const second = await request(app).patch(`/api/v1/users/${profiles.inactiveProfile.id}/deactivate`).set(authed(profiles.admin.id));
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body.user.isActive).toBe(false);
  });

  it('48. deactivation does not delete profile data', async () => {
    await request(app).patch(`/api/v1/users/${profiles.viewOnlyA.id}/deactivate`).set(authed(profiles.admin.id));
    const res = await request(app).get(`/api/v1/users/${profiles.viewOnlyA.id}`).set(authed(profiles.admin.id));
    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(profiles.viewOnlyA.id);
  });

  it('49. deactivation does not delete project/inspection data', async () => {
    await request(app).patch(`/api/v1/users/${profiles.viewOnlyA.id}/deactivate`).set(authed(profiles.admin.id));
    const res = await request(app).get(`/api/v1/projects/${projects[0].id}`).set(authed(profiles.admin.id));
    expect(res.status).toBe(200);
    expect(res.body.project.clientId).toBe(clients.clientA.id);
  });
});

describe('User management — error/partial failure handling', () => {
  it('50. Auth invite failure does not report success', async () => {
    authAdminMocks.inviteUserByEmail.mockReset();
    authAdminMocks.inviteUserByEmail.mockResolvedValueOnce({ data: { user: null }, error: { message: 'Auth is down' } });

    const res = await invite({ email: 'failure@test.dev' });
    expect(res.status).toBe(502);

    // Not left behind as a phantom duplicate — a retry should be able to
    // proceed (proves no profile row was created for the failed attempt).
    authAdminMocks.inviteUserByEmail.mockImplementation(async (email: string) => {
      const { db } = await import('./mockSupabaseAdmin');
      const id = '00000000-0000-4000-8000-0000000000ff';
      db.profiles = [
        ...(db.profiles ?? []),
        { id, email, full_name: null, role: 'view_only', client_id: null, provisioned: false, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      ];
      return { data: { user: { id, email } }, error: null };
    });
    const retry = await invite({ email: 'failure@test.dev' });
    expect(retry.status).toBe(201);
  });

  it('51. profile provisioning failure does not report success', async () => {
    // Simulates the trigger not firing / row not found immediately after invite.
    authAdminMocks.inviteUserByEmail.mockReset();
    authAdminMocks.inviteUserByEmail.mockResolvedValueOnce({
      data: { user: { id: '00000000-0000-4000-8000-0000000000aa', email: 'nobody@test.dev' } },
      error: null,
    });

    const res = await invite({ email: 'nobody@test.dev' });
    expect(res.status).toBe(500);
    expect(res.body.user).toBeUndefined();
  });

  it('52. Auth deactivate failure is handled safely — DB state still updates, no crash', async () => {
    authAdminMocks.updateUserById.mockReset();
    authAdminMocks.updateUserById.mockResolvedValueOnce({ data: { user: null }, error: { message: 'Auth is down' } });

    const res = await request(app).patch(`/api/v1/users/${profiles.viewOnlyA.id}/deactivate`).set(authed(profiles.admin.id));
    expect(res.status).toBe(200);
    expect(res.body.user.isActive).toBe(false);
  });

  it('53. not-found uses the standard 404 convention consistently across single-user routes', async () => {
    const missingId = '00000000-0000-0000-0000-000000000000';
    const results = await Promise.all([
      request(app).get(`/api/v1/users/${missingId}`).set(authed(profiles.admin.id)),
      request(app).patch(`/api/v1/users/${missingId}`).set(authed(profiles.admin.id)).send({ fullName: 'X' }),
      request(app).patch(`/api/v1/users/${missingId}/activate`).set(authed(profiles.admin.id)),
      request(app).patch(`/api/v1/users/${missingId}/deactivate`).set(authed(profiles.admin.id)),
    ]);
    for (const res of results) expect(res.status).toBe(404);
  });
});
