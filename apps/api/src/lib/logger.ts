/* eslint-disable no-console */
const timestamp = () => new Date().toISOString();

export const logger = {
  info: (message: string, meta?: Record<string, unknown>) =>
    console.log(`[${timestamp()}] INFO  ${message}`, meta ?? ''),
  warn: (message: string, meta?: Record<string, unknown>) =>
    console.warn(`[${timestamp()}] WARN  ${message}`, meta ?? ''),
  error: (message: string, meta?: Record<string, unknown>) =>
    console.error(`[${timestamp()}] ERROR ${message}`, meta ?? ''),
};
