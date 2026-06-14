"use client";

import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "./ui";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}

export function ConfirmDialog({
  open, title, description, confirmLabel = "Confirmar",
  onConfirm, onCancel, danger = true,
}: ConfirmDialogProps) {
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onCancel}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 8 }}
            className="relative w-full max-w-sm bg-[#0d0d0d] border border-white/10 rounded-2xl p-6 shadow-2xl"
          >
            <div className="flex items-start gap-3 mb-4">
              <div className={`p-2 rounded-xl ${danger ? "bg-red-400/10" : "bg-yellow-400/10"}`}>
                <AlertTriangle className={`w-4 h-4 ${danger ? "text-red-400" : "text-yellow-400"}`} />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-white">{title}</h3>
                <p className="text-xs text-white/40 mt-1 leading-relaxed">{description}</p>
              </div>
              <button onClick={onCancel} className="text-white/20 hover:text-white/50 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={onCancel}>Cancelar</Button>
              <button
                onClick={onConfirm}
                className={`flex-1 py-1.5 rounded-xl text-sm font-medium transition-colors ${
                  danger
                    ? "bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500/30"
                    : "bg-yellow-400/20 border border-yellow-400/40 text-yellow-400 hover:bg-yellow-400/30"
                }`}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
