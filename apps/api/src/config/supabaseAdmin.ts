import { createClient } from '@supabase/supabase-js';
import { env } from './env';

// Server-only client using the Supabase secret key (the elevated credential
// formerly labeled "service_role key" in the dashboard — same RLS-bypassing
// key, new name; accepts either the legacy JWT-format key or the newer
// sb_secret_... format). This bypasses Postgres RLS, which is why every
// query made with it MUST be preceded by explicit RBAC checks in
// middleware/route handlers (see middleware/auth.ts, middleware/rbac.ts).
// This client must never be constructed in, or its key exposed to, web/mobile code.
export const supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});
