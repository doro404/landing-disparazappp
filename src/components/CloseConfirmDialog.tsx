import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import * as Dialog from '@radix-ui/react-dialog';
import { LogOut, Minimize2, X } from 'lucide-react';

declare global { interface Window { __TAURI_INTERNALS__?: unknown } }

export function CloseConfirmDialog() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Só registra o listener se estiver rodando dentro do Tauri
    if (!window.__TAURI_INTERNALS__) return;
    let unlisten: (() => void) | null = null;
    listen('close-requested', () => setOpen(true))
      .then(fn => { unlisten = fn; })
      .catch(() => {});
    return () => { unlisten?.(); };
  }, []);

  const handleMinimize = async () => {
    setOpen(false);
    await invoke('hide_window').catch(() => {});
  };

  const handleQuit = async () => {
    setOpen(false);
    await invoke('quit_app').catch(() => {});
  };

  const handleCancel = () => setOpen(false);

  return (
    <Dialog.Root open={open} onOpenChange={(v) => { if (!v) handleCancel(); }}>
      <Dialog.Portal>
        {/* Overlay */}
        <Dialog.Overlay className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />

        {/* Conteúdo */}
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          <div className="bg-wa-card border border-wa-border rounded-2xl shadow-2xl p-6 space-y-5">

            {/* Ícone + Título */}
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-wa-teal/20 border border-wa-teal/30 flex items-center justify-center flex-shrink-0">
                <X className="w-6 h-6 text-wa-teal" />
              </div>
              <div className="flex-1">
                <Dialog.Title className="text-base font-semibold text-wa-text">
                  Fechar o Dispara Zapp?
                </Dialog.Title>
                <Dialog.Description className="text-sm text-wa-muted mt-1 leading-relaxed">
                  O robô pode continuar funcionando em segundo plano — disparos periódicos e sessões WhatsApp ativas continuarão rodando.
                </Dialog.Description>
              </div>
            </div>

            {/* Separador */}
            <div className="border-t border-wa-border/50" />

            {/* Botões */}
            <div className="flex flex-col gap-2">
              {/* Minimizar para bandeja — ação principal */}
              <button
                onClick={handleMinimize}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-wa-medium hover:bg-wa-medium/80 text-white font-medium text-sm transition-colors"
              >
                <Minimize2 className="w-4 h-4 flex-shrink-0" />
                <div className="text-left">
                  <p className="font-semibold">Minimizar para a bandeja</p>
                  <p className="text-xs text-white/70 font-normal">O robô continua rodando em segundo plano</p>
                </div>
              </button>

              {/* Sair completamente */}
              <button
                onClick={handleQuit}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 font-medium text-sm transition-colors"
              >
                <LogOut className="w-4 h-4 flex-shrink-0" />
                <div className="text-left">
                  <p className="font-semibold">Sair completamente</p>
                  <p className="text-xs text-red-400/70 font-normal">Encerra o app e todas as sessões</p>
                </div>
              </button>

              {/* Cancelar */}
              <button
                onClick={handleCancel}
                className="w-full px-4 py-2.5 rounded-xl text-wa-muted hover:text-wa-text hover:bg-wa-border/30 text-sm transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
