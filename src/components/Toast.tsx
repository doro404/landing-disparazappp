import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, WifiOff, AlertTriangle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warn' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

const icons: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle2 className="w-4 h-4 text-wa-green flex-shrink-0" />,
  error:   <WifiOff className="w-4 h-4 text-red-400 flex-shrink-0" />,
  warn:    <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0" />,
  info:    <Info className="w-4 h-4 text-sky-400 flex-shrink-0" />,
};

const colors: Record<ToastType, string> = {
  success: 'border-wa-green/30 bg-navy-900',
  error:   'border-red-400/30 bg-navy-900',
  warn:    'border-yellow-400/30 bg-navy-900',
  info:    'border-sky-400/30 bg-navy-900',
};

function ToastEntry({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, toast.duration ?? 3500);
    return () => clearTimeout(t);
  }, []);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border shadow-xl text-sm text-wa-text max-w-xs ${colors[toast.type]}`}
    >
      {icons[toast.type]}
      <span className="flex-1 text-xs leading-snug">{toast.message}</span>
      <button onClick={onDismiss} className="text-navy-500 hover:text-navy-300 transition-colors ml-1">
        <X className="w-3.5 h-3.5" />
      </button>
    </motion.div>
  );
}

export function ToastContainer({ toasts, onDismiss }: ToastProps) {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 items-end pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <ToastEntry toast={t} onDismiss={() => onDismiss(t.id)} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
}
