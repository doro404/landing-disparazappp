/**
 * trial.ts
 * Trial vinculado ao fingerprint da máquina — armazenado no servidor.
 * Limpar localStorage/IndexedDB não reseta o trial.
 */

import { prisma } from '../config/prisma';
import { signPayload } from './crypto';

export const TRIAL_DAYS = 7;
export const TRIAL_SEND_LIMIT = 50;

// ─── Start / Resume ───────────────────────────────────────────────────────────

export async function startOrResumeTrial(
  fingerprint: string,
  productSlug: string,
  ip?: string
) {
  const existing = await prisma.trial.findUnique({ where: { fingerprint } });

  if (existing) {
    const expired = existing.expiresAt < new Date();
    const exhausted = existing.exhausted || existing.sends >= TRIAL_SEND_LIMIT;

    if (expired || exhausted) {
      return {
        allowed: false,
        reason: exhausted ? 'TRIAL_EXHAUSTED' : 'TRIAL_EXPIRED',
        trial: serializeTrial(existing),
      };
    }

    // Trial ainda ativo — retorna token assinado
    const { payload, signature } = buildTrialToken(existing);
    return { allowed: true, payload, signature, trial: serializeTrial(existing) };
  }

  // Cria novo trial
  const expiresAt = new Date(Date.now() + TRIAL_DAYS * 86_400_000);
  const trial = await prisma.trial.create({
    data: { fingerprint, productSlug, expiresAt, ip },
  });

  const { payload, signature } = buildTrialToken(trial);
  return { allowed: true, payload, signature, trial: serializeTrial(trial) };
}

// ─── Heartbeat (incrementa sends) ────────────────────────────────────────────

export async function trialHeartbeat(
  fingerprint: string,
  sendsToAdd: number
) {
  const trial = await prisma.trial.findUnique({ where: { fingerprint } });
  if (!trial) return { valid: false, reason: 'TRIAL_NOT_FOUND' };

  const expired = trial.expiresAt < new Date();
  if (expired) return { valid: false, reason: 'TRIAL_EXPIRED' };

  const newSends = trial.sends + sendsToAdd;
  const exhausted = newSends >= TRIAL_SEND_LIMIT;

  const updated = await prisma.trial.update({
    where: { fingerprint },
    data: { sends: newSends, exhausted, updatedAt: new Date() },
  });

  const { payload, signature } = buildTrialToken(updated);
  return {
    valid: !exhausted,
    sendsLeft: Math.max(0, TRIAL_SEND_LIMIT - newSends),
    exhausted,
    payload,
    signature,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildTrialToken(trial: {
  id: string;
  fingerprint: string;
  productSlug: string;
  expiresAt: Date;
  sends: number;
}) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    jti: crypto.randomUUID(),
    sub: trial.id,
    key: `TRIAL-${trial.id.slice(0, 8).toUpperCase()}`,
    product: trial.productSlug,
    device_fp_hash: trial.fingerprint,
    entitlements: ['trial'],
    exp: Math.floor(trial.expiresAt.getTime() / 1000),
    iat: now,
    nbf: now,
    trial: true,
    sendsUsed: trial.sends,
    sendsLimit: TRIAL_SEND_LIMIT,
  };
  const signature = signPayload(payload);
  return { payload, signature };
}

function serializeTrial(t: {
  id: string;
  fingerprint: string;
  productSlug: string;
  startedAt: Date;
  expiresAt: Date;
  sends: number;
  exhausted: boolean;
}) {
  return {
    id: t.id,
    productSlug: t.productSlug,
    startedAt: t.startedAt,
    expiresAt: t.expiresAt,
    sends: t.sends,
    sendsLeft: Math.max(0, TRIAL_SEND_LIMIT - t.sends),
    exhausted: t.exhausted,
    expired: t.expiresAt < new Date(),
  };
}
