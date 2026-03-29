import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { adminAuth } from '../middleware/adminAuth';
import { prisma } from '../config/prisma';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();

// ─── Upload dir ───────────────────────────────────────────────────────────────
const UPLOADS_DIR = process.env.UPLOADS_DIR
  || path.join(process.cwd(), 'uploads');

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    // dispara-zapp-1.2.0-setup.exe
    const ext = path.extname(file.originalname) || '.exe';
    const name = `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    cb(null, name);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['.exe', '.msi', '.dmg', '.AppImage', '.deb', '.rpm', '.zip'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Tipo de arquivo não permitido'));
  },
});

// ─── POST /api/v1/updates/upload  (admin, multipart) ─────────────────────────
// Fields: file (binary), product, version, changelog, force
router.post(
  '/upload',
  adminAuth,
  upload.single('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        res.status(400).json({ success: false, error: 'Arquivo não enviado' });
        return;
      }

      const { product, version, changelog = '', force = 'false' } = req.body as Record<string, string>;

      if (!product || !version) {
        fs.unlinkSync(req.file.path);
        res.status(400).json({ success: false, error: 'product e version são obrigatórios' });
        return;
      }

      // Verifica produto
      const prod = await prisma.product.findUnique({ where: { slug: product } });
      if (!prod) {
        fs.unlinkSync(req.file.path);
        res.status(404).json({ success: false, error: 'Produto não encontrado' });
        return;
      }

      // Remove versão anterior do mesmo produto+versão se existir
      const existing = await prisma.appUpdate.findUnique({
        where: { productSlug_version: { productSlug: product, version } },
      });
      if (existing) {
        const oldPath = path.join(UPLOADS_DIR, existing.fileName);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
        await prisma.appUpdate.delete({ where: { id: existing.id } });
      }

      const entry = await prisma.appUpdate.create({
        data: {
          productSlug: product,
          version,
          fileName: req.file.filename,
          fileSize: req.file.size,
          changelog,
          force: force === 'true',
        },
      });

      res.status(201).json({ success: true, data: entry });
    } catch (err) {
      next(err);
    }
  }
);

// ─── GET /api/v1/updates/download/:id  (público) ─────────────────────────────
router.get('/download/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const entry = await prisma.appUpdate.findUnique({ where: { id: String(req.params.id) } });
    if (!entry) {
      res.status(404).json({ success: false, error: 'Update não encontrado' });
      return;
    }
    const filePath = path.join(UPLOADS_DIR, entry.fileName);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ success: false, error: 'Arquivo não encontrado no servidor' });
      return;
    }
    res.download(filePath, entry.fileName);
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/v1/updates/list  (admin) ───────────────────────────────────────
router.get('/list', adminAuth, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const updates = await prisma.appUpdate.findMany({
      orderBy: { publishedAt: 'desc' },
    });
    res.json({ success: true, data: updates });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /api/v1/updates/:id  (admin) ─────────────────────────────────────
router.delete('/:id', adminAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const entry = await prisma.appUpdate.findUnique({ where: { id: String(req.params.id) } });
    if (!entry) {
      res.status(404).json({ success: false, error: 'Update não encontrado' });
      return;
    }
    const filePath = path.join(UPLOADS_DIR, entry.fileName);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    await prisma.appUpdate.delete({ where: { id: entry.id } });
    res.json({ success: true, message: 'Update deletado' });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/v1/updates?product=dispara-zapp&currentVersion=1.0.0  (público) ─
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { product, currentVersion } = z
      .object({ product: z.string().min(1), currentVersion: z.string().min(1) })
      .parse(req.query);

    const latest = await prisma.appUpdate.findFirst({
      where: { productSlug: product },
      orderBy: { publishedAt: 'desc' },
    });

    if (!latest) {
      res.json({ success: true, data: { updateAvailable: false } });
      return;
    }

    const updateAvailable = latest.version !== currentVersion;
    const downloadUrl = updateAvailable
      ? `${process.env.BASE_URL || 'https://license-manager.discloud.app'}/api/v1/updates/download/${latest.id}`
      : null;

    res.json({
      success: true,
      data: {
        updateAvailable,
        latestVersion: latest.version,
        currentVersion,
        url: downloadUrl,
        changelog: updateAvailable ? latest.changelog : null,
        force: updateAvailable ? latest.force : false,
        fileSize: latest.fileSize,
        publishedAt: latest.publishedAt,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
