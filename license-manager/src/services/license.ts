import { prisma } from '../config/prisma';
import { generateLicenseKey, signPayload } from './crypto';
import { normalizeFingerprint, NormalizedFingerprint } from './hwid';
import { CreateLicenseInput } from '../types';

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createLicense(input: CreateLicenseInput) {
  const product = await prisma.product.findUnique({
    where: { slug: input.productSlug },
  });
  if (!product) throw new Error(`Product not found: ${input.productSlug}`);

  const key = generateLicenseKey();

  let expiresAt: Date | null = null;
  if (input.expiresAt) {
    expiresAt = new Date(input.expiresAt);
  } else if (product.defaultTrialDays) {
    expiresAt = new Date(Date.now() + product.defaultTrialDays * 86_400_000);
  }

  const license = await prisma.license.create({
    data: {
      key,
      productId: product.id,
      maxMachines: input.maxMachines ?? (product.defaultMaxMachines ?? 1),
      expiresAt,
      entitlements: input.entitlements ? JSON.stringify(input.entitlements) : null,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      customerEmail: input.customerEmail ?? null,
      customerName: input.customerName ?? null,
      orderId: input.orderId ?? null,
      notes: input.notes ?? null,
    },
    include: { product: true },
  });

  return license;
}

// ─── Activate ─────────────────────────────────────────────────────────────────

export async function activateLicense(
  key: string,
  fp: NormalizedFingerprint,
  ip?: string
) {
  const license = await prisma.license.findUnique({
    where: { key },
    include: { product: true, activations: true },
  });

  if (!license) throw new LicenseError('LICENSE_NOT_FOUND', 'License not found');
  if (license.revoked ?? false) throw new LicenseError('LICENSE_REVOKED', 'License has been revoked');
  if (license.expiresAt && license.expiresAt < new Date()) {
    throw new LicenseError('LICENSE_EXPIRED', 'License has expired');
  }

  const maxMachines = license.maxMachines ?? 1;

  // Tenta encontrar ativação existente por qualquer camada do fingerprint
  const existing = findActivation(license.activations, fp);

  if (!existing) {
    if (license.activations.length >= maxMachines) {
      throw new LicenseError(
        'MAX_MACHINES_REACHED',
        `License allows ${maxMachines} machine(s). Limit reached.`
      );
    }
    await prisma.activation.create({
      data: {
        licenseId: license.id,
        fingerprint: fp.combined,
        stableFp: fp.stable ?? null,
        volatileFp: fp.volatile ?? null,
        ip,
      },
    });
  } else {
    // Atualiza fingerprints silenciosamente (volatile pode ter mudado)
    await prisma.activation.update({
      where: { id: existing.id },
      data: {
        lastSeen: new Date(),
        ip,
        stableFp: fp.stable ?? existing.stableFp,
        volatileFp: fp.volatile ?? existing.volatileFp,
        // Atualiza combined se o stable bateu mas o combined mudou
        fingerprint: existing.stableFp && fp.stable && existing.stableFp === fp.stable
          ? fp.combined  // atualiza para o novo combined
          : existing.fingerprint,
      },
    });
  }

  const payload = buildTokenPayload(license, fp.combined);
  const signature = signPayload(payload);
  return { payload, signature };
}

// ─── Validate ─────────────────────────────────────────────────────────────────

export async function validateLicense(key: string, fp?: NormalizedFingerprint) {
  const license = await prisma.license.findUnique({
    where: { key },
    include: { product: true, activations: true },
  });

  if (!license) return { valid: false, reason: 'LICENSE_NOT_FOUND' };
  if (license.revoked ?? false) return { valid: false, reason: 'LICENSE_REVOKED' };
  if (license.expiresAt && license.expiresAt < new Date()) {
    return { valid: false, reason: 'LICENSE_EXPIRED' };
  }
  if (fp) {
    const activation = findActivation(license.activations, fp);
    if (!activation) return { valid: false, reason: 'MACHINE_NOT_ACTIVATED' };

    // Atualiza volatile silenciosamente se stable bateu
    if (activation.stableFp && fp.stable && activation.stableFp === fp.stable
        && activation.volatileFp !== fp.volatile) {
      await prisma.activation.update({
        where: { id: activation.id },
        data: { volatileFp: fp.volatile, fingerprint: fp.combined, lastSeen: new Date() },
      });
    }
  }

  return {
    valid: true,
    license: {
      id: license.id,
      key: license.key,
      product: license.product.slug,
      maxMachines: license.maxMachines ?? 1,
      activatedMachines: license.activations.length,
      expiresAt: license.expiresAt,
      entitlements: license.entitlements ? JSON.parse(license.entitlements) : [],
      metadata: license.metadata ? JSON.parse(license.metadata) : {},
    },
  };
}

