import { useState, useEffect } from 'react';
import { X, ShieldOff, Trash2, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { api } from '@/lib/api';

interface DisparoBlacklistProps {
  open: boolean;
  onClose: () => void;
}

export function DisparoBlacklist({ open, onClose }: DisparoBlacklistProps) {
  const [numbers, setNumbers] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) api.blacklist.list().then((r) => setNumbers(r.numbers)).catch(() => {});
  }, [open]);

  const handleAdd = async () => {
    const toAdd = input.split(/[\n,;]+/).map((n) => n.trim().replace(/\D/g, '')).filter(Boolean);
    if (!toAdd.length) return;
    setLoading(true);
    try {
      await api.blacklist.add(toAdd);
      const r = await api.blacklist.list();
      setNumbers(r.numbers);
      setInput('');
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (n: string) => {
    await api.blacklist.remove(n);
    setNumbers((prev) => prev.filter((x) => x !== n));
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="bg-wa-card border border-wa-border rounded-2xl w-full max-w-md mx-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-wa-border">
              <div className="flex items-center gap-2 text-sm font-semibold text-wa-text">
                <ShieldOff className="w-4 h-4 text-red-400" />
                Blacklist Global ({numbers.length})
              </div>
              <button onClick={onClose} className="text-wa-muted hover:text-wa-text transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <div className="space-y-2">
                <Textarea
                  placeholder="Adicionar números (um por linha, vírgula ou ponto-e-vírgula)"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  className="h-24 text-xs font-mono"
                />
                <Button size="sm" onClick={handleAdd} disabled={loading || !input.trim()} className="w-full">
                  <Plus className="w-3.5 h-3.5" />Adicionar à blacklist
                </Button>
              </div>

              <div className="max-h-48 overflow-y-auto space-y-1">
                {numbers.length === 0 && (
                  <p className="text-xs text-wa-muted text-center py-4">Nenhum número na blacklist</p>
                )}
                {numbers.map((n) => (
                  <div key={n} className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-wa-bg/50 border border-wa-border/50">
                    <span className="text-xs font-mono text-wa-text">{n}</span>
                    <button onClick={() => handleRemove(n)} className="text-wa-muted hover:text-red-400 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
