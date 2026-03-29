import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { Session, LogEntry, BulkProgress, AppSettings, DEFAULT_SETTINGS } from '@/types';
import { useWebSocket } from '@/hooks/useWebSocket';
import { api } from '@/lib/api';
import { generateId } from '@/lib/utils';
import { Notify } from '@/lib/notify';
import type { ToastItem, ToastType } from '@/components/Toast';

export interface CampaignLogEntry extends LogEntry {
  campaignId?: string;
  campaignName?: string;
}

export interface ReplyQueueEntry {
  id: string;
  jid: string;
  senderNumber: string;
  ruleName: string;
  msgText: string;
  ts: number;
  status: 'pending' | 'sent' | 'failed';
}

interface AppContextValue {
  sessions: Session[];
  activeSessionId: string | null;
  setActiveSessionId: (id: string) => void;
  logs: LogEntry[];
  addLog: (level: LogEntry['level'], message: string) => void;
  clearLogs: () => void;
  bulkLogs: LogEntry[];
  addBulkLog: (level: LogEntry['level'], message: string) => void;
  clearBulkLogs: () => void;
  campaignLogs: CampaignLogEntry[];
  clearCampaignLogs: () => void;
  autoReplyLogs: LogEntry[];
  clearAutoReplyLogs: () => void;
  bulkProgress: Record<string, BulkProgress | null>;
  isBulkRunning: Record<string, boolean>;
  settings: AppSettings;
  setSettings: (s: AppSettings) => void;
  sidecarReady: boolean;
  connectSession: (id: string) => Promise<void>;
  disconnectSession: (id: string) => Promise<void>;
  refreshSessions: () => Promise<void>;
  groupsUpdatedAt: Record<string, number>;
  chatUpdatedAt: Record<string, number>; // sessionId -> timestamp da última mensagem recebida
  autoReplyQueue: Record<string, ReplyQueueEntry[]>;
  toasts: ToastItem[];
  addToast: (type: ToastType, message: string, duration?: number) => void;
  dismissToast: (id: string) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [sessions, setSessions] = useState<Session[]>([
    { id: 'session-1', status: 'not_found' },
    { id: 'session-2', status: 'not_found' },
    { id: 'session-3', status: 'not_found' },
    { id: 'session-4', status: 'not_found' },
    { id: 'session-5', status: 'not_found' },
  ]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>('session-1');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [bulkLogs, setBulkLogs] = useState<LogEntry[]>([]);
  const [campaignLogs, setCampaignLogs] = useState<CampaignLogEntry[]>([]);
  const [autoReplyLogs, setAutoReplyLogs] = useState<LogEntry[]>([]);
  const [bulkProgress, setBulkProgress] = useState<Record<string, BulkProgress | null>>({});
  const [isBulkRunning, setIsBulkRunning] = useState<Record<string, boolean>>({});
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [sidecarReady, setSidecarReady] = useState(false);
  const [groupsUpdatedAt, setGroupsUpdatedAt] = useState<Record<string, number>>({});
  const [chatUpdatedAt, setChatUpdatedAt] = useState<Record<string, number>>({});
  const [autoReplyQueue, setAutoReplyQueue] = useState<Record<string, ReplyQueueEntry[]>>({});
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  // Rastreia sessões que já estiveram conectadas nesta sessão do app
  const everConnected = useRef<Set<string>>(new Set());
  // Dedup: evita toast repetido da mesma sessão em menos de 10s
  const lastDisconnectToast = useRef<Map<string, number>>(new Map());

  const addToast = useCallback((type: ToastType, message: string, duration?: number) => {
    const id = generateId();
    setToasts((prev) => [...prev.slice(-4), { id, type, message, duration }]);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addLog = useCallback((level: LogEntry['level'], message: string) => {
    setLogs((prev) => [
      ...prev.slice(-199),
      { id: generateId(), ts: Date.now(), level, message },
    ]);
  }, []);

  const clearLogs = useCallback(() => setLogs([]), []);
  const clearBulkLogs = useCallback(() => setBulkLogs([]), []);
  const clearCampaignLogs = useCallback(() => setCampaignLogs([]), []);
  const clearAutoReplyLogs = useCallback(() => setAutoReplyLogs([]), []);

  const addBulkLog = useCallback((level: LogEntry['level'], message: string) => {
    setBulkLogs((prev) => [
      ...prev.slice(-499),
      { id: generateId(), ts: Date.now(), level, message },
    ]);
  }, []);

  const addAutoReplyLog = useCallback((level: LogEntry['level'], message: string) => {    setAutoReplyLogs((prev) => [
      ...prev.slice(-499),
      { id: generateId(), ts: Date.now(), level, message },
    ]);
  }, []);

  const addCampaignLog = useCallback((level: LogEntry['level'], message: string, extra?: { campaignId?: string; campaignName?: string }) => {
    setCampaignLogs((prev) => [
      ...prev.slice(-499),
      { id: generateId(), ts: Date.now(), level, message, ...extra },
    ]);
  }, []);

  const refreshSessions = useCallback(async () => {
    try {
      const list = await api.sessions.list();
      setSessions((prev) =>
        prev.map((s) => {
          const found = list.find((l) => l.id === s.id);
          if (!found) return s;
          // Se já estava conectada no servidor, marca como "já conectou"
          if (found.status === 'connected') everConnected.current.add(s.id);
          return {
            ...s,
            status: found.status as Session['status'],
            user: found.user as Session['user'],
            qr: found.qr || undefined,
            pairingCode: found.pairingCode || undefined,
          };
        })
      );
    } catch {}
  }, []);

  const handleWsEvent = useCallback((event: string, data: unknown) => {
    const d = data as Record<string, unknown>;
    switch (event) {
      case 'ws_connected':
        setSidecarReady(true);
        addLog('success', 'Sidecar conectado');
        refreshSessions();
        break;
      case 'ws_disconnected':
        setSidecarReady(false);
        addLog('warn', 'Sidecar desconectado, reconectando...');
        break;
      case 'qr':
        setSessions((prev) =>
          prev.map((s) => s.id === d.sessionId ? { ...s, status: 'qr', qr: d.qr as string } : s)
        );
        addLog('info', `QR Code gerado para ${d.sessionId}`);
        break;
      case 'connection':
        setSessions((prev) =>
          prev.map((s) => {
            if (s.id !== d.sessionId) return s;
            const status = (d.reason === 'qr_timeout')
              ? 'qr_timeout' as Session['status']
              : d.status as Session['status'];
            return { ...s, status, user: d.user as Session['user'], qr: undefined };
          })
        );
        if (d.status === 'connected') {
          const user = (d.user as { name?: string } | undefined);
          const label = user?.name || (d.sessionId as string);
          addLog('success', `Sessão ${d.sessionId} conectada`);
          addToast('success', `✅ ${label} conectado`);
          everConnected.current.add(d.sessionId as string);
        }
        if (d.status === 'disconnected') {
          if (d.reason === 'qr_timeout') {
            addLog('warn', `Sessão ${d.sessionId}: QR não escaneado. Clique em Conectar para tentar novamente.`);
          } else if (d.reason === 'logged_out') {
            addLog('warn', `Sessão ${d.sessionId} deslogada do WhatsApp.`);
            addToast('warn', `⚠️ Sessão ${d.sessionId} deslogada`);
          } else {
            addLog('warn', `Sessão ${d.sessionId} desconectada`);
            // Só notifica se a sessão já esteve conectada nesta sessão do app
            // e não spamou nos últimos 10s
            if (everConnected.current.has(d.sessionId as string)) {
              const sid = d.sessionId as string;
              const last = lastDisconnectToast.current.get(sid) ?? 0;
              if (Date.now() - last > 10_000) {
                lastDisconnectToast.current.set(sid, Date.now());
                Notify.sessaoDesconectada(sid);
                addToast('error', `Sessão ${sid} desconectada`);
              }
            }
          }
        }
        break;
      case 'pairing_code':
        setSessions((prev) =>
          prev.map((s) => s.id === d.sessionId ? { ...s, pairingCode: d.code as string } : s)
        );
        addLog('info', `Pairing code para ${d.sessionId}: ${d.code}`);
        break;
      case 'bulk_progress': {
        const bp = d as unknown as BulkProgress;
        const sid = (d.sessionId as string) || '';
        setBulkProgress((prev) => ({ ...prev, [sid]: bp }));
        setIsBulkRunning((prev) => ({ ...prev, [sid]: true }));
        if (bp.status === 'sent') {
          addBulkLog('success', `✓ ${bp.number}`);
        } else if (bp.status === 'failed') {
          addBulkLog('error', `✗ ${bp.number}: ${bp.error}`);
        }
        break;
      }
      case 'bulk_done': {
        const sid = (d.sessionId as string) || '';
        const stats = (d as { stats: { sent: number; failed: number } }).stats;
        setIsBulkRunning((prev) => ({ ...prev, [sid]: false }));
        setBulkProgress((prev) => ({ ...prev, [sid]: null }));
        addBulkLog('success', `Disparo concluído! Enviados: ${stats.sent}, Falhas: ${stats.failed}`);
        Notify.disparoConcluido(stats.sent, stats.failed);
        break;
      }
      case 'message':
        addLog('info', `Mensagem recebida em ${d.sessionId}`);
        break;
      case 'auto_reply_sent':
        addAutoReplyLog('success', `✓ [${d.sessionId}] Regra "${d.rule}" → ${(d.jid as string).replace('@s.whatsapp.net','').replace('@g.us','')}: "${(d.response as string).slice(0,60)}${(d.response as string).length > 60 ? '…' : ''}"`);
        break;
      case 'campaign_start':
        addCampaignLog('info', `▶ Campanha "${d.name}" iniciada → ${d.total} destinatários`, { campaignId: d.id as string, campaignName: d.name as string });
        break;
      case 'campaign_progress':
        if (d.status === 'sent') {
          addCampaignLog('success', `✓ [${d.id}] → ${d.number} (${d.sent}/${d.total})`, { campaignId: d.id as string });
        } else {
          addCampaignLog('error', `✗ [${d.id}] → ${d.number} falhou`, { campaignId: d.id as string });
        }
        break;
      case 'campaign_done':
        addCampaignLog('success', `✔ Campanha "${d.name}" concluída — ${d.sent} enviados, ${d.failed} falhas`, { campaignId: d.id as string, campaignName: d.name as string });
        addLog('success', `Campanha "${d.name}": ${d.sent} enviados, ${d.failed} falhas`);
        break;
      case 'campaign_log':
        addCampaignLog(d.level as LogEntry['level'] || 'warn', d.message as string, { campaignId: d.id as string });
        break;
      case 'groups_updated':
        addLog('info', `Grupos atualizados para ${d.sessionId}: ${d.count} grupos`);
        setGroupsUpdatedAt((prev) => ({ ...prev, [d.sessionId as string]: Date.now() }));
        break;
      case 'chat_updated':
        setChatUpdatedAt((prev) => ({ ...prev, [d.sessionId as string]: Date.now() }));
        break;
      case 'auto_reply_queued':
        setAutoReplyQueue((prev) => ({ ...prev, [d.sessionId as string]: d.queue as ReplyQueueEntry[] }));
        break;
    }
  }, [addLog, addBulkLog, addCampaignLog, addAutoReplyLog, refreshSessions]);

  useWebSocket(handleWsEvent);

  const connectSession = useCallback(async (id: string) => {
    try {
      setSessions((prev) => prev.map((s) => s.id === id ? { ...s, status: 'connecting' } : s));
      await api.sessions.connect(id);
      addLog('info', `Conectando sessão ${id}...`);
    } catch (e) {
      addLog('error', `Erro ao conectar ${id}: ${(e as Error).message}`);
    }
  }, [addLog]);

  const disconnectSession = useCallback(async (id: string) => {
    try {
      await api.sessions.disconnect(id);
      setSessions((prev) => prev.map((s) => s.id === id ? { ...s, status: 'not_found', qr: undefined, user: undefined } : s));
      addLog('warn', `Sessão ${id} desconectada`);
    } catch (e) {
      addLog('error', `Erro ao desconectar ${id}: ${(e as Error).message}`);
    }
  }, [addLog]);

  return (
    <AppContext.Provider value={{
      sessions, activeSessionId, setActiveSessionId,
      logs, addLog, clearLogs,
      bulkLogs, addBulkLog, clearBulkLogs,
      campaignLogs, clearCampaignLogs,
      autoReplyLogs, clearAutoReplyLogs,
      bulkProgress, isBulkRunning,
      settings, setSettings,
      sidecarReady,
      connectSession, disconnectSession, refreshSessions,
      groupsUpdatedAt,
      chatUpdatedAt,
      autoReplyQueue,
      toasts, addToast, dismissToast,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
