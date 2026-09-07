import jwt from 'jsonwebtoken';
import { vi } from 'vitest';

// Production code (middleware/auth.ts) verifies real Supabase access tokens
// against the project's live JWKS endpoint (ES256). Tests have no live
// Supabase project to fetch that from, and every *.rbac.test.ts file already
// mints its bearer tokens with jwt.sign(..., SUPABASE_JWT_SECRET) (HS256) —
// so this mock keeps that existing test convention working by verifying the
// same way, instead of requiring every test file to generate real EC-signed
// tokens and mock a JWKS HTTP endpoint just to exercise unrelated RBAC logic.
vi.mock('jose', () => ({
  createRemoteJWKSet: () => undefined,
  jwtVerify: async (token: string) => ({
    payload: jwt.verify(token, process.env.SUPABASE_JWT_SECRET as string),
  }),
}));
