import { AnimatePresence, motion } from 'framer-motion';
import { Loader2, Wifi, WifiOff, QrCode, Plus, LogOut, Zap } from 'lucide-react';
import { Session } from '@/types';
import { cn } from '@/lib/utils';

const STATUS = {
  not_found: {
    label: 'Desconectado',
    dot: 'bg-wa-muted/40',
    icon: WifiOff,
    iconCls: 'text-wa-muted',
    textCls: 'text-wa-muted',
    spin: false,
  },
  connecting: {
    label: 'Conectando…',
    dot: 'bg-amber-400 animate-pulse',
    icon: Loader2,
    iconCls: 'text-amber-500',
    textCls: 'text-amber-500',
    spin: true,
  },
  qr: {
    label: 'Aguard. QR',
    dot: 'bg-amber-400 animate-pulse',
    icon: QrCode,
    iconCls: 'text-amber-500',
    textCls: 'text-amber-500',
    spin: false,
  },
  connected: {
    label: 'Online',
    dot: 'bg-emerald-500',
    icon: Wifi,
    iconCls: 'text-emerald-500',
    textCls: 'text-emerald-600',
    spin: false,
  },
  disconnected: {
    label: 'Desconectado',
    dot: 'bg-wa-muted/40',
    icon: WifiOff,
    iconCls: 'text-wa-muted',
    textCls: 'text-wa-muted',
    spin: false,
  },
  qr_timeout: {
    label: 'QR expirado',
    dot: 'bg-orange-400',
    icon: QrCode,
    iconCls: 'text-orange-500',
    textCls: 'text-orange-500',
    spin: false,
  },
} as const;

interface SessionItemProps {
  session: Session;
  index: number;
  isActive: boolean;
  isBulkRunning: boolean;
  onSelect: (id: string) => void;
  onQrClick: (id: string) => void;
  onConnect: (id: string) => void;
  onDisconnect: (id: string) => void;
}

export function SessionItem({
  session, index, isActive, isBulkRunning,
  onSelect, onQrClick, onConnect, onDisconnect,
}: SessionItemProps) {
  const cfg = STATUS[session.status];
  const Icon = cfg.icon;

  return (
    <button
      onClick={() => onSelect(session.id)}
      className={cn(
        'group w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left',
        'transition-colors duration-150 focus:outline-none',
        isActive
          ? 'bg-emerald-500/8 ring-1 ring-emerald-500/20'
          : 'hover:bg-wa-border/30'
      )}
    >
      {/* Icon container */}
      <div className={cn(
        'flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center',
        isActive ? 'bg-emerald-500/10' : 'bg-wa-border/40'
      )}>
        <Icon
          className={cn('w-4 h-4', cfg.iconCls, cfg.spin && 'animate-spin')}
          strokeWidth={1.5}
        />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className={cn(
          'text-xs font-semibold truncate leading-tight',
          isActive ? 'text-wa-text' : 'text-wa-text/80'
        )}>
          {session.user?.name || `Conta ${index + 1}`}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', cfg.dot)} />
          <span className={cn('text-[10px] font-medium', cfg.textCls)}>
            {cfg.label}
          </span>
        </div>
      </div>

      {/* Bulk badge */}
      <AnimatePresence>
        {isBulkRunning && (
          <motion.span
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="flex-shrink-0 flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/10 ring-1 ring-emerald-500/20"
          >
            <Zap className="w-2.5 h-2.5 text-emerald-500" strokeWidth={1.5} />
            <span className="text-[9px] font-bold text-emerald-600">ATIVO</span>
          </motion.span>
        )}
      </AnimatePresence>

      {/* Hover actions */}
      <div className="hidden group-hover:flex items-center gap-0.5 flex-shrink-0">
        {session.status === 'qr' && (
          <button
            onClick={(e) => { e.stopPropagation(); onQrClick(session.id); }}
            className="w-6 h-6 rounded flex items-center justify-center hover:bg-amber-500/10 text-amber-500 transition-colors"
            title="Ver QR Code"
          >
            <QrCode className="w-3.5 h-3.5" strokeWidth={1.5} />
          </button>
        )}
        {(session.status === 'not_found' || session.status === 'disconnected' || session.status === 'qr_timeout') && (
          <button
            onClick={(e) => { e.stopPropagation(); onConnect(session.id); }}
            className="w-6 h-6 rounded flex items-center justify-center hover:bg-emerald-500/10 text-emerald-500 transition-colors"
            title="Conectar"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
          </button>
        )}
        {session.status === 'connected' && (
          <button
            onClick={(e) => { e.stopPropagation(); onDisconnect(session.id); }}
            className="w-6 h-6 rounded flex items-center justify-center hover:bg-red-500/10 text-red-400 transition-colors"
            title="Desconectar"
          >
            <LogOut className="w-3.5 h-3.5" strokeWidth={1.5} />
          </button>
        )}
      </div>
    </button>
  );
}
