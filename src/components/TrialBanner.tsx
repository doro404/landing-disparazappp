import { useState } from 'react';
import { Clock, X, KeyRound, Zap, ShieldCheck, Loader2, CheckCircle2, XCircle, ExternalLink } from 'lucide-react';
import { useLicenseContext } from '@/context/LicenseContext';
import { SUPPORT_URL } from '@/lib/appConfig';
import { TRIAL_SEND_LIMIT } from '@/lib/trial';

// ─── Mini modal de ativação ───────────────────────────────────────────────────
function ActivateModal({ onClose }: { onClose: () => void }) {
  const { activate } = useLicenseContext();
  const [key, setKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  function handleChange(v: string) {
    const clean = v.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const formatted = clean.match(/.{1,4}/g)?.join('-') ?? clean;
    setKey(formatted.slice(0, 19));
    setError('');
  }

  async function handleSubmit() {
    const raw = key.replace(/-/g, '');
    if (raw.length < 16) { setError('Formato inválido. Use: XXXX-XXXX-XXXX-XXXX'); return; }
    setLoading(true);
    const result = await activate(key);
    setLoading(false);
    if (result.success) {
      setSuccess(true);
      setTimeout(onClose, 1800);
    } else {
      setError(result.message ?? 'Erro ao ativar licença.');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-wa-card border border-wa-border rounded-2xl p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-wa-green" />
            <h3 className="text-sm font-semibold text-wa-text">Ativar Licença</h3>
          </div>
          <button onClick={onClose} className="text-wa-muted hover:text-wa-muted/80 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {success ? (
          <div className="flex flex-col items-center gap-3 py-4">
            <CheckCircle2 className="w-10 h-10 text-wa-green" />
            <p className="text-wa-green font-medium text-sm">Licença ativada!</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="relative">
              <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-wa-muted" />
              <input
                type="text"
                value={key}
                onChange={(e) => handleChange(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !loading && handleSubmit()}
                placeholder="XXXX-XXXX-XXXX-XXXX"
                autoFocus
                className="w-full pl-9 pr-4 py-2.5 bg-wa-bg/60 border border-wa-border rounded-lg text-wa-text placeholder-wa-muted/40 font-mono tracking-widest text-sm focus:outline-none focus:border-wa-green transition-all"
                disabled={loading}
              />
            </div>

            {error && (
              <div className="flex items-center gap-1.5 text-red-400 text-xs">
                <XCircle className="w-3.5 h-3.5 shrink-0" />
                {error}
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={loading || key.replace(/-/g, '').length < 16}
              className="w-full py-2.5 rounded-lg bg-wa-green hover:bg-wa-green disabled:opacity-40 disabled:cursor-not-allowed text-wa-text font-semibold text-sm transition-all flex items-center justify-center gap-2"
            >
              {loading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Ativando...</> : 'Ativar Licença'}
            </button>

            <p className="text-center text-xs text-wa-muted">
              Não tem uma chave?{' '}
              <a
                href={SUPPORT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-wa-green hover:underline inline-flex items-center gap-0.5"
              >
                Compre sua licença <ExternalLink className="w-3 h-3" />
              </a>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Banner ───────────────────────────────────────────────────────────────────
export function TrialBanner() {
  const { info } = useLicenseContext();
  const [dismissed, setDismissed] = useState(false);
  const [showActivate, setShowActivate] = useState(false);

  if (dismissed) return null;

  // ── Licença ativa ────────────────────────────────────────────────────────
  if (info.status === 'valid' || info.status === 'grace_period') {
    const expDate = info.expiresAt
      ? new Date(info.expiresAt * 1000).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
      : null;
    const isGrace = info.status === 'grace_period';
    const isExpiringSoon = info.daysUntilExpiry !== null && info.daysUntilExpiry <= 7;

    return (
      <div
        className={`flex-shrink-0 flex items-center gap-3 px-4 py-1.5 text-xs border-0 ${
          isGrace
            ? 'bg-orange-500/8 text-orange-300'
            : isExpiringSoon
            ? 'bg-yellow-500/8 text-yellow-300'
            : 'bg-wa-green/6 text-wa-green'
        }`}
      >
        <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="font-medium">Licença Ativa</span>
        {info.key && (
          <span className="text-wa-muted font-mono">
            {info.key.slice(0, 4)}···{info.key.slice(-4)}
          </span>
        )}
        {expDate && (
          <>
            <div className="w-px h-3 bg-[var(--color-borderColor)]" />
            <span className="text-wa-muted/80 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Expira em {expDate}
              {info.daysUntilExpiry !== null && info.daysUntilExpiry > 0 && (
                <span className={`ml-1 ${isExpiringSoon ? 'text-yellow-400' : 'text-wa-muted'}`}>
                  ({info.daysUntilExpiry}d)
                </span>
              )}
            </span>
          </>
        )}
        {!expDate && (
          <>
            <div className="w-px h-3 bg-[var(--color-borderColor)]" />
            <span className="text-wa-muted">Sem expiração</span>
          </>
        )}
        {isGrace && (
          <span className="ml-1 px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-400 text-[10px] font-medium">
            Período de graça
          </span>
        )}
        <button onClick={() => setDismissed(true)} className="ml-auto text-slate-700 hover:text-wa-muted transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  // ── Trial ────────────────────────────────────────────────────────────────
  if (info.status === 'trial') {
    const { trialSendsLeft, trialDaysLeft } = info;
    const sendsUsed = TRIAL_SEND_LIMIT - trialSendsLeft;
    const pct = Math.min(100, (sendsUsed / TRIAL_SEND_LIMIT) * 100);
    const isLow = trialSendsLeft <= 10 || trialDaysLeft <= 1;

    return (
      <>
        <div className={`flex-shrink-0 flex items-center gap-3 px-4 py-1.5 text-xs border-b ${
          isLow
            ? 'bg-orange-500/10 border-orange-500/20 text-orange-300'
            : 'bg-wa-green/8 border-wa-green/15 text-wa-green'
        }`}>
          <Clock className="w-3.5 h-3.5 flex-shrink-0" />
          <span className="font-medium">Trial</span>
          <span className="text-wa-muted/80">
            {trialDaysLeft} dia{trialDaysLeft !== 1 ? 's' : ''} restante{trialDaysLeft !== 1 ? 's' : ''}
          </span>
          <div className="flex items-center gap-1.5 max-w-[140px] flex-1">
            <div className="flex-1 h-1 bg-[var(--color-borderColor)] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${isLow ? 'bg-orange-400' : 'bg-wa-green'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-wa-muted/80 flex-shrink-0 flex items-center gap-0.5">
              <Zap className="w-2.5 h-2.5" />{trialSendsLeft}
            </span>
          </div>
          <button
            onClick={() => setShowActivate(true)}
            className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-wa-green/15 text-wa-green hover:bg-wa-green/25 transition-colors font-medium ml-auto"
          >
            <KeyRound className="w-3 h-3" />
            Ativar
          </button>
          <button onClick={() => setDismissed(true)} className="text-slate-700 hover:text-wa-muted transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        {showActivate && <ActivateModal onClose={() => setShowActivate(false)} />}
      </>
    );
  }

  return null;
}
