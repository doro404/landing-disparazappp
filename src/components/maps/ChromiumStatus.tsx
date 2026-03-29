import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, Trash2, CheckCircle, AlertTriangle, Loader2, ChevronDown, ChevronUp, X } from 'lucide-react';

const SIDECAR = 'http://127.0.0.1:3001';

type Status = 'checking' | 'installed' | 'not_installed' | 'installing' | 'uninstalling' | 'error';

interface Props {
  /** Chamado quando o status muda — pai pode bloquear o botão Start */
  onStatusChange?: (installed: boolean) => void;
}

export function ChromiumStatus({ onStatusChange }: Props) {
  const [status, setStatus] = useState<Status>('checking');
  const [logs, setLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const esRef = useRef<EventSource | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  // Estabiliza o callback para não recriar `check` a cada render
  const onStatusChangeRef = useRef(onStatusChange);
  useEffect(() => { onStatusChangeRef.current = onStatusChange; }, [onStatusChange]);

  const check = useCallback(async () => {
    setStatus('checking');
    try {
      const r = await fetch(`${SIDECAR}/maps/chromium-status`);
      const { installed } = await r.json();
      setStatus(installed ? 'installed' : 'not_installed');
      onStatusChangeRef.current?.(installed);
    } catch {
      setStatus('error');
      setErrorMsg('Sidecar não disponível');
      onStatusChangeRef.current?.(false);
    }
  }, []);

  useEffect(() => { check(); }, [check]);

  useEffect(() => {
    if (showLogs) logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs, showLogs]);

  const install = useCallback(() => {
    if (esRef.current) { esRef.current.close(); esRef.current = null; }
    setStatus('installing');
    setLogs([]);
    setShowLogs(true);

    const es = new EventSource(`${SIDECAR}/maps/chromium-install`, { withCredentials: false });
    // EventSource não suporta POST nativamente — usamos fetch + ReadableStream
    es.close();

    // Usa fetch com streaming manual
    fetch(`${SIDECAR}/maps/chromium-install`, { method: 'POST' })
      .then(async (res) => {
        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let buf = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const parts = buf.split('\n\n');
          buf = parts.pop() ?? '';
          for (const part of parts) {
            const lines = part.split('\n');
            let event = 'message', data = '';
            for (const line of lines) {
              if (line.startsWith('event:')) event = line.slice(6).trim();
              if (line.startsWith('data:')) data = line.slice(5).trim();
            }
            if (!data) continue;
            const parsed = JSON.parse(data);
            if (event === 'log') {
              setLogs(prev => [...prev, parsed.msg]);
            } else if (event === 'done') {
              if (parsed.success) {
                setStatus('installed');
                onStatusChangeRef.current?.(true);
                setLogs(prev => [...prev, '✓ Chromium instalado com sucesso!']);
              } else {
                setStatus('not_installed');
                setErrorMsg(parsed.error || 'Falha na instalação');
                setLogs(prev => [...prev, `✗ Erro: ${parsed.error}`]);
              }
            }
          }
        }
      })
      .catch((err) => {
        setStatus('not_installed');
        setErrorMsg(err.message);
        setLogs(prev => [...prev, `✗ ${err.message}`]);
      });
  }, []);

  const uninstall = useCallback(async () => {
    if (!confirm('Remover o Chromium? Isso desativará o extrator do Google Maps.')) return;
    setStatus('uninstalling');
    try {
      const r = await fetch(`${SIDECAR}/maps/chromium-uninstall`, { method: 'DELETE' });
      const { ok, error } = await r.json();
      if (ok) {
        setStatus('not_installed');
        onStatusChangeRef.current?.(false);
      } else {
        setStatus('installed');
        setErrorMsg(error || 'Falha ao remover');
      }
    } catch (e) {
      setStatus('installed');
      setErrorMsg(e instanceof Error ? e.message : String(e));
    }
  }, []);

  if (status === 'checking') return null;

  const isInstalled = status === 'installed';
  const isInstalling = status === 'installing';
  const isUninstalling = status === 'uninstalling';
  const busy = isInstalling || isUninstalling;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        className={`rounded-lg border px-3 py-2 text-xs flex flex-col gap-1.5 ${
          isInstalled
            ? 'border-emerald-500/20 bg-emerald-500/5'
            : status === 'error'
            ? 'border-slate-600/30 bg-slate-800/30'
            : 'border-yellow-500/30 bg-yellow-500/5'
        }`}
      >
        {/* Main row */}
        <div className="flex items-center gap-2">
          {busy ? (
            <Loader2 className="w-3.5 h-3.5 text-blue-400 animate-spin flex-shrink-0" />
          ) : isInstalled ? (
            <CheckCircle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
          ) : (
            <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" />
          )}

          <span className={`flex-1 ${isInstalled ? 'text-emerald-300' : busy ? 'text-blue-300' : 'text-yellow-300'}`}>
            {isInstalling
              ? 'Instalando Chromium...'
              : isUninstalling
              ? 'Removendo Chromium...'
              : isInstalled
              ? 'Chromium instalado'
              : status === 'error'
              ? `Sidecar offline — ${errorMsg}`
              : 'Chromium não instalado — extrator indisponível'}
          </span>

          {/* Buttons */}
          {!busy && !isInstalled && status !== 'error' && (
            <button
              onClick={install}
              className="flex items-center gap-1 px-2 py-1 rounded bg-blue-600 hover:bg-blue-500 text-wa-text transition-colors"
            >
              <Download className="w-3 h-3" />
              Instalar (~150 MB)
            </button>
          )}

          {!busy && isInstalled && (
            <button
              onClick={uninstall}
              className="flex items-center gap-1 px-2 py-1 rounded bg-red-900/60 hover:bg-red-800/80 text-red-300 hover:text-red-200 border border-red-700/40 transition-colors"
            >
              <Trash2 className="w-3 h-3" />
              Desinstalar
            </button>
          )}

          {/* Toggle logs */}
          {(isInstalling || logs.length > 0) && (
            <button
              onClick={() => setShowLogs(v => !v)}
              className="text-wa-muted hover:text-wa-text transition-colors"
            >
              {showLogs ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          )}

          {/* Dismiss error */}
          {status === 'error' && (
            <button onClick={check} className="text-wa-muted hover:text-wa-text transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Log panel */}
        <AnimatePresence>
          {showLogs && logs.length > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="max-h-32 overflow-y-auto rounded bg-black/40 border border-wa-border p-2 font-mono text-[10px] text-wa-muted/80 space-y-0.5">
                {logs.map((l, i) => (
                  <div key={i} className={l.startsWith('✓') ? 'text-emerald-400' : l.startsWith('✗') ? 'text-red-400' : ''}>
                    {l}
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
}

