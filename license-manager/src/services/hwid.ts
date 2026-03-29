import { createHash } from 'crypto';

export interface NormalizedFingerprint {
  combined: string;  // hash principal (legado + lookup)
  stable?: string;   // hash dos sinais estáveis
  volatile?: string; // hash dos sinais voláteis
}

/**
 * Normaliza o fingerprint recebido do cliente.
 * Aceita tanto string simples (legado) quanto objeto { combined, stable, volatile }.
 */
export function normalizeFingerprint(raw: string | NormalizedFingerprint): NormalizedFingerprint {
  if (typeof raw === 'object' && raw.combined) {
    return {
      combined: hash(raw.combined),
      stable: raw.stable ? hash(raw.stable) : undefined,
      volatile: raw.volatile ? hash(raw.volatile) : undefined,
    };
  }
  // Legado: string simples
  const combined = hash(String(raw).trim().toLowerCase());
  return { combined };
}

function hash(value: string): string {
  return createHash('sha256').update(value.trim().toLowerCase()).digest('hex');
}
