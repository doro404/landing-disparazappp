import { useApp } from '@/context/AppContext';
import { SessionItem } from './SessionItem';

interface SidebarProps {
  onQrClick: (sessionId: string) => void;
  onConnectRequest: (sessionId: string) => void;
}

export function Sidebar({ onQrClick, onConnectRequest }: SidebarProps) {
  const { sessions, activeSessionId, setActiveSessionId, connectSession, disconnectSession, isBulkRunning } = useApp();
  const connectedCount = sessions.filter((s) => s.status === 'connected').length;

  return (
    <aside className="w-full h-full flex flex-col border-r border-wa-border bg-wa-card flex-shrink-0">

      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-wa-border">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-wa-muted uppercase tracking-widest">Sessões</p>
            <p className="text-[9px] text-wa-muted/60 mt-0.5">WhatsApp Business</p>
          </div>
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
            connectedCount > 0
              ? 'bg-emerald-500/10 text-emerald-500'
              : 'bg-wa-border/60 text-wa-muted'
          }`}>
            {connectedCount}/{sessions.length}
          </span>
        </div>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5 min-h-0">
        {sessions.length === 0 ? (
          <p className="text-xs text-wa-muted text-center py-8">Nenhuma sessão</p>
        ) : (
          sessions.map((session, i) => (
            <SessionItem
              key={session.id}
              session={session}
              index={i}
              isActive={activeSessionId === session.id}
              isBulkRunning={!!(isBulkRunning[session.id])}
              onSelect={setActiveSessionId}
              onQrClick={onQrClick}
              onConnect={(id) => {
                onConnectRequest(id);
                connectSession(id);
                onQrClick(id);
              }}
              onDisconnect={disconnectSession}
            />
          ))
        )}
      </div>
    </aside>
  );
}
