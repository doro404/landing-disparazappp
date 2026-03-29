import { Wifi, WifiOff, Loader2, Settings } from 'lucide-react';
import { useApp } from '@/context/AppContext';

interface HeaderProps {
  onSettingsClick: () => void;
}

export function Header({ onSettingsClick }: HeaderProps) {
  const { sessions, sidecarReady } = useApp();
  const connectedCount = sessions.filter((s) => s.status === 'connected').length;
  const activeSession = sessions.find((s) => s.status === 'connected');

  return (
    <header className="flex items-center justify-between h-11 px-4 border-b border-navy-800 bg-navy-900 flex-shrink-0 select-none">

      {/* ── Esquerda: logo + nome ── */}
      <div className="flex items-center gap-2.5">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-bold text-wa-text tracking-tight leading-none">Dispara</span>
          <span className="text-[10px] font-medium text-navy-300 uppercase tracking-widest leading-none">Zapp</span>
        </div>
        {/* Separador vertical */}
        <div className="w-px h-4 bg-navy-700 mx-1" />
        <span className="text-[10px] text-navy-400 font-mono">v7.21</span>
      </div>



      {/* ── Direita: settings ── */}
      <div className="flex items-center gap-1">
        <button
          onClick={onSettingsClick}
          className="w-7 h-7 rounded flex items-center justify-center text-navy-400 hover:text-white hover:bg-navy-700 transition-colors"
          title="Configurações"
        >
          <Settings className="w-3.5 h-3.5" />
        </button>
      </div>
    </header>
  );
}
