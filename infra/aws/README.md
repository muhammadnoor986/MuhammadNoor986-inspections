# AWS S3 storage architecture

File storage (photos, reports/documents) lives in AWS S3, not Supabase
Storage. Postgres (`attachments` table, see
`supabase/migrations/0001_init.sql`) stores only the **metadata**: the S3
object key, file name, kind (photo/document), parent (project/inspection),
and uploader. This document describes the infrastructure side; the
application side is implemented in `apps/api/src/lib/s3.ts`.

## Trust boundary

```
React (web)  ──┐
                 ├──►  Node.js API  ──► AWS S3
React Native ──┘        (holds AWS credentials)
```

- Only `apps/api` ever holds `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`.
- Web and mobile clients never receive AWS credentials, and never talk to S3
  directly except by using a short-lived presigned URL that the API handed
  them.
- The S3 bucket is **not public**. All access is either through the API
  (metadata) or a presigned URL scoped to one object for a few minutes.

## Upload / download flow

1. Client asks the API for permission to upload: `POST /api/v1/attachments/presign`
   with `{ parentKind, parentId, fileName, contentType }`.
2. API: verifies the JWT, checks RBAC (`upload_notes` or `admin`, module
   access, resource belongs to the caller's client), then builds the S3 key
   and calls `createUploadUrl()` (`apps/api/src/lib/s3.ts`) to get a
   presigned `PUT` URL, valid for `S3_PRESIGN_EXPIRY_SECONDS` (default 300s).
3. Client uploads the file bytes directly to S3 using that URL — the bytes
   never pass through the API.
4. Client confirms the upload by calling `POST /api/v1/attachments` with the
   returned key + file metadata; the API re-checks RBAC and inserts the
   `attachments` row.
5. Downloads work the same way in reverse: the API checks RBAC, then returns
   a short-lived presigned `GET` URL via `createDownloadUrl()`.

(The `/attachments` routes themselves are not implemented yet — this
document and `lib/s3.ts` are the foundation; the routes land alongside the
Attachments milestone.)

## S3 key structure

```
{client_id}/{parent_kind}/{parent_id}/{timestamp}-{filename}
```

Example: `client-123/inspection/inspection-456/1730563200000-photo-001.jpg`

- `parent_kind` is `project` or `inspection`.
- The `{timestamp}-` prefix on the filename prevents overwrites when two
  uploads share a name; the client/parent path segments are what's actually
  used for access scoping and match the shape the client asked for.
- Implemented in `buildAttachmentKey()` in `apps/api/src/lib/s3.ts`.

This path convention is also what makes IAM/bucket-policy scoping possible
later (e.g. a bucket policy could restrict a given prefix), though for now
authorization happens entirely in the Node API, not in S3/IAM itself.

## Required environment variables (`apps/api/.env`, never committed)

| Variable | Purpose |
|---|---|
| `AWS_REGION` | e.g. `us-east-1` |
| `AWS_ACCESS_KEY_ID` | IAM user/role access key — server-only |
| `AWS_SECRET_ACCESS_KEY` | IAM user/role secret key — server-only |
| `AWS_S3_BUCKET` | Target bucket name |
| `S3_PRESIGN_EXPIRY_SECONDS` | How long presigned URLs stay valid (default `300`) |

No AWS bucket or credentials are provisioned or required to run the current
foundation — these are documented for when a real AWS account is wired up.

## IAM policy (least privilege for the API's IAM user/role)

See [`iam-policy.json`](./iam-policy.json). It grants only `PutObject`,
`GetObject`, and `DeleteObject` on the specific bucket, and does **not**
grant `ListBucket`, `PutBucketPolicy`, or any other bucket/account-level
permission. The Node API never needs to enumerate the bucket — every key it
needs is already known from Postgres.

## Bucket configuration (for whoever provisions the real bucket)

See [`bucket-policy.json`](./bucket-policy.json) — denies any non-TLS
request. In addition to that bucket policy, the bucket should be created
with:
- **Block Public Access**: all four settings ON (bucket must never be public;
  every read goes through a presigned URL or the API).
- **Default encryption**: SSE-S3 or SSE-KMS enabled.
- **Versioning**: recommended, to protect against accidental overwrite given
  the app-level key convention.

## Migrating off the legacy AWS access-key model (future hardening)

Long-lived `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` pairs are the simplest
option and fine for this stage, but the more durable setup once the API is
deployed (e.g. to ECS/EC2/Lambda) is to attach an IAM **role** to the compute
resource and drop the static keys entirely, since the AWS SDK picks up role
credentials automatically. Worth revisiting at deployment time — not a
blocker now.
