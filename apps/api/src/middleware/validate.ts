import type { NextFunction, Request, Response } from 'express';
import type { ZodTypeAny } from 'zod';
import { ApiError } from '../lib/ApiError';

type Source = 'body' | 'params' | 'query';

/** Validates and replaces req[source] with the parsed (and coerced) data. */
export function validate(source: Source, schema: ZodTypeAny) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      return next(
        ApiError.badRequest(
          result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')
        )
      );
    }
    req[source] = result.data;
    next();
  };
}
