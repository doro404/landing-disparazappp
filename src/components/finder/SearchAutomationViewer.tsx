import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Globe, RefreshCw, X, Minus, Square, Link } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

export interface SearchActivity {
  id: string;
  text: string;
  type: 'info' | 'success' | 'warn';
  ts: number;
}

interface Props {
  status: 'idle' | 'running' | 'paused' | 'done';
  keyword: string;
  currentUrl: string;
  pagesScanned: number;
  groupsFound: number;
  maxResults: number;
  activity: SearchActivity[];
}

const FAKE_SITES = [
  'groupswhats.com', 'whatsappgrouplinks.in', 'reddit.com/r/whatsapp',
  'grupos.chat', 'linkdegrupos.com', 'whatsapp-group.com',
  'forum.vivaolinux.com.br', 'telegram.me/grouplinks', 'grupos-whatsapp.net',
];

export function SearchAutomationViewer({ status, keyword, currentUrl, pagesScanned, groupsFound, maxResults, activity }: Props) {
  const [siteIdx, setSiteIdx] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isRunning = status === 'running';
  const progress = maxResults > 0 ? Math.min((groupsFound / maxResults) * 100, 100) : 0;

  useEffect(() => {
    if (!isRunning) { if (intervalRef.current) clearInterval(intervalRef.current); return; }
    intervalRef.current = setInterval(() => setSiteIdx(i => (i + 1) % FAKE_SITES.length), 2200);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isRunning]);

  const displayUrl = isRunning
    ? `https://www.google.com/search?q=${encodeURIComponent(keyword + ' whatsapp group link')}`
    : keyword ? `https://www.google.com/search?q=${encodeURIComponent(keyword)}` : 'https://www.google.com/search';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col h-full rounded-xl border border-wa-border bg-wa-bg/80 overflow-hidden"
    >
      {/* Browser chrome */}
      <div className="flex-shrink-0 bg-wa-card border-b border-wa-border">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-wa-border/60">
          <div className="flex gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500/70 flex items-center justify-center"><X className="w-1.5 h-1.5 text-red-900/60" /></span>
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/70 flex items-center justify-center"><Minus className="w-1.5 h-1.5 text-yellow-900/60" /></span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/70 flex items-center justify-center"><Square className="w-1.5 h-1.5 text-emerald-900/60" /></span>
          </div>
          <span className="text-[11px] text-wa-muted ml-2 font-medium">Group Finder — Automação</span>
          <div className="ml-auto flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${isRunning ? 'bg-violet-400 animate-pulse' : status === 'paused' ? 'bg-yellow-400' : status === 'done' ? 'bg-wa-green' : 'bg-slate-600'}`} />
            <span className="text-[10px] text-wa-text/60">
              {isRunning ? 'Buscando' : status === 'paused' ? 'Pausado' : status === 'done' ? 'Concluído' : 'Aguardando'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5">
          <RefreshCw className={`w-3 h-3 text-wa-muted flex-shrink-0 ${isRunning ? 'animate-spin' : ''}`} />
          <div className="flex-1 flex items-center gap-1.5 bg-wa-bg/60 border border-wa-border rounded-md px-2.5 py-1">
            <Globe className="w-3 h-3 text-wa-muted flex-shrink-0" />
            <span className="text-[10px] text-wa-muted/80 truncate font-mono">{currentUrl || displayUrl}</span>
          </div>
        </div>
      </div>

      {/* Viewport */}
      <div className="flex-1 overflow-hidden relative">
        {status === 'idle' ? (
          <div className="h-full flex flex-col items-center justify-center gap-3">
            <div className="w-12 h-12 rounded-full bg-wa-card border border-wa-border flex items-center justify-center">
              <Globe className="w-5 h-5 text-wa-muted" />
            </div>
            <p className="text-sm text-wa-muted">Configure e inicie a busca</p>
            <p className="text-xs text-slate-700">O navegador de automação aparecerá aqui</p>
          </div>
        ) : (
          <div className="h-full flex flex-col">
            {/* Fake Google results */}
            <div className="flex-1 overflow-hidden p-3 flex flex-col gap-2">
              <AnimatePresence initial={false}>
                {FAKE_SITES.map((site, i) => {
                  const isActive = isRunning && i === siteIdx;
                  return (
                    <motion.div
                      key={site}
                      animate={isActive ? { borderColor: 'rgba(139,92,246,0.5)', backgroundColor: 'rgba(139,92,246,0.06)' } : { borderColor: 'rgba(30,45,69,1)', backgroundColor: 'rgba(13,21,38,1)' }}
                      transition={{ duration: 0.3 }}
                      className="rounded-lg border p-2.5 flex items-start gap-2.5"
                    >
                      <div className={`w-6 h-6 rounded flex-shrink-0 flex items-center justify-center text-[9px] font-bold ${isActive ? 'bg-violet-500/20 text-violet-400' : 'bg-slate-800 text-wa-muted'}`}>
                        {site[0].toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-[11px] font-medium truncate ${isActive ? 'text-violet-300' : 'text-wa-muted/80'}`}>{site}</p>
                        <p className="text-[10px] text-wa-muted truncate">
                          {isActive ? 'Escaneando página...' : `https://${site}/whatsapp-groups`}
                        </p>
                      </div>
                      {isActive && (
                        <motion.div
                          initial={{ scale: 0 }} animate={{ scale: 1 }}
                          className="flex items-center gap-1 flex-shrink-0"
                        >
                          <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                          <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                          <div className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                        </motion.div>
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>

            {/* Scanning line */}
            {isRunning && (
              <motion.div
                animate={{ y: ['0%', '100%', '0%'] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }}
                className="absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-violet-500/40 to-transparent pointer-events-none"
              />
            )}
          </div>
        )}
      </div>

      {/* Stats + progress */}
      <div className="flex-shrink-0 border-t border-wa-border bg-wa-card px-3 py-2 flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-[10px]">
          <div className="flex items-center gap-3">
            <span className="text-wa-muted">Páginas: <span className="text-wa-text font-semibold">{pagesScanned}</span></span>
            <span className="text-wa-muted">Grupos: <span className="text-wa-green font-semibold">{groupsFound}</span></span>
          </div>
          <span className="text-wa-muted">{groupsFound} / {maxResults}</span>
        </div>
        <div className="h-1 rounded-full bg-[var(--color-borderColor)] overflow-hidden">
          <motion.div
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className={`h-full rounded-full ${status === 'done' ? 'bg-wa-green' : status === 'paused' ? 'bg-yellow-400' : 'bg-gradient-to-r from-violet-500 to-violet-400'}`}
          />
        </div>
      </div>

      {/* Activity feed */}
      <div className="flex-shrink-0 border-t border-wa-border bg-wa-bg/80" style={{ height: '7rem' }}>
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-wa-border/60">
          <Link className="w-3 h-3 text-violet-400" />
          <span className="text-[10px] text-wa-muted font-medium">Feed de atividade</span>
        </div>
        <ScrollArea className="h-[calc(7rem-28px)] px-3 py-1">
          <div className="flex flex-col gap-0.5">
            {[...activity].reverse().slice(0, 20).map(a => (
              <motion.div key={a.id} initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} className="flex items-start gap-1.5">
                <span className="text-[9px] text-slate-700 flex-shrink-0 font-mono mt-0.5">
                  {new Date(a.ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
                <span className={`text-[10px] break-all ${a.type === 'success' ? 'text-wa-green' : a.type === 'warn' ? 'text-yellow-400' : 'text-wa-muted/80'}`}>{a.text}</span>
              </motion.div>
            ))}
          </div>
        </ScrollArea>
      </div>
    </motion.div>
  );
}

