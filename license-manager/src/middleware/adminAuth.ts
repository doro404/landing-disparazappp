import { Request, Response, NextFunction } from 'express';
import { createHash, timingSafeEqual } from 'crypto';
import { env } from '../config/env';

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function safeCompare(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

export function adminAuth(req: Request, res: Response, next: NextFunction) {
  const key = req.headers['x-api-key'];

  if (!key || typeof key !== 'string') {
    res.status(401).json({ success: false, error: 'Unauthorized', code: 'INVALID_API_KEY' });
    return;
  }

  const stored = env.ADMIN_API_KEY;
  let valid = false;

  if (stored.startsWith('sha256:')) {
    // Compare hash of incoming key against stored hash
    const expectedHash = stored.slice(7);
    valid = safeCompare(sha256(key), expectedHash);
  } else {
    // Plain comparison (legacy)
    valid = safeCompare(key, stored);
  }

  if (!valid) {
    res.status(401).json({ success: false, error: 'Unauthorized', code: 'INVALID_API_KEY' });
    return;
  }

  next();
}
