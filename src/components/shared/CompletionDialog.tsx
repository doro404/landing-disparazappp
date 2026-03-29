import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, Download, FileSpreadsheet, Copy, RotateCcw, X } from 'lucide-react';

export interface CompletionAction {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
}

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle: string;
  stats: { label: string; value: string | number }[];
  actions: CompletionAction[];
  accentColor?: string; // tailwind bg class e.g. 'bg-wa-green'
}

export function CompletionDialog({ open, onClose, title, subtitle, stats, actions, accentColor = 'bg-wa-green' }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          />

          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 16 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
          >
            <div className="pointer-events-auto w-full max-w-sm mx-4 rounded-2xl border border-wa-border bg-wa-bg shadow-2xl overflow-hidden">
              {/* Top accent bar */}
              <div className={`h-1 w-full ${accentColor}`} />

              <div className="p-6">
                {/* Close */}
                <button
                  onClick={onClose}
                  className="absolute top-4 right-4 w-6 h-6 flex items-center justify-center rounded text-wa-muted hover:text-white hover:bg-wa-border transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>

                {/* Icon + title */}
                <div className="flex flex-col items-center text-center gap-3 mb-5">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.1, type: 'spring', stiffness: 260, damping: 20 }}
                    className={`w-14 h-14 rounded-full ${accentColor}/15 flex items-center justify-center`}
                  >
                    <CheckCircle className={`w-7 h-7 ${accentColor === 'bg-wa-green' ? 'text-wa-green' : accentColor === 'bg-violet-500' ? 'text-violet-400' : 'text-wa-green'}`} />
                  </motion.div>
                  <div>
                    <p className="text-base font-semibold text-white">{title}</p>
                    <p className="text-xs text-wa-muted mt-0.5">{subtitle}</p>
                  </div>
                </div>

                {/* Stats */}
                {stats.length > 0 && (
                  <div className={`grid gap-2 mb-5 ${stats.length === 2 ? 'grid-cols-2' : stats.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
                    {stats.map(s => (
                      <div key={s.label} className="rounded-xl border border-wa-border bg-wa-bg p-3 text-center">
                        <p className="text-lg font-bold text-white">{s.value}</p>
                        <p className="text-[10px] text-wa-muted mt-0.5">{s.label}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-col gap-2">
                  {actions.map((action, i) => (
                    <motion.button
                      key={i}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => { action.onClick(); }}
                      className={`flex items-center justify-center gap-2 w-full py-2.5 rounded-xl font-semibold text-sm transition-colors ${
                        action.variant === 'primary'
                          ? `${accentColor} ${accentColor === 'bg-wa-green' ? 'hover:bg-wa-green text-black' : 'hover:opacity-90 text-white'}`
                          : 'bg-wa-card border border-wa-border text-wa-text hover:text-white hover:border-wa-green/30'
                      }`}
                    >
                      {action.icon}
                      {action.label}
                    </motion.button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