// ─── Revoke ───────────────────────────────────────────────────────────────────

export async function revokeLicense(key: string) {
  const license = await prisma.license.findUnique({ where: { key } });
  if (!license) throw new LicenseError('LICENSE_NOT_FOUND', 'License not found');
  await prisma.license.update({ where: { key }, data: { revoked: true } });
}

// ─── Heartbeat ────────────────────────────────────────────────────────────────

const GRACE_PERIOD_MS = 5 * 24 * 60 * 60 * 1000; // 5 dias

export async function heartbeatLicense(key: string, fp: NormalizedFingerprint, ip?: string) {
  const license = await prisma.license.findUnique({
    where: { key },
    include: { product: true, activations: true },
  });

  if (!license || (license.revoked ?? false)) {
    return { valid: false, revoked: license?.revoked ?? false, grace: false };
  }

  if (license.expiresAt) {
    const now = new Date();
    const expiredMs = now.getTime() - license.expiresAt.getTime();

    if (expiredMs > GRACE_PERIOD_MS) {
      return { valid: false, revoked: false, grace: false, reason: 'EXPIRED' };
    }

    if (expiredMs > 0) {
      const activation = findActivation(license.activations, fp);
      if (!activation) return { valid: false, revoked: false, grace: false };
      await updateActivation(activation, fp, ip);
      const payload = buildTokenPayload(license, fp.combined);
      const signature = signPayload(payload);
      return { valid: true, revoked: false, grace: true, newToken: { payload, signature } };
    }
  }

  const activation = findActivation(license.activations, fp);
  if (!activation) return { valid: false, revoked: false, grace: false };

  await updateActivation(activation, fp, ip);
  const payload = buildTokenPayload(license, fp.combined);
  const signature = signPayload(payload);
  return { valid: true, revoked: false, grace: false, newToken: { payload, signature } };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Encontra ativação por qualquer camada do fingerprint:
 * 1. combined exato
 * 2. stable hash (mesmo que volatile mudou)
 * 3. volatile hash (fallback)
 */
function findActivation(
  activations: Array<{ id: string; fingerprint: string; stableFp?: string | null; volatileFp?: string | null }>,
  fp: NormalizedFingerprint
) {
  // 1. Match exato no combined
  const exact = activations.find(a => a.fingerprint === fp.combined);
  if (exact) return exact;

  // 2. Match no stable (hardware fixo) — aceita mesmo que volatile mudou
  if (fp.stable) {
    const stableMatch = activations.find(a => a.stableFp === fp.stable);
    if (stableMatch) return stableMatch;
  }

  // 3. Match no volatile (fallback para ativações legadas sem stable)
  if (fp.volatile) {
    const volatileMatch = activations.find(a => a.volatileFp === fp.volatile);
    if (volatileMatch) return volatileMatch;
  }

  return null;
}

async function updateActivation(
  activation: { id: string; stableFp?: string | null; volatileFp?: string | null },
  fp: NormalizedFingerprint,
  ip?: string
) {
  const stableMatched = activation.stableFp && fp.stable && activation.stableFp === fp.stable;
  await prisma.activation.update({
    where: { id: activation.id },
    data: {
      lastSeen: new Date(),
      ip,
      stableFp: fp.stable ?? activation.stableFp,
      // Atualiza volatile e combined se stable bateu (volatile pode ter mudado com driver update)
      volatileFp: stableMatched ? (fp.volatile ?? activation.volatileFp) : activation.volatileFp,
      fingerprint: stableMatched ? fp.combined : undefined,
    },
  });
}

function buildTokenPayload(
  license: {
    id: string;
    key: string;
    expiresAt: Date | null;
    entitlements: string | null;
    maxMachines: number | null;
    product: { slug: string };
  },
  fingerprint: string
) {
  const now = Math.floor(Date.now() / 1000);
  return {
    jti: crypto.randomUUID(),
    sub: license.id,
    key: license.key,
    product: license.product.slug,
    device_fp_hash: fingerprint,
    entitlements: license.entitlements ? JSON.parse(license.entitlements) : [],
    exp: license.expiresAt ? Math.floor(license.expiresAt.getTime() / 1000) : 0,
    iat: now,
    nbf: now,
  };
}

export class LicenseError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'LicenseError';
  }
}
