import type { NextFunction, Request, Response } from 'express';
import { ApiError } from '../lib/ApiError';
import { logger } from '../lib/logger';

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: { code: 'not_found', message: `No route: ${req.method} ${req.path}` } });
}

// Express recognizes this as an error handler by its 4-argument signature —
// keep all four params even though `next` is unused.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction) {
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({ error: { code: err.code, message: err.message } });
    return;
  }

  logger.error('Unhandled error', { path: req.path, err });
  res.status(500).json({ error: { code: 'internal_error', message: 'Something went wrong' } });
}
