import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/config/supabaseAdmin', async () => {
  const mod = await import('./mockSupabaseAdmin');
  return { supabaseAdmin: mod.supabaseAdmin };
});

// Presigned URL generation and S3 deletes are pure network/SDK calls with
// nothing to verify at this layer (that's AWS's contract, not ours) — mock
// them so these tests stay fast and hermetic, and assert on the S3 *key*
// this app computes instead, which is the part we own.
vi.mock('../src/lib/s3', () => ({
  buildAttachmentKey: (params: { clientId: string; parentKind: string; parentId: string; fileName: string }) =>
    `${params.clientId}/${params.parentKind}/${params.parentId}/mock-${params.fileName}`,
  createUploadUrl: vi.fn().mockResolvedValue('https://s3.mock.example/upload'),
  createDownloadUrl: vi.fn().mockResolvedValue('https://s3.mock.example/download'),
  deleteObject: vi.fn().mockResolvedValue(undefined),
}));

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

const PHOTO_BODY = { fileName: 'front.jpg', contentType: 'image/jpeg', kind: 'photo', category: 'before' };

async function confirmUpload(
  path: string,
  authHeader: Record<string, string>,
  overrides: Partial<typeof PHOTO_BODY> = {}
) {
  const presign = await request(app).post(`${path}/presign`).set(authHeader).send({ ...PHOTO_BODY, ...overrides });
  const confirm = await request(app)
    .post(path)
    .set(authHeader)
    .send({ ...PHOTO_BODY, ...overrides, key: presign.body.key, fileSize: 1024 });
  return { presign, confirm };
}

