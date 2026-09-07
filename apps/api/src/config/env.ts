import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  CORS_ALLOWED_ORIGINS: z
    .string()
    .default('')
    .transform((value) => value.split(',').map((origin) => origin.trim()).filter(Boolean)),

  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_JWT_SECRET: z.string().min(1),

  // The web app's own base URL — never a secret, but not hard-coded either,
  // since it differs per environment. Used to build the redirectTo for
  // Supabase invite emails (see services/users.service.ts); the invited
  // user lands there to set their password. Must also be added to the
  // Supabase project's Auth > URL Configuration > Redirect URLs allowlist,
  // which is dashboard config, not something this app can set.
  WEB_APP_URL: z.string().url(),

  AWS_REGION: z.string().min(1),
  AWS_ACCESS_KEY_ID: z.string().min(1),
  AWS_SECRET_ACCESS_KEY: z.string().min(1),
  AWS_S3_BUCKET: z.string().min(1),
  S3_PRESIGN_EXPIRY_SECONDS: z.coerce.number().default(300),
});

// Fail fast on boot rather than surfacing confusing errors deep in a request.
const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment configuration:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
