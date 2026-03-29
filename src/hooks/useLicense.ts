/**
 * useLicense.ts
 * Hook principal de gerenciamento de licença.
 *
 * Trial agora é vinculado ao servidor via fingerprint.
 * Limpar localStorage/IndexedDB não reseta o trial.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { getFingerprint } from '@/lib/fingerprint';
import { loadToken, saveToken, clearToken } from '@/lib/licenseStorage';
import { verifyToken, checkClaims, daysUntilExpiry } from '@/lib/licenseVerify';
import { licenseApi, startHeartbeat, stopHeartbeat, startTrialHeartbeat, stopTrialHeartbeat } from '@/lib/licenseApi';
import { APP_SLUG } from '@/lib/appConfig';
import { trialStateFromPayload, clearTrialCache, setCachedSends, getCachedSends } from '@/lib/trial';
import type {
  LicenseStatus,
  LicenseInfo,
  UseLicenseReturn,
  StoredToken,
  LicensePayload,
  TrialPayload,
} from '@/types/license';

const PRODUCT_SLUG = APP_SLUG;
const MIN_ONLINE_CHECK_INTERVAL_MS = 30 * 60 * 1000;
const MAX_OFFLINE_GRACE_MS = 24 * 60 * 60 * 1000; // 24 horas máximo offline

// ─── Anti-debug básico ────────────────────────────────────────────────────────
function detectDevTools(): boolean {
  const threshold = 160;
  const start = performance.now();
  // eslint-disable-next-line no-debugger
  debugger;
  return performance.now() - start > threshold;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useLicense(): UseLicenseReturn {
  const [status, setStatus] = useState<LicenseStatus>('initializing');
  const [key, setKey] = useState<string | null>(null);
  const [entitlements, setEntitlements] = useState<string[]>([]);
  const [exp, setExp] = useState<number | null>(null);
  const [isGrace, setIsGrace] = useState(false);
  const [trialSendsLeft, setTrialSendsLeft] = useState(0);
  const [trialDaysLeft, setTrialDaysLeft] = useState(0);

  const fpRef = useRef<string>('');
  const devToolsCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const offlineGraceStartRef = useRef<number | null>(null); // rastreia quando offline_grace começou

  // ─── Anti-debug periódico ────────────────────────────────────────────────
  useEffect(() => {
    if (import.meta.env.PROD) {
      devToolsCheckRef.current = setInterval(() => {
        if (detectDevTools()) {
          setStatus(s => s === 'valid' ? 'initializing' : s);
        }
      }, 5000);
    }
    return () => {
      if (devToolsCheckRef.current) clearInterval(devToolsCheckRef.current);
    };
  }, []);

  // ─── Helpers de estado ───────────────────────────────────────────────────

  const applyValid = useCallback((payload: LicensePayload, grace = false) => {
    setKey(payload.key);
    setEntitlements(payload.entitlements ?? []);
    setExp(payload.exp || null);
    setIsGrace(grace);
    setStatus(grace ? 'grace_period' : 'valid');
  }, []);

  const applyTrial = useCallback((payload: TrialPayload) => {
    const state = trialStateFromPayload(payload);
    setTrialSendsLeft(state.sendsLeft);
    setTrialDaysLeft(state.daysLeft);
    setKey(payload.key);
    setEntitlements(['trial']);
    setExp(payload.exp || null);
    setStatus('trial');
  }, []);

  const applyInvalid = useCallback(async (reason: LicenseStatus) => {
    await clearToken();
    stopHeartbeat();
    stopTrialHeartbeat();
    setKey(null);
    setEntitlements([]);
    setExp(null);
    setIsGrace(false);
    setStatus(reason);
  }, []);

  // ─── Offline grace timeout ───────────────────────────────────────────────

  const enterOfflineGrace = useCallback(() => {
    // Verifica se já estamos em offline_grace há muito tempo
    if (offlineGraceStartRef.current === null) {
      offlineGraceStartRef.current = Date.now();
    } else {
      const elapsed = Date.now() - offlineGraceStartRef.current;
      if (elapsed > MAX_OFFLINE_GRACE_MS) {
        // Timeout de offline_grace atingido
        applyInvalid('expired');
        return;
      }
    }
    setStatus(s => s === 'valid' ? 'offline_grace' : s);
  }, [applyInvalid]);

  const resetOfflineGraceTimer = useCallback(() => {
    offlineGraceStartRef.current = null;
  }, []);

  // ─── Validação quando app fica visível (volta de background) ───────────────
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.hidden === false && fpRef.current) {
        // App voltou do background — revalida imediatamente
        const token = await loadToken(fpRef.current);
        if (!token && ['valid', 'grace_period', 'offline_grace'].includes(status)) {
          await applyInvalid('tampered');
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [status, applyInvalid]);

  // ─── Validação periódica de integridade do token ──────────────────────────
  // Detecta IMEDIATAMENTE se o token foi deletado, modificado ou corrompido
  useEffect(() => {
    if (!['valid', 'grace_period', 'offline_grace'].includes(status)) {
      return;
    }

    // Check imediato quando entra em estado válido
    const checkImmediate = async () => {
      if (fpRef.current) {
        const token = await loadToken(fpRef.current);
        if (!token) {
          await applyInvalid('tampered');
        }
      }
    };

    checkImmediate();

    // Depois valida periodicamente a cada 30 segundos
    const validationInterval = setInterval(() => {
      checkImmediate();
    }, 30 * 1000);

    return () => clearInterval(validationInterval);
  }, [status, applyInvalid]);

  // ─── Validação online ────────────────────────────────────────────────────

  const validateOnline = useCallback(async (
    licenseKey: string,
    fp: string,
    stored: StoredToken
  ): Promise<boolean> => {
    const now = Date.now();
    if (stored.lastOnlineCheck && now - stored.lastOnlineCheck < MIN_ONLINE_CHECK_INTERVAL_MS) {
      return true;
    }
    setStatus('online_pending');
    try {
      const res = await licenseApi.validate(licenseKey, fp);
      if (!res.success || !res.data?.valid) return false;
      const updated: StoredToken = { ...stored, lastOnlineCheck: now };
      await saveToken(updated, fp);
      return true;
    } catch {
      return false;
    }
  }, []);

  // ─── Validação online na inicialização (sem respeitar intervalo) ────────

  const validateOnlineStartup = useCallback(async (
    licenseKey: string,
    fp: string,
    stored: StoredToken
  ): Promise<boolean> => {
    console.log('[License] Starting online validation at startup...');
    setStatus('online_pending');
    try {
      const res = await licenseApi.validate(licenseKey, fp);
      console.log('[License] Online validation response:', res);
      
      if (!res.success) {
        console.log('[License] Validation failed - marking as invalid');
        await applyInvalid('tampered');
        return false;
      }

      // Servidor disse que está revogada
      if (res.data?.reason === 'REVOKED') {
        console.log('[License] Revoked by server');
        await applyInvalid('revoked');
        return false;
      }

      // Servidor disse que expirou
      if (res.data?.reason === 'EXPIRED' && !res.data?.grace) {
        console.log('[License] Expired by server');
        await applyInvalid('expired');
        return false;
      }

      // Servidor disse que não encontrou a licença
      if (res.data?.reason === 'LICENSE_NOT_FOUND' || !res.data?.valid) {
        console.log('[License] License not found or invalid:', res.data?.reason);
        await applyInvalid('invalid');
        return false;
      }

      // Válido no servidor
      if (res.data?.valid) {
        console.log('[License] Valid on server - proceeding');
        const updated: StoredToken = { ...stored, lastOnlineCheck: Date.now() };
        await saveToken(updated, fp);
        return true;
      }

      // Fallback: se não sabe o status, marca como inválido
      console.log('[License] Unknown status - marking as invalid');
      await applyInvalid('invalid');
      return false;
    } catch (e) {
      // Sem internet — continua com validação local
      console.log('[License] No internet at startup, using local cache:', e);
      return true;
    }
  }, [applyInvalid]);

  // ─── Check principal ─────────────────────────────────────────────────────

  const recheck = useCallback(async () => {
    console.log('[License] Starting license check...');
    setStatus('initializing');

    setStatus('checking_fp');
    try {
      fpRef.current = await getFingerprint();
    } catch {
      fpRef.current = 'unknown';
    }

    const stored = await loadToken(fpRef.current);

    if (!stored) {
      // Fallback fingerprint antigo
      console.log('[License] No token found, checking fallback...');
      const fallback = await loadToken('unknown');
      if (!fallback) {
        console.log('[License] No token anywhere - INVALID');
        setStatus('invalid');
        return;
      }
      await clearToken();
      console.log('[License] Fallback token found but clearing...');
      setStatus('invalid');
      return;
    }

    console.log('[License] Token found:', stored.payload.key);
    const { payload, signature } = stored;

    // Trial token — valida e aplica
    if ((payload as TrialPayload).trial) {
      setStatus('validating_sig');
      const sigResult = await verifyToken(payload, signature);
      if (sigResult === 'invalid') {
        await applyInvalid('tampered');
        return;
      }
      const trialPayload = payload as TrialPayload;
      const state = trialStateFromPayload(trialPayload);
      if (state.expired) {
        await applyInvalid('expired');
        return;
      }

      // Confirma com o servidor que o trial ainda existe (detecta deleção pelo admin)
      try {
        const res = await licenseApi.trial.start(fpRef.current);
        if (!res.success) {
          // Servidor rejeitou (trial deletado, expirado ou esgotado)
          await applyInvalid('expired');
          return;
        }
        // Atualiza token com dados frescos do servidor
        const freshPayload = res.data!.payload as TrialPayload;
        const freshSig = res.data!.signature;
        const freshStored: StoredToken = {
          payload: freshPayload,
          signature: freshSig,
          activatedAt: stored.activatedAt,
          lastOnlineCheck: Date.now(),
        };
        await saveToken(freshStored, fpRef.current);
        setCachedSends(freshPayload.sendsUsed);
        applyTrial(freshPayload);

        // Heartbeat periódico para detectar deleção enquanto o app está aberto
        startTrialHeartbeat(
          fpRef.current,
          () => applyInvalid('expired'),
          async (newPayload, newSig) => {
            const tp = newPayload as TrialPayload;
            const updated: StoredToken = {
              payload: tp,
              signature: newSig,
              activatedAt: stored.activatedAt,
              lastOnlineCheck: Date.now(),
            };
            await saveToken(updated, fpRef.current);
            setCachedSends(tp.sendsUsed);
            applyTrial(tp);
          }
        );
      } catch {
        // Offline — usa token local em cache (grace offline)
        applyTrial(trialPayload);
      }
      return;
    }

    // Licença normal
    if (payload.product !== PRODUCT_SLUG) {
      await applyInvalid('tampered');
      return;
    }

    setStatus('validating_sig');
    const sigResult = await verifyToken(payload, signature);
    if (sigResult === 'invalid') {
      await applyInvalid('tampered');
      return;
    }

    const claims = checkClaims(payload, fpRef.current);

    if (!claims.valid && !claims.grace) {
      if (claims.reason === 'DEVICE_MISMATCH') {
        const ok = await validateOnline(payload.key, fpRef.current, stored);
        if (!ok) { await applyInvalid('invalid'); return; }
        applyValid(payload, false);
        return;
      }
      if (claims.reason === 'EXPIRED') {
        await applyInvalid('expired');
        return;
      }
      await applyInvalid('invalid');
      return;
    }

    // ─── Validação online obrigatória na inicialização ───────────────────
    // Ignora cache de lastOnlineCheck — sempre valida com servidor se tiver internet
    // validateOnlineStartup já chama applyInvalid se algo der errado
    console.log('[License] Running online validation startup check...');
    const onlineOk = await validateOnlineStartup(payload.key, fpRef.current, stored);
    if (!onlineOk) {
      // Validação online falhou — applyInvalid já foi chamado
      console.log('[License] Online validation failed, stopping here');
      return;
    }
    console.log('[License] Online validation passed, proceeding...');

    // ─── Double check: verifica novamente se token ainda existe antes de aplicar válido ───
    // Isso detecta imediatamente se o usuário apagou o IndexedDB enquanto o app verificava
    const finalToken = await loadToken(fpRef.current);
    if (!finalToken) {
      console.log('[License] Final token check failed - marking as tampered');
      await applyInvalid('tampered');
      return;
    }

    console.log('[License] All checks passed - marking as valid');
    applyValid(payload, claims.grace);

    startHeartbeat(
      payload.key,
      fpRef.current,
      () => applyInvalid('revoked'),
      async (newPayload, newSig) => {
        const updated: StoredToken = {
          payload: newPayload as LicensePayload,
          signature: newSig,
          activatedAt: stored.activatedAt,
          lastOnlineCheck: Date.now(),
        };
        await saveToken(updated, fpRef.current);
        applyValid(newPayload as LicensePayload, false);
        resetOfflineGraceTimer(); // reseta timer quando reconnecta
      },
      () => { enterOfflineGrace(); },
      () => { setStatus('grace_period'); },
      () => applyInvalid('expired')
    );
  }, [applyValid, applyTrial, applyInvalid, validateOnline, validateOnlineStartup, enterOfflineGrace, resetOfflineGraceTimer]);

  // ─── Ativação ────────────────────────────────────────────────────────────

  const activate = useCallback(async (
    rawKey: string
  ): Promise<{ success: boolean; message?: string }> => {
    setStatus('activating');

    try {
      fpRef.current = await getFingerprint();
    } catch {
      fpRef.current = 'unknown';
    }

    const normalizedKey = rawKey.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');

    try {
      const res = await licenseApi.activate(normalizedKey, fpRef.current);

      if (!res.success || !res.data) {
        setStatus('invalid');
        return { success: false, message: res.error ?? 'Falha na ativação.' };
      }

      const { payload, signature } = res.data;
      const sigResult = await verifyToken(payload, signature);
      if (sigResult === 'invalid') {
        setStatus('tampered');
        return { success: false, message: 'Token inválido recebido do servidor.' };
      }

      const stored: StoredToken = {
        payload,
        signature,
        activatedAt: Date.now(),
        lastOnlineCheck: Date.now(),
      };

      // Limpa trial ao ativar licença real
      clearTrialCache();
      await saveToken(stored, fpRef.current);
      applyValid(payload, false);

      startHeartbeat(
        payload.key,
        fpRef.current,
        () => applyInvalid('revoked'),
        async (newPayload, newSig) => {
          const updated: StoredToken = {
            payload: newPayload as LicensePayload,
            signature: newSig,
            activatedAt: stored.activatedAt,
            lastOnlineCheck: Date.now(),
          };
          await saveToken(updated, fpRef.current);
          applyValid(newPayload as LicensePayload, false);
          resetOfflineGraceTimer(); // reseta timer quando reconnecta
        },
        () => { enterOfflineGrace(); },
        () => { setStatus('grace_period'); },
        () => applyInvalid('expired')
      );

      return { success: true };
    } catch (e) {
      setStatus('invalid');
      return {
        success: false,
        message: e instanceof Error ? e.message : 'Erro de conexão com o servidor de licenças.',
      };
    }
  }, [applyValid, applyInvalid]);

  // ─── Iniciar trial (via servidor) ────────────────────────────────────────

  const startTrialFn = useCallback(async () => {
    setStatus('initializing');
    try {
      fpRef.current = await getFingerprint();
    } catch {
      fpRef.current = 'unknown';
    }

    try {
      const res = await licenseApi.trial.start(fpRef.current);

      if (!res.success || !res.data) {
        // Trial expirado/esgotado no servidor
        setStatus('invalid');
        return;
      }

      const { payload, signature } = res.data;
      const sigResult = await verifyToken(payload, signature);
      if (sigResult === 'invalid') {
        setStatus('invalid');
        return;
      }

      const stored: StoredToken = {
        payload,
        signature,
        activatedAt: Date.now(),
        lastOnlineCheck: Date.now(),
      };
      await saveToken(stored, fpRef.current);
      setCachedSends(payload.sendsUsed);
      applyTrial(payload);
    } catch {
      // Sem internet — não permite trial offline (evita bypass)
      setStatus('invalid');
    }
  }, [applyTrial]);

  // ─── Init ────────────────────────────────────────────────────────────────

  useEffect(() => {
    recheck();
    return () => {
      stopHeartbeat();
      stopTrialHeartbeat();
    };
  }, [recheck]);

  // ─── Derived info ────────────────────────────────────────────────────────

  const info: LicenseInfo = {
    status,
    key,
    entitlements,
    expiresAt: exp,
    daysUntilExpiry: exp ? daysUntilExpiry(exp) : null,
    isGracePeriod: isGrace,
    isTrial: status === 'trial',
    trialSendsLeft,
    trialDaysLeft,
  };

  const hasEntitlement = useCallback(
    (flag: string) => entitlements.includes(flag),
    [entitlements]
  );

  const logout = useCallback(async () => {
    stopHeartbeat();
    stopTrialHeartbeat();
    await clearToken();
    clearTrialCache();
    sessionStorage.removeItem('srb_fp_v2');
    setKey(null);
    setEntitlements([]);
    setExp(null);
    setIsGrace(false);
    setStatus('invalid');
  }, []);

  return { info, activate, logout, recheck, hasEntitlement, startTrial: startTrialFn };
}
