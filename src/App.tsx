import { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { AppProvider, useApp } from '@/context/AppContext';
import { LicenseProvider } from '@/context/LicenseContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { useLicenseContext } from '@/context/LicenseContext';
import { LicenseGate } from '@/components/LicenseGate';
import { Header } from '@/components/Header';
import { Sidebar } from '@/components/Sidebar';
import { Dashboard } from '@/components/Dashboard';
import { QrModal } from '@/components/QrModal';
import { SettingsModal } from '@/components/SettingsModal';
import { CloseConfirmDialog } from '@/components/CloseConfirmDialog';
import { TrialBanner } from '@/components/TrialBanner';
import { OnboardingWizard, useOnboarding } from '@/components/OnboardingWizard';
import { UpdateChecker } from '@/components/UpdateChecker';
import { ToastContainer } from '@/components/Toast';
import { setupNotificationClickHandler } from '@/lib/notify';

const SIDEBAR_MIN = 160;
const SIDEBAR_MAX = 320;
const SIDEBAR_DEFAULT = 224; // w-56 = 14rem = 224px

const VALID_STATUSES = ['valid', 'grace_period', 'offline_grace', 'trial'] as const;

function AppInner() {
  const [qrSessionId, setQrSessionId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT);
  const [isResizing, setIsResizing] = useState(false);
  const dragStartX = useRef(0);
  const dragStartWidth = useRef(0);
  const userRequestedQr = useRef<Set<string>>(new Set()); // sessões que o usuário pediu conectar
  const { sessions, toasts, dismissToast } = useApp();
  const { info } = useLicenseContext();
  const { show: showOnboarding, dismiss: dismissOnboarding } = useOnboarding();

  const licenseValid = VALID_STATUSES.includes(info.status as typeof VALID_STATUSES[number]);

  // Só inicia o sidecar quando a licença estiver válida
  useEffect(() => {
    if (!licenseValid) return;
    invoke('start_baileys_server').catch((e) => {
      console.warn('[Tauri] Sidecar não disponível (modo web?):', e);
    });
    setupNotificationClickHandler();
  }, [licenseValid]);

  useEffect(() => {
    if (!qrSessionId) return;
    const session = sessions.find((s) => s.id === qrSessionId);
    if (!session) return;
    // Fecha o modal só quando conectou ou sessão sumiu — não fecha em disconnected/qr_timeout
    if (session.status === 'connected' || session.status === 'not_found') {
      setQrSessionId(null);
    }
  }, [sessions.map((s) => `${s.id}:${s.status}`).join(','), qrSessionId]);

  // Abre o modal automaticamente quando QR chega — só para sessões que o usuário pediu
  useEffect(() => {
    const sessionWithQr = sessions.find((s) => s.status === 'qr' && s.qr && userRequestedQr.current.has(s.id));
    if (sessionWithQr && !qrSessionId) {
      setQrSessionId(sessionWithQr.id);
    }
  }, [sessions.map((s) => `${s.id}:${s.status}:${s.qr ? '1' : '0'}`).join(',')]);

  const handleCloseQr = () => setQrSessionId(null);
  const handleQrClick = (id: string) => setQrSessionId(id);
  const handleConnectRequest = (id: string) => { userRequestedQr.current.add(id); };

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragStartX.current = e.clientX;
    dragStartWidth.current = sidebarWidth;
    setIsResizing(true);
  }, [sidebarWidth]);

  useEffect(() => {
    if (!isResizing) return;

    const onMouseMove = (e: MouseEvent) => {
      const delta = e.clientX - dragStartX.current;
      const next = Math.min(SIDEBAR_MAX, Math.max(SIDEBAR_MIN, dragStartWidth.current + delta));
      setSidebarWidth(next);
    };

    const onMouseUp = () => setIsResizing(false);

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, [isResizing]);

  return (
    <div className={`flex flex-col h-screen overflow-hidden select-none ${isResizing ? 'cursor-col-resize' : ''}`}>
      <Header onSettingsClick={() => setSettingsOpen(true)} />
      <TrialBanner />

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar com largura dinâmica */}
        <div style={{ width: sidebarWidth, minWidth: sidebarWidth }} className="flex-shrink-0">
          <Sidebar onQrClick={handleQrClick} onConnectRequest={handleConnectRequest} />
        </div>

        {/* Divisor arrastável */}
        <div
          onMouseDown={onMouseDown}
          className={`
            relative w-1 flex-shrink-0 cursor-col-resize group
            transition-colors duration-150
            ${isResizing ? 'bg-wa-green/60' : 'bg-navy-800 hover:bg-wa-green/40'}
          `}
        >
          {/* Linha de highlight visível ao hover */}
          <div className={`
            absolute inset-y-0 left-1/2 -translate-x-1/2 w-0.5
            transition-opacity duration-150
            ${isResizing ? 'opacity-100 bg-wa-green' : 'opacity-0 group-hover:opacity-100 bg-wa-green/60'}
          `} />
        </div>

        <Dashboard />
      </div>

      <QrModal sessionId={qrSessionId} open={!!qrSessionId} onClose={handleCloseQr} />
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <CloseConfirmDialog />
      <UpdateChecker />
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      {showOnboarding && licenseValid && <OnboardingWizard onDone={dismissOnboarding} />}
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <LicenseProvider>
        <AppProvider>
          <LicenseGate />
          <AppInner />
        </AppProvider>
      </LicenseProvider>
    </ThemeProvider>
  );
}
