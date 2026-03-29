import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { adminAuth } from '../middleware/adminAuth';
import { prisma } from '../config/prisma';
import { normalizeFingerprint } from '../services/hwid';
import { startOrResumeTrial, trialHeartbeat, TRIAL_SEND_LIMIT } from '../services/trial';
import { APP_SLUG } from '../config/env';

const router = Router();

const FpSchema = z.object({
  fingerprint: z.string().min(8),
  productSlug: z.string().optional(),
});

// ─── POST /api/v1/trials/start ────────────────────────────────────────────────
// Inicia ou retoma trial para o fingerprint. Idempotente.

router.post('/start', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { fingerprint: rawFp, productSlug } = FpSchema.parse(req.body);
    const fp = normalizeFingerprint(rawFp);
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] ?? req.ip;

    const result = await startOrResumeTrial(
      fp.combined,
      productSlug ?? APP_SLUG,
      ip
    );

    if (!result.allowed) {
      return res.status(403).json({
        success: false,
        error: result.reason === 'TRIAL_EXHAUSTED'
          ? 'Limite de envios do trial atingido.'
          : 'Período de trial expirado.',
        code: result.reason,
        data: { trial: result.trial },
      });
    }

    res.json({
      success: true,
      data: {
        payload: result.payload,
        signature: result.signature,
        trial: result.trial,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/v1/trials/heartbeat ───────────────────────────────────────────
// Incrementa sends e retorna token atualizado.

router.post('/heartbeat', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { fingerprint: rawFp, sends } = z.object({
      fingerprint: z.string().min(8),
      sends: z.number().int().min(0).default(0),
    }).parse(req.body);

    const fp = normalizeFingerprint(rawFp);
    const result = await trialHeartbeat(fp.combined, sends);

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/v1/trials  (admin) ─────────────────────────────────────────────

router.get('/', adminAuth, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const trials = await prisma.trial.findMany({ orderBy: { startedAt: 'desc' } });
    res.json({
      success: true,
      data: trials.map((t) => ({
        id: t.id,
        fingerprint: t.fingerprint,
        productSlug: t.productSlug,
        startedAt: t.startedAt,
        expiresAt: t.expiresAt,
        sends: t.sends,
        sendsLeft: Math.max(0, TRIAL_SEND_LIMIT - t.sends),
        exhausted: t.exhausted,
        expired: t.expiresAt < new Date(),
        ip: t.ip,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/v1/trials/:id  (admin) ──────────────────────────────────────

router.delete('/:id', adminAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    await prisma.trial.delete({ where: { id } });
    res.json({ success: true, data: { message: 'Trial deleted' } });
  } catch (err) {
    next(err);
  }
});

export default router;
