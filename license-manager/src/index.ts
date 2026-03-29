import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { env } from './config/env';
import { errorHandler } from './middleware/errorHandler';
import healthRouter from './routes/health';
import licensesRouter from './routes/licenses';
import productsRouter from './routes/products';
import updatesRouter from './routes/updates';
import trialsRouter from './routes/trials';

const app = express();

// Trust proxy — necessário no Discloud/Docker onde X-Forwarded-For é injetado
app.set('trust proxy', 1);

// ─── Security middleware ──────────────────────────────────────────────────────

app.use(helmet());
app.use(
  cors({
    origin: env.CORS_ORIGINS.includes('*') ? '*' : env.CORS_ORIGINS,
    methods: ['GET', 'POST', 'DELETE'],
  })
);
app.use(express.json());

// ─── Rate limiting ────────────────────────────────────────────────────────────

// Strict limit on public endpoints (activate / validate)
const publicLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests', code: 'RATE_LIMITED' },
});

// Relaxed limit for admin endpoints
const adminLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

// ─── Routes ───────────────────────────────────────────────────────────────────

app.use('/health', healthRouter);
app.use('/api/v1/licenses/activate', publicLimiter);
app.use('/api/v1/licenses/validate', publicLimiter);
app.use('/api/v1/licenses', adminLimiter, licensesRouter);
app.use('/api/v1/products', adminLimiter, productsRouter);
app.use('/api/v1/updates', updatesRouter);
app.use('/api/v1/trials', publicLimiter, trialsRouter);

// ─── Error handler ────────────────────────────────────────────────────────────

app.use(errorHandler);

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(env.PORT, () => {
  console.log(`\n🔑 License Manager`);
  console.log(`   Running on  http://localhost:${env.PORT}`);
  console.log(`   Environment ${env.NODE_ENV}`);
  console.log(`   Keys loaded  ${env.ED25519_PRIVATE_KEY ? '✓' : '✗ (run npm run keys:generate)'}\n`);
});

export default app;
