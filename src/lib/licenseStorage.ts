/**
 * licenseStorage.ts
 * Armazena o token de licença no IndexedDB criptografado com AES-GCM.
 * A chave AES é derivada do fingerprint da máquina via PBKDF2.
 *
 * Isso garante que:
 * - Copiar o IndexedDB para outra máquina não funciona (chave diferente)
 * - Inspecionar o storage via DevTools mostra apenas ciphertext
 * - Modificar o ciphertext invalida o HMAC implícito do AES-GCM
 */

import type { StoredToken } from '@/types/license';

const DB_NAME = 'srb_store';
const DB_VERSION = 1;
const STORE_NAME = 'lic';
const TOKEN_KEY = 'tok';
const INTEGRITY_KEY = 'int'; // hash de integridade secundário

// ─── IndexedDB helpers ────────────────────────────────────────────────────────

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbGet(db: IDBDatabase, key: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbSet(db: IDBDatabase, key: string, value: unknown): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const req = tx.objectStore(STORE_NAME).put(value, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

function idbDelete(db: IDBDatabase, key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const req = tx.objectStore(STORE_NAME).delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ─── AES-GCM key derivation ───────────────────────────────────────────────────

const PBKDF2_ITERATIONS = 100_000;
const SALT_SUFFIX = 'srb-license-v2'; // domínio fixo no salt

async function deriveKey(fingerprint: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(fingerprint),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: enc.encode(fingerprint.slice(0, 16) + SALT_SUFFIX),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// ─── Encrypt / Decrypt ────────────────────────────────────────────────────────

interface EncryptedBlob {
  iv: string;   // hex
  ct: string;   // hex ciphertext
  v: number;    // schema version
}

async function encrypt(data: string, key: CryptoKey): Promise<EncryptedBlob> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(data)
  );
  return {
    iv: toHex(iv),
    ct: toHex(new Uint8Array(ct)),
    v: 2,
  };
}

async function decrypt(blob: EncryptedBlob, key: CryptoKey): Promise<string> {
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromHex(blob.iv) },
    key,
    fromHex(blob.ct)
  );
  return new TextDecoder().decode(pt);
}

// ─── Integrity check ──────────────────────────────────────────────────────────

async function computeIntegrity(token: StoredToken, fp: string): Promise<string> {
  const data = JSON.stringify(token) + fp + SALT_SUFFIX;
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
  return toHex(new Uint8Array(buf));
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function saveToken(token: StoredToken, fingerprint: string): Promise<void> {
  const db = await openDB();
  const key = await deriveKey(fingerprint);
  const blob = await encrypt(JSON.stringify(token), key);
  const integrity = await computeIntegrity(token, fingerprint);

  await idbSet(db, TOKEN_KEY, blob);
  await idbSet(db, INTEGRITY_KEY, integrity);
}

export async function loadToken(fingerprint: string): Promise<StoredToken | null> {
  try {
    const db = await openDB();
    const blob = await idbGet(db, TOKEN_KEY) as EncryptedBlob | undefined;
    if (!blob || !blob.ct) return null;

    const key = await deriveKey(fingerprint);
    const json = await decrypt(blob, key);
    const token = JSON.parse(json) as StoredToken;

    // Verifica integridade secundária
    const storedIntegrity = await idbGet(db, INTEGRITY_KEY) as string | undefined;
    if (storedIntegrity) {
      const expected = await computeIntegrity(token, fingerprint);
      if (expected !== storedIntegrity) {
        // Adulteração detectada
        await clearToken();
        return null;
      }
    }

    return token;
  } catch {
    // Falha na descriptografia = fingerprint mudou ou dado corrompido
    return null;
  }
}

export async function clearToken(): Promise<void> {
  try {
    const db = await openDB();
    await idbDelete(db, TOKEN_KEY);
    await idbDelete(db, INTEGRITY_KEY);
  } catch {
    // silencioso
  }
}

export async function tokenExists(): Promise<boolean> {
  try {
    const db = await openDB();
    const blob = await idbGet(db, TOKEN_KEY);
    return !!blob;
  } catch {
    return false;
  }
}

// ─── Utils ────────────────────────────────────────────────────────────────────

function toHex(buf: Uint8Array): string {
  return Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('');
}

function fromHex(hex: string): Uint8Array<ArrayBuffer> {
  const arr = new Uint8Array(hex.length / 2) as Uint8Array<ArrayBuffer>;
  for (let i = 0; i < hex.length; i += 2) {
    arr[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return arr;
}
