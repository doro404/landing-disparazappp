import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal, Trash } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

export interface LogLine {
  id: string;
  level: 'info' | 'success' | 'warn' | 'error';
  message: string;
  ts: number;
}

interface Props {
  logs: LogLine[];
  onClear: () => void;
}

const LEVEL_COLOR: Record<LogLine['level'], string> = {
  info: 'text-sky-400',
  success: 'text-wa-green',
  warn: 'text-yellow-400',
  error: 'text-red-400',
};

const LEVEL_LABEL: Record<LogLine['level'], string> = {
  info: '[INFO   ]',
  success: '[SUCESSO]',
  warn: '[AVISO  ]',
  error: '[ERRO   ]',
};

export function ExtractorLogs({ logs, onClear }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    const viewport = root.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement | null;
    if (viewport) viewport.scrollTop = viewport.scrollHeight;
  }, [logs]);

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-950 flex flex-col overflow-hidden" style={{ height: '9rem' }}>
      <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-800 bg-neutral-900/80 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
            <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/70" />
          </div>
          <Terminal className="w-3.5 h-3.5 text-red-400 ml-1" />
          <span className="text-xs font-mono text-red-400/80">maps-extractor</span>
          <span className="text-xs font-mono text-neutral-600">— {logs.length} entradas</span>
        </div>
        <button onClick={onClear} className="text-neutral-600 hover:text-red-400 transition-colors" title="Limpar">
          <Trash className="w-3.5 h-3.5" />
        </button>
      </div>
      <ScrollArea ref={scrollRef} className="flex-1 p-3">
        <div className="space-y-0.5 font-mono text-xs">
          {logs.length === 0 ? (
            <p className="text-neutral-600 italic">
              <span className="text-red-700">$</span> aguardando início da extração...
            </p>
          ) : (
            <AnimatePresence initial={false}>
              {logs.map(log => (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex gap-2 leading-5"
                >
                  <span className="text-neutral-600 flex-shrink-0 select-none">
                    {new Date(log.ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                  <span className={`flex-shrink-0 font-semibold ${LEVEL_COLOR[log.level]}`}>
                    {LEVEL_LABEL[log.level]}
                  </span>
                  <span className="break-all">{log.message}</span>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

