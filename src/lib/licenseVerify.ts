/**
 * licenseVerify.ts
 * Verificação offline Ed25519 usando @noble/ed25519 v3 + @noble/hashes v2.
 * Funciona no WebView2 (Tauri/Windows) onde crypto.subtle não suporta Ed25519.
 */

import * as ed from '@noble/ed25519';
import { sha512 } from '@noble/hashes/sha2.js';
import type { LicensePayload } from '@/types/license';

// ─── Configuração obrigatória para Vite/Tauri (executa uma vez no import) ────
// @noble/ed25519 v3: configura via ed.hashes
ed.hashes.sha512 = sha512;
ed.hashes.sha512Async = (m: Uint8Array) => Promise.resolve(sha512(m));

const PUBLIC_KEY_HEX = import.meta.env.VITE_LICENSE_PUBLIC_KEY ?? '';

export type VerifyResult = 'valid' | 'invalid';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function hexToBytes(hex: string): Uint8Array {
  return new Uint8Array(hex.match(/.{1,2}/g)!.map(b => parseInt(b, 16)));
}

// ─── Verificação principal ────────────────────────────────────────────────────

export async function verifyToken(
  payload: LicensePayload,
  signature: string
): Promise<VerifyResult> {
  if (!PUBLIC_KEY_HEX) {
    if (import.meta.env.DEV) {
      console.warn('[License] VITE_LICENSE_PUBLIC_KEY não configurada — modo dev permissivo');
      return 'valid';
    }
    return 'invalid';
  }

  try {
    const message = new TextEncoder().encode(JSON.stringify(payload));
    const sigBytes = hexToBytes(signature);
    const pubKeyBytes = hexToBytes(PUBLIC_KEY_HEX);

    const ok = await ed.verifyAsync(sigBytes, message, pubKeyBytes);
    return ok ? 'valid' : 'invalid';
  } catch (e) {
    console.error('[License] Falha na verificação Ed25519:', e);
    return 'invalid';
  }
}

// ─── Validações de claims ─────────────────────────────────────────────────────

const GRACE_PERIOD_MS = 24 * 60 * 60 * 1000; // 1 dia (reduzido de 5 dias para segurança)

export function checkClaims(payload: LicensePayload, deviceFp: string): {
  valid: boolean;
  grace: boolean;
  reason?: string;
} {
  const now = Math.floor(Date.now() / 1000);

  if (payload.nbf && now < payload.nbf) {
    return { valid: false, grace: false, reason: 'TOKEN_NOT_YET_VALID' };
  }

  if (payload.exp && payload.exp > 0) {
    const expMs = payload.exp * 1000;
    const nowMs = Date.now();

    if (nowMs > expMs + GRACE_PERIOD_MS) {
      return { valid: false, grace: false, reason: 'EXPIRED' };
    }

    if (nowMs > expMs) {
      return { valid: true, grace: true };
    }
  }

  if (payload.device_fp_hash && payload.device_fp_hash !== deviceFp) {
    return { valid: false, grace: false, reason: 'DEVICE_MISMATCH' };
  }

  return { valid: true, grace: false };
}

export function daysUntilExpiry(exp: number): number | null {
  if (!exp || exp === 0) return null;
  const diff = exp * 1000 - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
