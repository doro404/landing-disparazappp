import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { LicenseError } from '../services/license';

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: 'Validation error',
      code: 'VALIDATION_ERROR',
      details: err.flatten().fieldErrors,
    });
    return;
  }

  if (err instanceof LicenseError) {
    const statusMap: Record<string, number> = {
      LICENSE_NOT_FOUND: 404,
      LICENSE_REVOKED: 403,
      LICENSE_EXPIRED: 403,
      MAX_MACHINES_REACHED: 403,
      MACHINE_NOT_ACTIVATED: 403,
    };
    res.status(statusMap[err.code] ?? 400).json({
      success: false,
      error: err.message,
      code: err.code,
    });
    return;
  }

  console.error(err);
  res.status(500).json({ success: false, error: 'Internal server error' });
}