describe('Project attachments', () => {
  const base = `/api/v1/projects/${projects[0].id}/attachments`;

  it('rejects unauthenticated requests', async () => {
    const res = await request(app).get(base);
    expect(res.status).toBe(401);
  });

  it('lists (empty) for a permitted client role', async () => {
    const res = await request(app).get(base).set(authed(profiles.viewOnlyA.id));
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
  });

  it('blocks listing for another client', async () => {
    const res = await request(app).get(base).set(authed(profiles.viewOnlyC.id));
    expect(res.status).toBe(403);
  });

  it('lets upload_notes presign and confirm an upload', async () => {
    const { presign, confirm } = await confirmUpload(base, authed(profiles.uploadNotesA.id));
    expect(presign.status).toBe(200);
    expect(presign.body.key).toBe(`${clients.clientA.id}/project/${projects[0].id}/mock-front.jpg`);
    expect(presign.body.uploadUrl).toBeTruthy();
    expect(confirm.status).toBe(201);
    expect(confirm.body.attachment).toMatchObject({
      kind: 'photo',
      category: 'before',
      fileName: 'front.jpg',
      parentKind: 'project',
      parentId: projects[0].id,
    });
  });

  it('lets admin presign and confirm an upload', async () => {
    const { confirm } = await confirmUpload(base, authed(profiles.admin.id));
    expect(confirm.status).toBe(201);
  });

  it('blocks view_only from presigning or confirming', async () => {
    const presign = await request(app).post(`${base}/presign`).set(authed(profiles.viewOnlyA.id)).send(PHOTO_BODY);
    expect(presign.status).toBe(403);

    const confirm = await request(app)
      .post(base)
      .set(authed(profiles.viewOnlyA.id))
      .send({ ...PHOTO_BODY, key: 'whatever', fileSize: 1024 });
    expect(confirm.status).toBe(403);
  });

  it('rejects an unsupported content type for the given kind', async () => {
    const res = await request(app)
      .post(`${base}/presign`)
      .set(authed(profiles.admin.id))
      .send({ fileName: 'malware.exe', contentType: 'application/x-msdownload', kind: 'photo' });
    expect(res.status).toBe(400);
  });

  it('rejects a confirm whose key does not belong to this client/parent prefix', async () => {
    const res = await request(app)
      .post(base)
      .set(authed(profiles.admin.id))
      .send({
        ...PHOTO_BODY,
        key: `${clients.clientB.id}/project/${projects[0].id}/mock-front.jpg`,
        fileSize: 1024,
      });
    expect(res.status).toBe(400);
  });

  it('returns a download URL for a permitted user and blocks another client', async () => {
    const { confirm } = await confirmUpload(base, authed(profiles.admin.id));
    const attachmentId = confirm.body.attachment.id;

    const ok = await request(app).get(`${base}/${attachmentId}/download`).set(authed(profiles.viewOnlyA.id));
    expect(ok.status).toBe(200);
    expect(ok.body.url).toBeTruthy();

    const blocked = await request(app).get(`${base}/${attachmentId}/download`).set(authed(profiles.viewOnlyC.id));
    expect(blocked.status).toBe(403);
  });

  it('lets upload_notes delete their own upload but not someone else\'s', async () => {
    const own = await confirmUpload(base, authed(profiles.uploadNotesA.id));
    const ownId = own.confirm.body.attachment.id;

    const others = await confirmUpload(base, authed(profiles.admin.id));
    const othersId = others.confirm.body.attachment.id;

    const deleteOthers = await request(app).delete(`${base}/${othersId}`).set(authed(profiles.uploadNotesA.id));
    expect(deleteOthers.status).toBe(403);

    const deleteOwn = await request(app).delete(`${base}/${ownId}`).set(authed(profiles.uploadNotesA.id));
    expect(deleteOwn.status).toBe(204);
  });

  it('lets admin delete any attachment', async () => {
    const { confirm } = await confirmUpload(base, authed(profiles.uploadNotesA.id));
    const res = await request(app).delete(`${base}/${confirm.body.attachment.id}`).set(authed(profiles.admin.id));
    expect(res.status).toBe(204);
  });

  it('blocks view_only from deleting', async () => {
    const { confirm } = await confirmUpload(base, authed(profiles.admin.id));
    const res = await request(app).delete(`${base}/${confirm.body.attachment.id}`).set(authed(profiles.viewOnlyA.id));
    expect(res.status).toBe(403);
  });

  it('replaces an attachment (admin), keeping the same id', async () => {
    const { confirm } = await confirmUpload(base, authed(profiles.admin.id));
    const attachmentId = confirm.body.attachment.id;

    const presign = await request(app)
      .post(`${base}/presign`)
      .set(authed(profiles.admin.id))
      .send({ fileName: 'front-v2.jpg', contentType: 'image/jpeg', kind: 'photo' });

    const replace = await request(app)
      .patch(`${base}/${attachmentId}/replace`)
      .set(authed(profiles.admin.id))
      .send({ key: presign.body.key, fileName: 'front-v2.jpg', contentType: 'image/jpeg', fileSize: 2048 });

    expect(replace.status).toBe(200);
    expect(replace.body.attachment.id).toBe(attachmentId);
    expect(replace.body.attachment.fileName).toBe('front-v2.jpg');
  });

  it('blocks upload_notes from replacing an attachment they did not upload', async () => {
    const { confirm } = await confirmUpload(base, authed(profiles.admin.id));
    const res = await request(app)
      .patch(`${base}/${confirm.body.attachment.id}/replace`)
      .set(authed(profiles.uploadNotesA.id))
      .send({ key: 'irrelevant', fileName: 'x.jpg', contentType: 'image/jpeg', fileSize: 10 });
    expect(res.status).toBe(403);
  });
});

describe('Inspection attachments', () => {
  const base = `/api/v1/inspections/${inspections[0].id}/attachments`;
  const DOC_BODY = { fileName: 'report.pdf', contentType: 'application/pdf', kind: 'document' };

  it('lists (empty) for a permitted client role', async () => {
    const res = await request(app).get(base).set(authed(profiles.viewOnlyA.id));
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
  });

  it('blocks a caller from another client', async () => {
    const res = await request(app).get(base).set(authed(profiles.viewOnlyC.id));
    expect(res.status).toBe(403);
  });

  it('lets admin upload a document and lists it back', async () => {
    const { confirm } = await confirmUpload(base, authed(profiles.admin.id), DOC_BODY);
    expect(confirm.status).toBe(201);
    expect(confirm.body.attachment).toMatchObject({ kind: 'document', parentKind: 'inspection' });

    const list = await request(app).get(base).set(authed(profiles.viewOnlyA.id));
    expect(list.body.items).toHaveLength(1);
  });

  it('blocks view_only from uploading', async () => {
    const res = await request(app).post(`${base}/presign`).set(authed(profiles.viewOnlyA.id)).send(DOC_BODY);
    expect(res.status).toBe(403);
  });
});
