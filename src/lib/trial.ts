/**
 * trial.ts
 * Trial vinculado ao servidor — o fingerprint é a chave.
 * Limpar localStorage/IndexedDB não reseta o trial.
 *
 * O token de trial é armazenado no mesmo IndexedDB criptografado
 * que o token de licença, via licenseStorage.
 */

export const TRIAL_SEND_LIMIT = 50;
export const TRIAL_DAYS = 7;

// ─── Estado local (apenas cache de UI, não é a fonte da verdade) ──────────────

const KEY_SENDS_CACHE = 'srb_trial_sends_cache'; // cache local para UI

export interface TrialState {
  active: boolean;
  startedAt: number | null;
  sends: number;
  daysLeft: number;
  sendsLeft: number;
  expired: boolean;
}

/**
 * Estado derivado do payload do token de trial (fonte da verdade = servidor).
 * Chamado após receber o token do servidor.
 */
export function trialStateFromPayload(payload: {
  exp: number;
  sendsUsed: number;
  sendsLimit: number;
  iat: number;
}): TrialState {
  const now = Date.now();
  const expMs = payload.exp * 1000;

  // Usa exp do token como fonte da verdade (igual ao SettingsModal)
  const msLeft = expMs - now;
  const daysLeft = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));
  const sendsLeft = Math.max(0, payload.sendsLimit - payload.sendsUsed);
  const expired = now > expMs || sendsLeft === 0;

  return {
    active: !expired,
    startedAt: payload.iat * 1000,
    sends: payload.sendsUsed,
    daysLeft,
    sendsLeft,
    expired,
  };
}

/** Cache local de sends para atualização otimista da UI */
export function getCachedSends(): number {
  return Number(localStorage.getItem(KEY_SENDS_CACHE) || '0');
}

export function setCachedSends(n: number): void {
  localStorage.setItem(KEY_SENDS_CACHE, String(n));
}

export function clearTrialCache(): void {
  localStorage.removeItem(KEY_SENDS_CACHE);
}
