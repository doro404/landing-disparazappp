import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { ScrollArea } from './ui/scroll-area';
import { useApp } from '@/context/AppContext';

const MAX_VISIBLE = 200;

export function LogTerminal() {
  const { logs, clearLogs } = useApp();
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!expanded) return;
    const root = scrollAreaRef.current;
    if (!root) return;
    const viewport = root.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement | null;
    if (viewport) viewport.scrollTop = viewport.scrollHeight;
  }, [logs, expanded]);

  const levelColor = {
    info: 'text-wa-teal',
    success: 'text-wa-green',
    error: 'text-red-400',
    warn: 'text-yellow-400',
  };

  const levelPrefix = {
    info: '[INFO]',
    success: '[OK]  ',
    error: '[ERR] ',
    warn: '[WARN]',
  };

  const visibleLogs = logs.slice(-MAX_VISIBLE);
  const lastLog = logs[logs.length - 1];

  return (
    <div className="card-wa flex flex-col overflow-hidden">
      {/* Header — sempre visível, clicável para expandir */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-wa-green flex-shrink-0" />
          <span className="text-sm font-medium text-wa-text">Log em Tempo Real</span>
          <span className="text-xs text-wa-text/70">({logs.length})</span>
          {/* Preview da última linha quando minimizado */}
          {!expanded && lastLog && (
            <span className={`text-xs font-mono truncate max-w-xs ${levelColor[lastLog.level]}`}>
              {levelPrefix[lastLog.level]} {lastLog.message}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {expanded && (
            <button
              onClick={(e) => { e.stopPropagation(); clearLogs(); }}
              className="text-xs text-wa-muted hover:text-red-400 flex items-center gap-1 transition-colors"
            >
              <Trash2 className="w-3 h-3" />Limpar
            </button>
          )}
          {expanded
            ? <ChevronDown className="w-4 h-4 text-wa-muted" />
            : <ChevronUp className="w-4 h-4 text-wa-muted" />}
        </div>
      </button>

      {/* Conteúdo expansível */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: '11rem', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden mt-2"
          >
            <ScrollArea ref={scrollAreaRef} className="h-full">
              <div className="space-y-0.5 font-mono text-xs pr-2">
                {visibleLogs.length === 0 ? (
                  <p className="text-wa-muted italic">Aguardando eventos...</p>
                ) : (
                  visibleLogs.map((log) => (
                    <motion.div
                      key={log.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex gap-2 leading-5"
                    >
                      <span className="text-wa-muted flex-shrink-0">
                        {new Date(log.ts).toLocaleTimeString('pt-BR')}
                      </span>
                      <span className={`flex-shrink-0 ${levelColor[log.level]}`}>
                        {levelPrefix[log.level]}
                      </span>
                      <span className="text-wa-text break-all">{log.message}</span>
                    </motion.div>
                  ))
                )}
              </div>
            </ScrollArea>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
