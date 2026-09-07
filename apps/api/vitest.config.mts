import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    env: {
      NODE_ENV: 'test',
      PORT: '4000',
      CORS_ALLOWED_ORIGINS: 'http://localhost:5173',
      SUPABASE_URL: 'http://localhost:54321',
      SUPABASE_SERVICE_ROLE_KEY: 'test-secret-key',
      SUPABASE_JWT_SECRET: 'test-jwt-secret',
      WEB_APP_URL: 'http://localhost:5173',
      AWS_REGION: 'us-east-1',
      AWS_ACCESS_KEY_ID: 'test-access-key',
      AWS_SECRET_ACCESS_KEY: 'test-secret-access-key',
      AWS_S3_BUCKET: 'test-bucket',
      S3_PRESIGN_EXPIRY_SECONDS: '300',
    },
  },
});
