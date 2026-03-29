import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QrCode, Hash, Smartphone, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { useApp } from '@/context/AppContext';
import { api } from '@/lib/api';

const QR_TTL_MS = 20_000; // Baileys regenera QR a cada ~20s

interface QrModalProps {
  sessionId: string | null;
  open: boolean;
  onClose: () => void;
}

export function QrModal({ sessionId, open, onClose }: QrModalProps) {
  const { sessions, connectSession } = useApp();
  const [mode, setMode] = useState<'qr' | 'pairing'>('qr');
  const [phone, setPhone] = useState('');
  const [pairingCode, setPairingCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Controle de expiração do QR
  const [qrProgress, setQrProgress] = useState(100); // 100 → 0
  const [refreshing, setRefreshing] = useState(false);
  const qrTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const qrStartRef = useRef<number>(0);
  const prevQrRef = useRef<string | undefined>(undefined);

  const session = sessions.find((s) => s.id === sessionId);

  // Detecta QR novo → reinicia countdown
  useEffect(() => {
    if (!session?.qr) return;
    if (session.qr === prevQrRef.current) return;

    // QR mudou
    if (prevQrRef.current) {
      // Não era o primeiro — mostra "atualizando" brevemente
      setRefreshing(true);
      setTimeout(() => setRefreshing(false), 600);
    }
    prevQrRef.current = session.qr;
    qrStartRef.current = Date.now();
    setQrProgress(100);

    // Countdown de expiração
    if (qrTimerRef.current) clearInterval(qrTimerRef.current);
    qrTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - qrStartRef.current;
      const remaining = Math.max(0, 100 - (elapsed / QR_TTL_MS) * 100);
      setQrProgress(remaining);
      if (remaining === 0 && qrTimerRef.current) {
        clearInterval(qrTimerRef.current);
      }
    }, 200);

    return () => {
      if (qrTimerRef.current) clearInterval(qrTimerRef.current);
    };
  }, [session?.qr]);

  // Detecta conexão → tela de sucesso
  useEffect(() => {
    if (session?.status === 'connected' && open) {
      if (qrTimerRef.current) clearInterval(qrTimerRef.current);
      setShowSuccess(true);
      const timer = setTimeout(() => {
        setShowSuccess(false);
        onClose();
      }, 2200);
      return () => clearTimeout(timer);
    }
  }, [session?.status, open]);

  // Reset ao abrir
  useEffect(() => {
    if (open) {
      setShowSuccess(false);
      setPairingCode('');
      setPhone('');
      setMode('qr');
      prevQrRef.current = undefined;
      setQrProgress(100);
      setRefreshing(false);
    } else {
      if (qrTimerRef.current) clearInterval(qrTimerRef.current);
    }
  }, [open]);

  const handleRequestPairing = async () => {
    if (!sessionId || !phone) return;
    setLoading(true);
    try {
      const res = await api.sessions.pairingCode(sessionId, phone);
      setPairingCode(res.code);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const sessionIndex = sessions.findIndex((s) => s.id === sessionId);
  const sessionLabel = session?.user?.name || `Conta ${sessionIndex + 1}`;

  // Cor da barra de progresso: verde → amarelo → vermelho
  const progressColor =
    qrProgress > 50 ? '#25D366' : qrProgress > 25 ? '#f59e0b' : '#ef4444';

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !showSuccess && onClose()}>
      <DialogContent className="max-w-sm overflow-hidden p-0">
        <AnimatePresence mode="wait">
          {showSuccess ? (
            /* ── Tela de sucesso ── */
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="flex flex-col items-center justify-center gap-5 py-12 px-8"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.1, type: 'spring', stiffness: 400, damping: 20 }}
                className="w-20 h-20 rounded-full bg-wa-green/20 border-2 border-wa-green flex items-center justify-center"
              >
                <CheckCircle2 className="w-10 h-10 text-wa-green" />
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="text-center space-y-1"
              >
                <p className="text-lg font-semibold text-wa-text">Conectado!</p>
                <p className="text-sm text-wa-muted">{sessionLabel}</p>
              </motion.div>
              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: 0.3, duration: 1.8, ease: 'linear' }}
                className="w-32 h-1 rounded-full bg-wa-green origin-left"
              />
            </motion.div>
          ) : (
            /* ── Tela de QR / Pairing ── */
            <motion.div
              key="qr"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-6 space-y-4"
            >
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <QrCode className="w-5 h-5 text-wa-green" />
                  Conectar WhatsApp
                  <span className="text-wa-muted text-sm font-normal ml-auto">Conta {sessionIndex + 1}</span>
                </DialogTitle>
              </DialogHeader>

              {/* Tabs */}
              <div className="flex gap-2">
                {(['qr', 'pairing'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all duration-200 flex items-center justify-center gap-1.5 ${
                      mode === m
                        ? 'bg-wa-medium text-white shadow-md'
                        : 'bg-wa-card border border-wa-border text-wa-text'
                    }`}
                  >
                    {m === 'qr' ? <QrCode className="w-3.5 h-3.5" /> : <Hash className="w-3.5 h-3.5" />}
                    {m === 'qr' ? 'QR Code' : 'Código'}
                  </button>
                ))}
              </div>

              <AnimatePresence mode="wait">
                {mode === 'qr' ? (
                  <motion.div
                    key="qr-panel"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    className="flex flex-col items-center gap-3"
                  >
                    {/* QR Box */}
                    <div className="relative">
                      {session?.qr ? (
                        <div className="relative">
                          {/* QR image — crossfade suave sem escala */}
                          <motion.div
                            key={session.qr}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: refreshing ? 0.4 : 1 }}
                            transition={{ duration: 0.3 }}
                            className="p-3 bg-white rounded-2xl shadow-xl shadow-wa-green/10 border-4 border-wa-green/20"
                          >
                            <img src={session.qr} alt="QR Code" className="w-52 h-52 rounded-lg" />
                          </motion.div>

                          {/* Overlay "atualizando" */}
                          <AnimatePresence>
                            {refreshing && (
                              <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/40"
                              >
                                <div className="flex flex-col items-center gap-2">
                                  <RefreshCw className="w-6 h-6 text-white animate-spin" />
                                  <span className="text-xs text-white font-medium">Atualizando...</span>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>

                          {/* Cantos decorativos */}
                          <div className="absolute -top-1 -left-1 w-5 h-5 border-t-2 border-l-2 border-wa-green rounded-tl-lg" />
                          <div className="absolute -top-1 -right-1 w-5 h-5 border-t-2 border-r-2 border-wa-green rounded-tr-lg" />
                          <div className="absolute -bottom-1 -left-1 w-5 h-5 border-b-2 border-l-2 border-wa-green rounded-bl-lg" />
                          <div className="absolute -bottom-1 -right-1 w-5 h-5 border-b-2 border-r-2 border-wa-green rounded-br-lg" />
                        </div>
                      ) : (
                        <div className="w-52 h-52 bg-wa-border/20 rounded-2xl border-2 border-dashed border-wa-border flex flex-col items-center justify-center gap-3">
                          {session?.status === 'connecting' ? (
                            <>
                              <Loader2 className="w-8 h-8 text-wa-green animate-spin" />
                              <p className="text-xs text-wa-muted">Gerando QR Code...</p>
                            </>
                          ) : session?.status === 'qr_timeout' ? (
                            <>
                              <QrCode className="w-10 h-10 text-orange-400/60" />
                              <p className="text-xs text-orange-400 text-center px-4 font-medium">QR não escaneado</p>
                              <p className="text-[10px] text-wa-muted text-center px-4">Clique em Tentar Novamente</p>
                            </>
                          ) : (
                            <>
                              <QrCode className="w-10 h-10 text-wa-muted" />
                              <p className="text-xs text-wa-muted text-center px-4">Clique em Conectar para gerar o QR</p>
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Barra de expiração */}
                    {session?.qr && (
                      <div className="w-full space-y-1">
                        <div className="flex items-center justify-between text-[10px] text-wa-muted">
                          <span>QR válido por</span>
                          <span style={{ color: progressColor }}>
                            {qrProgress > 0
                              ? `~${Math.ceil((qrProgress / 100) * (QR_TTL_MS / 1000))}s`
                              : 'Aguardando novo QR...'}
                          </span>
                        </div>
                        <div className="h-1 w-full bg-wa-border/30 rounded-full overflow-hidden">
                          <motion.div
                            className="h-full rounded-full"
                            style={{ backgroundColor: progressColor, width: `${qrProgress}%` }}
                            transition={{ duration: 0.2 }}
                          />
                        </div>
                      </div>
                    )}

                    <div className="text-center space-y-1">
                      <p className="text-sm font-medium text-wa-text">Escaneie com o WhatsApp</p>
                      <p className="text-xs text-wa-muted">Configurações → Aparelhos conectados → Conectar</p>
                    </div>

                    {!session?.qr && session?.status !== 'connecting' && (
                      <Button onClick={() => sessionId && connectSession(sessionId)} className="w-full">
                        <RefreshCw className="w-4 h-4" />
                        {session?.status === 'qr_timeout' ? 'Tentar Novamente' : 'Gerar QR Code'}
                      </Button>
                    )}
                  </motion.div>
                ) : (
                  <motion.div
                    key="pairing-panel"
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="space-y-4"
                  >
                    <div className="space-y-1.5">
                      <label className="text-xs text-wa-muted">Número com DDI (sem + ou espaços)</label>
                      <Input
                        placeholder="5511999999999"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                      />
                    </div>

                    {pairingCode ? (
                      <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="text-center p-5 bg-wa-green/10 border border-wa-green/30 rounded-xl space-y-2"
                      >
                        <p className="text-xs text-wa-muted">Código de pareamento</p>
                        <p className="text-3xl font-mono font-bold text-wa-green tracking-[0.3em]">
                          {pairingCode}
                        </p>
                        <p className="text-xs text-wa-muted">
                          WhatsApp → Aparelhos conectados → Conectar com número
                        </p>
                      </motion.div>
                    ) : (
                      <Button
                        onClick={handleRequestPairing}
                        disabled={loading || phone.length < 10}
                        className="w-full"
                      >
                        {loading
                          ? <><Loader2 className="w-4 h-4 animate-spin" />Solicitando...</>
                          : <><Smartphone className="w-4 h-4" />Solicitar Código</>
                        }
                      </Button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
