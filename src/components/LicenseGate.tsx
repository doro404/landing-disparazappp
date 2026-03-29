/**
 * LicenseGate.tsx
 * Overlay de licença com estados visuais distintos para cada status.
 * Bloqueia toda a UI quando a licença não está válida.
 */

import { useState, useEffect, useRef } from 'react';
import {
  KeyRound, Loader2, CheckCircle2, XCircle,
  ShieldAlert, ShieldCheck, ShieldX, Clock, Wifi, WifiOff,
} from 'lucide-react';
import { useLicenseContext } from '@/context/LicenseContext';
import { useThemeStyles } from '@/hooks/useThemeStyles';
import { APP_NAME, SUPPORT_URL, SUPPORT_EMAIL } from '@/lib/appConfig';
import type { LicenseStatus } from '@/types/license';

// ─── Status config ────────────────────────────────────────────────────────────

interface StatusConfig {
  icon: React.ReactNode;
  title: string;
  description: string;
  iconColor: string;
  showInput: boolean;
  showRetry: boolean;
}

function getConfig(status: LicenseStatus, daysLeft: number | null): StatusConfig {
  switch (status) {
    case 'grace_period':
      return {
        icon: <Clock className="w-8 h-8" />,
        title: 'Licença expirando',
        description: daysLeft !== null && daysLeft > 0
          ? `Sua licença expira em ${daysLeft} dia${daysLeft !== 1 ? 's' : ''}. Renove para continuar.`
          : 'Sua licença expirou. Você está no período de graça.',
        iconColor: 'text-yellow-400',
        showInput: true,
        showRetry: false,
      };
    case 'expired':
      return {
        icon: <ShieldAlert className="w-8 h-8" />,
        title: 'Licença expirada',
        description: 'Sua licença expirou e o período de graça terminou. Renove para continuar.',
        iconColor: 'text-orange-400',
        showInput: true,
        showRetry: false,
      };
    case 'revoked':
      return {
        icon: <ShieldX className="w-8 h-8" />,
        title: 'Licença revogada',
        description: 'Esta licença foi revogada. Entre em contato com o suporte.',
        iconColor: 'text-red-400',
        showInput: false,
        showRetry: false,
      };
    case 'tampered':
      return {
        icon: <ShieldX className="w-8 h-8" />,
        title: 'Licença inválida',
        description: 'Os dados de licença foram corrompidos. Reative o produto.',
        iconColor: 'text-red-500',
        showInput: true,
        showRetry: false,
      };
    case 'online_pending':
      return {
        icon: <Wifi className="w-8 h-8 animate-pulse" />,
        title: 'Verificando online...',
        description: 'Aguardando confirmação do servidor de licenças.',
        iconColor: 'text-blue-400',
        showInput: false,
        showRetry: false,
      };
    case 'offline_grace':
      return {
        icon: <WifiOff className="w-8 h-8" />,
        title: 'Modo offline',
        description: 'Sem conexão com o servidor. Usando licença em cache.',
        iconColor: 'text-slate-400',
        showInput: false,
        showRetry: true,
      };
    default:
      return {
        icon: <ShieldAlert className="w-8 h-8" />,
        title: 'Licença não encontrada',
        description: `Insira sua chave de licença para continuar usando o ${APP_NAME}.`,
        iconColor: 'text-yellow-400',
        showInput: true,
        showRetry: false,
      };
  }
}

// ─── Loading overlay (initializing / checking_fp / validating_sig) ────────────

function LoadingOverlay({ status }: { status: LicenseStatus }) {
  const messages: Partial<Record<LicenseStatus, string>> = {
    initializing: 'Inicializando...',
    checking_fp: 'Identificando dispositivo...',
    validating_sig: 'Verificando licença...',
    activating: 'Ativando licença...',
    online_pending: 'Verificando online...',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0a0f1a]/95 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4">
        <div className="relative">
          <ShieldCheck className="w-12 h-12 text-[#25D366]/30" />
          <Loader2 className="w-6 h-6 text-[#25D366] animate-spin absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
        </div>
        <p className="text-slate-400 text-sm">{messages[status] ?? 'Carregando...'}</p>
      </div>
    </div>
  );
}

// ─── Key input ────────────────────────────────────────────────────────────────

