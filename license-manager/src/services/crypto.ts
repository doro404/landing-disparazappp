/**
 * Ed25519 signing/verification using @noble/ed25519.
 *
 * Keys are stored as hex strings in .env.
 * The public key should be embedded in the client app for offline verification.
 */
import * as ed from '@noble/ed25519';
import { createHash, randomBytes } from 'crypto';
import { env } from '../config/env';

// noble/ed25519 v2 requires a sha512Sync implementation
// Using Node's built-in crypto to avoid extra type declarations
ed.etc.sha512Sync = (...msgs: Uint8Array[]) => {
  const h = createHash('sha512');
  for (const m of msgs) h.update(m);
  return new Uint8Array(h.digest());
};

// ─── Key generation ──────────────────────────────────────────────────────────

export function generateKeyPair(): { privateKey: string; publicKey: string } {
  const privateKey = ed.utils.randomPrivateKey();
  const publicKey = ed.getPublicKey(privateKey);
  return {
    privateKey: Buffer.from(privateKey).toString('hex'),
    publicKey: Buffer.from(publicKey).toString('hex'),
  };
}

// ─── Signing ─────────────────────────────────────────────────────────────────

export function signPayload(payload: object): string {
  if (!env.ED25519_PRIVATE_KEY) {
    throw new Error('ED25519_PRIVATE_KEY is not set');
  }
  const privateKey = Buffer.from(env.ED25519_PRIVATE_KEY, 'hex');
  const message = Buffer.from(JSON.stringify(payload));
  const signature = ed.sign(message, privateKey);
  return Buffer.from(signature).toString('hex');
}

export function verifyPayload(payload: object, signatureHex: string): boolean {
  if (!env.ED25519_PUBLIC_KEY) {
    throw new Error('ED25519_PUBLIC_KEY is not set');
  }
  try {
    const publicKey = Buffer.from(env.ED25519_PUBLIC_KEY, 'hex');
    const message = Buffer.from(JSON.stringify(payload));
    const signature = Buffer.from(signatureHex, 'hex');
    return ed.verify(signature, message, publicKey);
  } catch {
    return false;
  }
}

// ─── License key generation ───────────────────────────────────────────────────

/**
 * Generates a human-readable license key like: XXXX-XXXX-XXXX-XXXX
 */
export function generateLicenseKey(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars
  const segment = () =>
    Array.from({ length: 4 }, () => chars[randomBytes(1)[0] % chars.length]).join('');
  return `${segment()}-${segment()}-${segment()}-${segment()}`;
}
