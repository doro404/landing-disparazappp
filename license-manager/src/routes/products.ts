import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { adminAuth } from '../middleware/adminAuth';
import { prisma } from '../config/prisma';

const router = Router();

const CreateProductSchema = z.object({
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/, 'slug must be lowercase alphanumeric with dashes'),
  name: z.string().min(1),
  defaultMaxMachines: z.number().int().positive().default(1),
  defaultTrialDays: z.number().int().positive().optional(),
  features: z.array(z.string()).optional(),
});

// POST /api/v1/products  (admin)
router.post('/', adminAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = CreateProductSchema.parse(req.body);
    const product = await prisma.product.create({
      data: {
        ...input,
        features: input.features ? JSON.stringify(input.features) : null,
      },
    });
    res.status(201).json({
      success: true,
      data: {
        ...product,
        features: product.features ? JSON.parse(product.features) : [],
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/products  (admin)
router.get('/', adminAuth, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const products = await prisma.product.findMany({ orderBy: { createdAt: 'desc' } });
    res.json({
      success: true,
      data: products.map(p => ({
        ...p,
        features: p.features ? JSON.parse(p.features) : [],
      })),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
