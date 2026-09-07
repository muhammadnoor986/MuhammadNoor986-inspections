import { createClient } from '@supabase/supabase-js';
import { env } from '../utils/env';

// Browser client, built with the public anon key only. It performs login /
// logout / session refresh directly against Supabase Auth; it never talks
// to Postgres for application data — that always goes through the Node API
// (see services/apiClient.ts), which enforces RBAC server-side.
export const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
