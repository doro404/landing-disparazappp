/**
 * licenseApi.ts
 * Cliente HTTP para o backend de licenças.
 * Inclui heartbeat periódico e retry com backoff.
 */

import type {
  ActivateResponse,
  ValidateResponse,
  HeartbeatResponse,
  TrialStartResponse,
  TrialHeartbeatResponse,
} from '@/types/license';
import { APP_SLUG } from '@/lib/appConfig';
import { getFingerprintFull } from '@/lib/fingerprint';

const LICENSE_API =
  import.meta.env.VITE_LICENSE_API_URL ??
  'https://license-manager.discloud.app/api/v1';

const PRODUCT_SLUG = APP_SLUG;
const TIMEOUT_MS = 12_000;

// ─── Core request ─────────────────────────────────────────────────────────────

async function req<T>(
  method: string,
  path: string,
  body?: unknown,
  retries = 1
): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`${LICENSE_API}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });

      if (!res.ok && res.status >= 500 && attempt < retries) {
        await sleep(1000 * (attempt + 1));
        continue;
      }

      return res.json() as Promise<T>;
    } catch (e) {
      if (attempt < retries) {
        await sleep(1000 * (attempt + 1));
        continue;
      }
      throw e;
    }
  }
  throw new Error('Max retries exceeded');
}

function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

// ─── API ──────────────────────────────────────────────────────────────────────

export const licenseApi = {
  activate: async (key: string, fingerprint: string): Promise<ActivateResponse> => {
    const fp = await getFingerprintFull();
    return req<ActivateResponse>('POST', '/licenses/activate', {
      key,
      fingerprint: { combined: fingerprint, stable: fp.stable, volatile: fp.volatile },
      product: PRODUCT_SLUG,
    });
  },

  validate: async (key: string, fingerprint: string): Promise<ValidateResponse> => {
    const fp = await getFingerprintFull();
    return req<ValidateResponse>(
      'GET',
      `/licenses/validate?key=${encodeURIComponent(key)}&fingerprint=${encodeURIComponent(fingerprint)}&stableFp=${encodeURIComponent(fp.stable)}&volatileFp=${encodeURIComponent(fp.volatile)}`
    );
  },

  heartbeat: async (key: string, fingerprint: string): Promise<HeartbeatResponse> => {
    const fp = await getFingerprintFull();
    return req<HeartbeatResponse>('POST', '/licenses/heartbeat', {
      key,
      fingerprint: { combined: fingerprint, stable: fp.stable, volatile: fp.volatile },
      product: PRODUCT_SLUG,
    });
  },

  trial: {
    start: (fingerprint: string): Promise<TrialStartResponse> =>
      req<TrialStartResponse>('POST', '/trials/start', {
        fingerprint,
        productSlug: PRODUCT_SLUG,
      }),

    heartbeat: (fingerprint: string, sends: number): Promise<TrialHeartbeatResponse> =>
      req<TrialHeartbeatResponse>('POST', '/trials/heartbeat', {
        fingerprint,
        sends,
      }),
  },
};

// ─── Heartbeat manager ────────────────────────────────────────────────────────

const HEARTBEAT_INTERVAL_MS = 30 * 60 * 1000; // 30 minutos (reduzido de 4 horas para segurança)
const TRIAL_HEARTBEAT_INTERVAL_MS = 10 * 60 * 1000; // 10 minutos (reduzido de 15 para segurança)

let _heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let _trialHeartbeatTimer: ReturnType<typeof setInterval> | null = null;

export function startHeartbeat(
  key: string,
  fingerprint: string,
  onRevoked: () => void,
  onTokenRefresh: (payload: unknown, sig: string) => void,
  onOffline?: () => void,
  onGrace?: () => void,
  onExpired?: () => void
): void {
  stopHeartbeat();

  const beat = async () => {
    try {
      const res = await licenseApi.heartbeat(key, fingerprint);
      if (!res.success) return;

      if (res.data?.revoked) {
        onRevoked();
        stopHeartbeat();
        return;
      }

      // Servidor confirmou expiração real (fora do grace)
      if (!res.data?.valid && res.data?.reason === 'EXPIRED') {
        onExpired?.();
        stopHeartbeat();
        return;
      }

      // Servidor confirmou grace period
      if (res.data?.grace) {
        onGrace?.();
      }

      // Token renovado (inclui grace tokens)
      if (res.data?.newToken) {
        onTokenRefresh(res.data.newToken.payload, res.data.newToken.signature);
      }
    } catch {
      onOffline?.();
    }
  };

  _heartbeatTimer = setInterval(beat, HEARTBEAT_INTERVAL_MS);
}

export function stopHeartbeat(): void {
  if (_heartbeatTimer) {
    clearInterval(_heartbeatTimer);
    _heartbeatTimer = null;
  }
  stopTrialHeartbeat();
}

export function startTrialHeartbeat(
  fingerprint: string,
  onInvalid: () => void,
  onRefresh: (payload: unknown, sig: string) => void
): void {
  stopTrialHeartbeat();

  const beat = async () => {
    try {
      const res = await licenseApi.trial.start(fingerprint);
      if (!res.success) {
        // Trial foi deletado ou expirou/esgotou no servidor
        onInvalid();
        stopTrialHeartbeat();
        return;
      }
      if (res.data) {
        onRefresh(res.data.payload, res.data.signature);
      }
    } catch {
      // Offline — mantém estado atual silenciosamente
    }
  };

  _trialHeartbeatTimer = setInterval(beat, TRIAL_HEARTBEAT_INTERVAL_MS);
}

export function stopTrialHeartbeat(): void {
  if (_trialHeartbeatTimer) {
    clearInterval(_trialHeartbeatTimer);
    _trialHeartbeatTimer = null;
  }
}
