import { X, Eye } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageItem } from './DisparoForm';

interface ContactRow {
  number: string;
  vars: Record<string, string>;
}

interface DisparoPreviewProps {
  open: boolean;
  onClose: () => void;
  messages: MessageItem[];
  contact?: ContactRow;
}

function applyVars(text: string, vars: Record<string, string>): string {
  let result = text;
  for (const [k, v] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{${k}\\}`, 'gi'), v);
  }
  return result;
}

export function DisparoPreview({ open, onClose, messages, contact }: DisparoPreviewProps) {
  const vars = contact?.vars ?? {};
  const previewNumber = contact?.number ?? '5511999999999';

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
            className="bg-wa-card border border-wa-border rounded-2xl w-full max-w-sm mx-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-wa-border">
              <div className="flex items-center gap-2 text-sm font-semibold text-wa-text">
                <Eye className="w-4 h-4 text-wa-green" />
                Preview da Mensagem
              </div>
              <button onClick={onClose} className="text-wa-muted hover:text-wa-text transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Chat mockup */}
            <div className="p-4 bg-bg-secondary min-h-[200px] max-h-[60vh] overflow-y-auto space-y-2">
              <p className="text-center text-[10px] text-text-secondary mb-3">Para: {previewNumber}</p>
              {messages.map((msg, i) => {
                const text = msg.text ? applyVars(msg.text, vars) : '';
                const caption = msg.caption ? applyVars(msg.caption, vars) : '';
                const hasContent = text || msg.mediaBase64;
                if (!hasContent) return null;
                return (
                  <div key={i} className="flex justify-end">
                    <div className="bg-accent-success rounded-xl rounded-tr-sm px-3 py-2 max-w-[85%] space-y-1">
                      {msg.mediaBase64 && (
                        <div className="text-xs text-wa-muted/70 italic">
                          [{msg.mediaType}: {msg.mediaName}]
                        </div>
                      )}
                      {(text || caption) && (
                        <p className="text-sm text-wa-text whitespace-pre-wrap">{text || caption}</p>
                      )}
                      <p className="text-[10px] text-wa-muted/50 text-right">agora</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Vars info */}
            {Object.keys(vars).length > 0 && (
              <div className="px-4 py-2 border-t border-wa-border bg-wa-bg/30">
                <p className="text-[10px] text-wa-muted">
                  Variáveis: {Object.entries(vars).map(([k, v]) => `{${k}} = ${v}`).join(' • ')}
                </p>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
