/**
 * UpdateChecker.tsx
 * Verifica atualizações via license-manager API.
 * Mostra banner no topo quando há versão nova disponível.
 */
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, X, ArrowUpCircle, AlertTriangle } from 'lucide-react';
import { getVersion } from '@tauri-apps/api/app';
import { open } from '@tauri-apps/plugin-shell';
import { fetch as tauriFetch } from '@tauri-apps/plugin-http';

const API = 'https://license-manager.discloud.app';
const PRODUCT = 'dispara-zapp';

interface UpdateInfo {
  updateAvailable: boolean;
  latestVersion?: string;
  currentVersion?: string;
  url?: string | null;
  changelog?: string | null;
  force?: boolean;
  fileSize?: number;
}

function formatBytes(bytes?: number) {
  if (!bytes) return '';
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? ` · ${mb.toFixed(1)} MB` : '';
}

export function UpdateChecker() {
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [opening, setOpening] = useState(false);

  useEffect(() => {
    if (!('__TAURI_INTERNALS__' in window)) return;
    let cancelled = false;

    const check = async () => {
      try {
        const version = await getVersion();
        const res = await tauriFetch(
          `${API}/api/v1/updates?product=${PRODUCT}&currentVersion=${encodeURIComponent(version)}`,
          { method: 'GET' }
        );
        const json = await res.json() as { success: boolean; data: UpdateInfo };
        if (!cancelled && json.success && json.data.updateAvailable) {
          setInfo(json.data);
        }
      } catch {
        // offline ou API indisponível — silencioso
      }
    };

    const t = setTimeout(check, 4000); // aguarda 4s após startup
    return () => { cancelled = true; clearTimeout(t); };
  }, []);

  const handleDownload = async () => {
    if (!info?.url) return;
    setOpening(true);
    try {
      await open(info.url);
    } finally {
      setOpening(false);
    }
  };

  const visible = info?.updateAvailable && !dismissed;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -50 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className={`fixed top-0 left-0 right-0 z-[70] flex items-center justify-between gap-3 px-4 py-2.5 text-sm shadow-lg ${
            info?.force
              ? 'bg-orange-500 text-white'
              : 'bg-wa-card border-b border-wa-green/30 text-wa-text'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {info?.force
              ? <AlertTriangle className="w-4 h-4 flex-shrink-0 text-white" />
              : <ArrowUpCircle className="w-4 h-4 flex-shrink-0 text-wa-green" />
            }
            <span className="truncate font-medium">
              {info?.force
                ? `Atualização obrigatória — v${info.latestVersion}`
                : `Nova versão disponível — v${info?.latestVersion}${formatBytes(info?.fileSize)}`
              }
            </span>
            {info?.changelog && (
              <span className="hidden md:inline text-xs opacity-50 truncate max-w-xs">
                · {info.changelog.split('\n')[0]}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={handleDownload}
              disabled={opening}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                info?.force
                  ? 'bg-white text-orange-600 hover:bg-orange-50'
                  : 'bg-wa-green text-black hover:bg-wa-green/90'
              } disabled:opacity-60`}
            >
              <Download className="w-3.5 h-3.5" />
              {opening ? 'Abrindo...' : 'Baixar agora'}
            </button>

            {!info?.force && (
              <button
                onClick={() => setDismissed(true)}
                className="text-white/40 hover:text-white/70 transition-colors"
                title="Dispensar"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