function KeyInput({
  onActivate,
  themeStyles,
}: {
  onActivate: (key: string) => Promise<{ success: boolean; message?: string }>;
  themeStyles: ReturnType<typeof useThemeStyles>;
}) {
  const [key, setKey] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const handleChange = (value: string) => {
    const clean = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const formatted = clean.match(/.{1,4}/g)?.join('-') ?? clean;
    setKey(formatted.slice(0, 19));
    setError('');
  };

  const handleSubmit = async () => {
    const raw = key.replace(/-/g, '');
    if (raw.length < 16) {
      setError('Formato inválido. Use: XXXX-XXXX-XXXX-XXXX');
      return;
    }
    setLoading(true);
    setError('');
    const result = await onActivate(key);
    setLoading(false);
    if (result.success) {
      setSuccess(true);
    } else {
      setError(result.message ?? 'Erro ao ativar licença.');
    }
  };

  if (success) {
    return (
      <div className="flex flex-col items-center gap-3 py-4" role="status" aria-live="polite">
        <CheckCircle2 style={{ color: themeStyles.accent.success }} className="w-12 h-12" aria-hidden="true" />
        <p style={{ color: themeStyles.accent.success }} className="font-medium">Licença ativada com sucesso!</p>
        <p style={{ color: themeStyles.text.secondary }} className="text-sm">O app será desbloqueado em instantes.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <label htmlFor="license-key" style={{ color: themeStyles.text.primary }} className="text-sm font-medium">
        Chave de licença
      </label>
      <div className="relative">
        <KeyRound
          style={{ color: themeStyles.text.secondary }}
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
          aria-hidden="true"
        />
        <input
          ref={inputRef}
          id="license-key"
          type="text"
          value={key}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !loading && handleSubmit()}
          placeholder="XXXX-XXXX-XXXX-XXXX"
          style={{
            backgroundColor: themeStyles.bg.tertiary,
            borderColor: themeStyles.border,
            color: themeStyles.text.primary,
          }}
          className="w-full pl-10 pr-4 py-3 border-2 rounded-lg font-mono tracking-widest text-sm focus:outline-none focus:ring-1 transition-all"
          disabled={loading}
          autoComplete="off"
          spellCheck={false}
          aria-label="Chave de licença"
          aria-describedby={error ? 'license-error' : undefined}
          aria-invalid={!!error}
        />
      </div>

      {error && (
        <div
          id="license-error"
          role="alert"
          style={{ color: '#ef4444' }}
          className="flex items-center gap-2 text-sm"
        >
          <XCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      <button
        onClick={handleSubmit}
        disabled={loading || key.replace(/-/g, '').length < 16}
        style={{ 
          backgroundColor: themeStyles.accent.success,
          color: '#ffffff',
        }}
        className="w-full py-3 rounded-lg hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed font-semibold transition-all flex items-center justify-center gap-2 focus:outline-none focus:ring-2"
        aria-busy={loading}
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            Ativando...
          </>
        ) : (
          'Ativar Licença'
        )}
      </button>

      <p style={{ color: themeStyles.text.secondary }} className="text-center text-xs">
        Não tem uma chave?{' '}
        <a
          href={SUPPORT_URL}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: themeStyles.accent.success }}
          className="hover:underline focus:outline-none focus:underline"
        >
          Adquira aqui
        </a>
      </p>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const LOADING_STATUSES: LicenseStatus[] = [
  'initializing', 'checking_fp', 'validating_sig', 'activating',
];

const BLOCKING_STATUSES: LicenseStatus[] = [
  'invalid', 'expired', 'revoked', 'tampered', 'grace_period', 'offline_grace',
];

export function LicenseGate() {
  const { info, activate, recheck, startTrial } = useLicenseContext();
  const { status, daysUntilExpiry } = info;
  const themeStyles = useThemeStyles();

  if (status === 'valid') return null;
  if (status === 'trial') return null;

  if (LOADING_STATUSES.includes(status)) {
    return <LoadingOverlay status={status} />;
  }

  // online_pending também mostra loading
  if (status === 'online_pending') {
    return <LoadingOverlay status={status} />;
  }

  if (!BLOCKING_STATUSES.includes(status)) return null;

  const config = getConfig(status, daysUntilExpiry);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="license-title"
      aria-describedby="license-desc"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm"
    >
      <div 
        style={{
          backgroundColor: themeStyles.bg.secondary,
          borderColor: themeStyles.border,
        }}
        className="w-full max-w-md mx-4 border-2 rounded-2xl shadow-2xl p-8 flex flex-col gap-6"
      >

        {/* Header */}
        <div className="flex flex-col items-center gap-3 text-center">
          <div 
            style={{
              backgroundColor: `${themeStyles.accent.primary}15`,
              borderColor: themeStyles.border,
            }}
            className={`p-3 rounded-full border-2 ${config.iconColor}`}
            aria-hidden="true"
          >
            {config.icon}
          </div>
          <h2 id="license-title" style={{ color: themeStyles.text.primary }} className="text-xl font-semibold">
            {config.title}
          </h2>
          <p id="license-desc" style={{ color: themeStyles.text.secondary }} className="text-sm">
            {config.description}
          </p>
        </div>

        {/* Grace period warning */}
        {status === 'grace_period' && daysUntilExpiry !== null && daysUntilExpiry <= 0 && (
          <div style={{ 
            backgroundColor: `#f59e0b15`,
            borderColor: '#f59e0b40',
            color: '#f59e0b',
          }} className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs">
            <Clock className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
            <span>Período de graça: o app continuará funcionando por até 5 dias após a expiração.</span>
          </div>
        )}

        {/* Input de ativação */}
        {config.showInput && <KeyInput onActivate={activate} themeStyles={themeStyles} />}

        {/* Trial option — only on invalid (first time) */}
        {status === 'invalid' && (
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-3 w-full">
              <div style={{ backgroundColor: themeStyles.border }} className="flex-1 h-px" />
              <span style={{ color: themeStyles.text.secondary }} className="text-[11px]">ou</span>
              <div style={{ backgroundColor: themeStyles.border }} className="flex-1 h-px" />
            </div>
            <button
              onClick={startTrial}
              style={{
                borderColor: `${themeStyles.accent.success}40`,
                color: themeStyles.accent.success,
              }}
              className="w-full py-2.5 rounded-lg border-2 hover:opacity-80 text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-offset-2"
            >
              Iniciar Trial Gratuito (7 dias / 50 envios)
            </button>
          </div>
        )}

        {/* Botão retry */}
        {config.showRetry && (
          <button
            onClick={recheck}
            style={{
              borderColor: themeStyles.border,
              color: themeStyles.text.primary,
            }}
            className="w-full py-3 rounded-lg border-2 hover:opacity-80 text-sm font-medium transition-all focus:outline-none focus:ring-2"
          >
            Tentar novamente
          </button>
        )}

        {/* Suporte para revoked */}
        {status === 'revoked' && (
          <p style={{ color: themeStyles.text.secondary }} className="text-center text-xs">
            Entre em contato:{' '}
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              style={{ color: themeStyles.accent.success }}
              className="hover:underline"
            >
              {SUPPORT_EMAIL}
            </a>
          </p>
        )}
      </div>
    </div>
  );
}
