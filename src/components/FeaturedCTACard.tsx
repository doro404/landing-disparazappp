import { motion } from 'framer-motion';
import { Send, ArrowRight, Zap } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { cn } from '@/lib/utils';

interface FeaturedCTACardProps {
  onCreateClick?: () => void;
  campaignCount?: number;
}

export function FeaturedCTACard({ onCreateClick, campaignCount = 0 }: FeaturedCTACardProps) {
  const { activeSessionId, sessions } = useApp();
  const activeSession = sessions.find((s) => s.id === activeSessionId);
  const isConnected = activeSession?.status === 'connected';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={isConnected ? { scale: 1.02 } : {}}
      transition={{ duration: 0.2 }}
      className={cn(
        'relative overflow-hidden rounded-2xl border-2 p-6',
        'transition-all duration-300 cursor-pointer',
        'backdrop-blur-xl',
        isConnected
          ? 'border-emerald-400/50 bg-gradient-to-br from-emerald-500/12 via-emerald-500/5 to-transparent hover:border-emerald-400/70 hover:shadow-2xl hover:shadow-emerald-500/20'
          : 'border-neutral-600/40 bg-gradient-to-br from-neutral-700/10 via-transparent to-transparent opacity-60 cursor-not-allowed'
      )}
      onClick={onCreateClick}
    >
      {/* Background accent */}
      <div className="absolute inset-0 opacity-30 pointer-events-none">
        <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-500/10 blur-3xl rounded-full" />
      </div>

      <div className="relative z-10 flex items-start justify-between">
        <div className="flex-1">
          {/* Icon + Title */}
          <div className="flex items-center gap-3 mb-3">
            <div className={cn(
              'flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center',
              'backdrop-blur-md transition-all duration-200',
              'border-2',
              isConnected
                ? 'bg-emerald-500/20 border-emerald-400/50 hover:bg-emerald-500/30 hover:border-emerald-400/70'
                : 'bg-neutral-700/20 border-neutral-600/40'
            )}>
              <Send className={cn(
                "w-6 h-6",
                isConnected ? "text-emerald-300" : "text-neutral-500"
              )} />
            </div>
            <div>
              <h3 className="text-lg font-bold">Disparo em Massa</h3>
              <p className="text-xs text-neutral-400 mt-0.5">Envie mensagens em escala</p>
            </div>
          </div>

          {/* Description */}
          <p className="text-sm mb-4 font-medium leading-relaxed">
            Criar e gerenciar campanhas de mensagens em lote com segurança e rastreamento completo.
          </p>

          {/* Status / Stats */}
          <div className="flex items-center gap-4 mb-4 text-xs">
            <div>
              <span className="text-neutral-400">Campanhas ativas:</span>
              <span className={cn(
                'ml-2 font-bold',
                campaignCount > 0 ? 'text-emerald-300' : 'text-neutral-500'
              )}>
                {campaignCount}
              </span>
            </div>
            {isConnected && (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full backdrop-blur-md border border-emerald-400/40 bg-emerald-500/15"
              >
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="w-2 h-2 rounded-full bg-emerald-400"
                />
                <span className="text-emerald-200 font-semibold">Pronto para enviar</span>
              </motion.div>
            )}
          </div>
        </div>

        {/* CTA Button */}
        <div className="flex-shrink-0 ml-4">
          <motion.button
            whileHover={isConnected ? { x: 4 } : {}}
            disabled={!isConnected}
            onClick={(e) => {
              e.stopPropagation();
              onCreateClick?.();
            }}
            className={cn(
              'px-5 py-2.5 rounded-lg font-semibold text-sm flex items-center gap-2',
              'transition-all duration-200 flex-shrink-0 backdrop-blur-md',
              'border-2',
              isConnected
                ? 'bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-white border-emerald-400/50 hover:border-emerald-300/70 shadow-lg shadow-emerald-500/40 hover:shadow-emerald-500/60'
                : 'bg-neutral-700/30 text-neutral-500 cursor-not-allowed border-neutral-600/30'
            )}
          >
            <Zap className="w-4 h-4" />
            Criar
            <ArrowRight className="w-4 h-4" />
          </motion.button>
        </div>
      </div>

      {/* Status indicator */}
      {!isConnected && (
        <div className="absolute inset-0 bg-neutral-900/40 rounded-2xl backdrop-blur-[0.5px] flex items-center justify-center pointer-events-none">
          <span className="text-xs text-neutral-400 font-semibold">Conecte uma sessão para usar</span>
        </div>
      )}
    </motion.div>
  );
}
