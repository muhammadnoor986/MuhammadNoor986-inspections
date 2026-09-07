import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../config/env';

export type ParentKind = 'project' | 'inspection';

const s3Client = new S3Client({
  region: env.AWS_REGION,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  },
});

function sanitizeFileName(fileName: string): string {
  return fileName.trim().replace(/[^a-zA-Z0-9._-]/g, '_');
}

/**
 * Builds the S3 object key for an attachment.
 * Shape: {client_id}/{parent_kind}/{parent_id}/{timestamp}-{filename}
 * The timestamp prefix avoids collisions when two uploads share a file name,
 * while keeping the client/parent structure required for access scoping.
 */
export function buildAttachmentKey(params: {
  clientId: string;
  parentKind: ParentKind;
  parentId: string;
  fileName: string;
}): string {
  const { clientId, parentKind, parentId, fileName } = params;
  const safeName = sanitizeFileName(fileName);
  return `${clientId}/${parentKind}/${parentId}/${Date.now()}-${safeName}`;
}

export async function createUploadUrl(key: string, contentType: string): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: env.AWS_S3_BUCKET,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(s3Client, command, { expiresIn: env.S3_PRESIGN_EXPIRY_SECONDS });
}

export async function createDownloadUrl(key: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: env.AWS_S3_BUCKET,
    Key: key,
  });
  return getSignedUrl(s3Client, command, { expiresIn: env.S3_PRESIGN_EXPIRY_SECONDS });
}

/** Best-effort delete — callers should not fail the whole request if this throws after the DB row is already gone; see attachments.service.ts. */
export async function deleteObject(key: string): Promise<void> {
  await s3Client.send(new DeleteObjectCommand({ Bucket: env.AWS_S3_BUCKET, Key: key }));
}
