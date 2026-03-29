import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUpCircle, X, Download, AlertTriangle } from 'lucide-react';
import { getVersion } from '@tauri-apps/api/app';
import { checkForUpdate, openDownloadUrl, type UpdateInfo } from '@/lib/updater';

function formatBytes(bytes: number) {
  if (!bytes) return '';
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? ` · ${mb.toFixed(1)} MB` : ` · ${(bytes / 1024).toFixed(0)} KB`;
}

export function UpdateBanner() {
  const [info, setInfo] = useState<UpdateInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const version = await getVersion();
        const update = await checkForUpdate(version);
        if (!cancelled && update.updateAvailable) {
          setInfo(update);
        }
      } catch {
        // silencioso — não bloqueia o app
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleDownload = async () => {
    if (!info?.url) return;
    setDownloading(true);
    try {
      await openDownloadUrl(info.url);
    } finally {
      setDownloading(false);
    }
  };

  const visible = info && !dismissed;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -40 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -40 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className={`fixed top-0 left-0 right-0 z-50 flex items-center justify-between gap-3 px-4 py-2.5 text-sm shadow-lg ${
            info.force
              ? 'bg-orange-500 text-white'
              : 'bg-wa-card border-b border-wa-green/30 text-wa-text'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {info.force
              ? <AlertTriangle className="w-4 h-4 flex-shrink-0 text-white" />
              : <ArrowUpCircle className="w-4 h-4 flex-shrink-0 text-wa-green" />
            }
            <span className="truncate">
              {info.force
                ? `Atualização obrigatória disponível — v${info.latestVersion}`
                : `Nova versão disponível — v${info.latestVersion}${formatBytes(info.fileSize ?? 0)}`
              }
            </span>
            {info.changelog && (
              <span className="hidden md:inline text-xs opacity-60 truncate max-w-xs">
                · {info.changelog.split('\n')[0]}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={handleDownload}
              disabled={downloading}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                info.force
                  ? 'bg-white text-orange-600 hover:bg-orange-50'
                  : 'bg-wa-green text-black hover:bg-wa-green/90'
              } disabled:opacity-60`}
            >
              <Download className="w-3.5 h-3.5" />
              {downloading ? 'Abrindo...' : 'Baixar agora'}
            </button>

            {!info.force && (
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
