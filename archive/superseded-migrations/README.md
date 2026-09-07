# Superseded migrations

`0002_storage.sql.superseded` provisioned a **Supabase Storage** bucket and
its RLS policies. The client requires **AWS S3** for file storage instead,
so this file is no longer part of the active migration set — it is kept
here for reference only and is never applied.

The replacement design lives in [`infra/aws/`](../../infra/aws/) — S3 isn't
provisioned through a Supabase SQL migration at all, since bucket/IAM setup
happens in AWS, not Postgres. Only file **metadata** (S3 object keys, file
names, uploader) stays in Postgres, in the `attachments` table defined in
`supabase/migrations/0001_init.sql`.
