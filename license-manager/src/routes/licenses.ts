import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { adminAuth } from '../middleware/adminAuth';
import { prisma } from '../config/prisma';
import {
  createLicense,
  activateLicense,
  validateLicense,
  revokeLicense,
  heartbeatLicense,
} from '../services/license';
import { normalizeFingerprint } from '../services/hwid';
import { verifyPayload } from '../services/crypto';

const router = Router();

// ─── Schemas ──────────────────────────────────────────────────────────────────

const CreateSchema = z.object({
  productSlug: z.string().min(1),
  maxMachines: z.number().int().positive().optional(),
  expiresAt: z.string().datetime({ offset: true }).optional(),
  expiresInDays: z.number().int().positive().optional(),
  entitlements: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
  customerEmail: z.string().email().optional(),
  customerName: z.string().optional(),
  orderId: z.string().optional(),
  notes: z.string().optional(),
});

const ActivateSchema = z.object({
  key: z.string().min(1),
  fingerprint: z.union([
    z.string().min(1),
    z.object({
      combined: z.string().min(1),
      stable: z.string().optional(),
      volatile: z.string().optional(),
    }),
  ]),
});

const ValidateSchema = z.object({
  key: z.string().min(1),
  fingerprint: z.string().optional(),
  stableFp: z.string().optional(),
  volatileFp: z.string().optional(),
});

const RevokeSchema = z.object({
  key: z.string().min(1),
});

// ─── GET /api/v1/licenses  (admin) ───────────────────────────────────────────

router.get('/', adminAuth, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const licenses = await prisma.license.findMany({
      include: { product: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json({
      success: true,
      data: licenses.map((l) => ({
        id: l.id,
        key: l.key,
        productSlug: l.product.slug,
        maxMachines: l.maxMachines,
        status: l.revoked ? "revoked" : l.expiresAt && new Date(l.expiresAt) < new Date() ? "inactive" : "active",
        entitlements: l.entitlements ? JSON.parse(l.entitlements) : [],
        expiresAt: l.expiresAt ?? null,
        customerEmail: l.customerEmail ?? null,
        customerName: l.customerName ?? null,
        orderId: l.orderId ?? null,
        notes: l.notes ?? null,
        createdAt: l.createdAt,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/v1/licenses  (admin) ──────────────────────────────────────────

router.post('/', adminAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = CreateSchema.parse(req.body);
    // Converte expiresInDays → expiresAt se necessário
    if (!input.expiresAt && input.expiresInDays) {
      input.expiresAt = new Date(Date.now() + input.expiresInDays * 86_400_000).toISOString();
    }
    const license = await createLicense(input);
    res.status(201).json({
      success: true,
      data: {
        id: license.id,
        key: license.key,
        product: license.product.slug,
        maxMachines: license.maxMachines,
        expiresAt: license.expiresAt,
        entitlements: license.entitlements ? JSON.parse(license.entitlements) : [],
        metadata: license.metadata ? JSON.parse(license.metadata) : {},
        customerEmail: license.customerEmail ?? null,
        customerName: license.customerName ?? null,
        orderId: license.orderId ?? null,
        notes: license.notes ?? null,
        createdAt: license.createdAt,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/v1/licenses/activate ──────────────────────────────────────────

router.post('/activate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { key, fingerprint: rawFingerprint } = ActivateSchema.parse(req.body);
    const fp = normalizeFingerprint(rawFingerprint);
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] ?? req.ip;

    const { payload, signature } = await activateLicense(key, fp, ip);

    res.json({
      success: true,
      data: {
        payload,
        signature,
        // Convenience: tell the client how to verify offline
        verificationNote:
          'Verify: ed25519.verify(signature, JSON.stringify(payload), PUBLIC_KEY)',
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/v1/licenses/validate ───────────────────────────────────────────

router.get('/validate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { key, fingerprint: rawFp, stableFp, volatileFp } = ValidateSchema.parse(req.query);
    const fp = rawFp
      ? normalizeFingerprint({ combined: rawFp, stable: stableFp, volatile: volatileFp })
      : undefined;
    const result = await validateLicense(key, fp);

    res.status(result.valid ? 200 : 403).json({ success: result.valid, data: result });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/v1/licenses/revoke  (admin) ───────────────────────────────────

router.post('/revoke', adminAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { key } = RevokeSchema.parse(req.body);
    await revokeLicense(key);
    res.json({ success: true, data: { message: 'License revoked' } });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/v1/licenses/heartbeat ─────────────────────────────────────────

router.post('/heartbeat', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { key, fingerprint: rawFp } = ActivateSchema.parse(req.body);
    const fp = normalizeFingerprint(rawFp);
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0] ?? req.ip;
    const result = await heartbeatLicense(key, fp, ip);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

// ─── POST /api/v1/licenses/verify-token  (client offline helper) ─────────────
// Verifies a previously issued {payload, signature} pair server-side.

router.post('/verify-token', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { payload, signature } = z
      .object({ payload: z.record(z.unknown()), signature: z.string() })
      .parse(req.body);

    const valid = verifyPayload(payload, signature);
    res.json({ success: true, data: { valid } });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/v1/licenses/:id  (admin) ────────────────────────────────────

router.delete('/:id', adminAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const licenseId = Array.isArray(id) ? id[0] : id;

    // Delete activations first (FK constraint)
    await prisma.activation.deleteMany({ where: { licenseId } });
    await prisma.license.delete({ where: { id: licenseId } });

    res.json({ success: true, data: { message: 'License deleted' } });
  } catch (err) {
    next(err);
  }
});

export default router;
