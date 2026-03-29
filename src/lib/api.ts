import { DisparoOptions } from '@/components/DisparoConfig';

export interface ChatEntry {
  jid: string;
  name: string;
  lastMessage: string;
  lastMessageTs: number;
  unread: number;
  isGroup: boolean;
}

export interface ChatMessage {
  id: string;
  fromMe: boolean;
  text: string;
  ts: number;
  senderName: string;
}

const BASE = 'http://127.0.0.1:3001';

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status} ${res.statusText} — ${method} ${path}` }));
    throw new Error(err.error || `HTTP ${res.status} ${res.statusText} — ${method} ${path}`);
  }
  return res.json();
}

export const api = {
  health: () => req<{ ok: boolean }>('GET', '/health'),
  sessions: {
    list: () => req<{ id: string; status: string; user: unknown; qr: string | null; pairingCode: string | null }[]>('GET', '/sessions'),
    connect: (id: string) => req<{ ok: boolean; status: string }>('POST', `/sessions/${id}/connect`),
    disconnect: (id: string) => req<{ ok: boolean }>('POST', `/sessions/${id}/disconnect`),
    status: (id: string) => req<{ status: string; user: unknown; qr: string | null; pairingCode: string | null }>('GET', `/sessions/${id}/status`),
    pairingCode: (id: string, phone: string) => req<{ ok: boolean; code: string }>('POST', `/sessions/${id}/pairing-code`, { phone }),
    clearData: (id: string) => req<{ ok: boolean }>('DELETE', `/sessions/${id}/data`),
  },
  send: (id: string, payload: {
    to: string; text?: string; media?: string; mediaType?: string;
    caption?: string; delayMin?: number; delayMax?: number;
  }) => req<{ ok: boolean }>('POST', `/sessions/${id}/send`, payload),
  bulkSend: (id: string, payload: {
    numbers: (string | { number: string; vars: Record<string, string> })[];
    messages: { text?: string; media?: string; mediaType?: string; caption?: string }[];
    options?: DisparoOptions;
  }) => req<{ ok: boolean; total: number; message: string }>('POST', `/sessions/${id}/bulk-send`, payload),
  bulkPause: (id: string) => req<{ ok: boolean }>('POST', `/sessions/${id}/bulk-pause`),
  bulkResume: (id: string) => req<{ ok: boolean }>('POST', `/sessions/${id}/bulk-resume`),
  bulkReport: (id: string) => req<{ ok: boolean; report: { number: string; status: string; error: string; ts: string }[] }>('GET', `/sessions/${id}/bulk-report`),
  blacklist: {
    list: () => req<{ ok: boolean; numbers: string[] }>('GET', '/blacklist'),
    add: (numbers: string[]) => req<{ ok: boolean; count: number }>('POST', '/blacklist', { numbers }),
    remove: (number: string) => req<{ ok: boolean }>('DELETE', `/blacklist/${number}`),
  },
  groups: {
    list: (id: string, refresh = false) => req<{ ok: boolean; groups: { id: string; subject: string; participantCount: number }[]; loading?: boolean; refreshing?: boolean }>('GET', `/sessions/${id}/groups${refresh ? '?refresh=true' : ''}`),
    participants: (id: string, groupId: string) => req<{ ok: boolean; participants: { id: string; phone: string; admin: string | null }[]; subject: string }>('GET', `/sessions/${id}/groups/${groupId}/participants`),
    fromLink: (id: string, link: string) => req<{ ok: boolean; groupId: string; subject: string; participantCount: number; participants: { id: string; phone: string; admin: string | null }[] }>('POST', `/sessions/${id}/groups/from-link`, { link }),
  },
  chats: {
    list: (id: string) => req<{ ok: boolean; chats: ChatEntry[] }>('GET', `/sessions/${id}/chats`),
    markRead: (id: string, jid: string) => req<{ ok: boolean }>('POST', `/sessions/${id}/chats/${encodeURIComponent(jid)}/read`),
    messages: (id: string, jid: string) => req<{ ok: boolean; messages: ChatMessage[] }>('GET', `/sessions/${id}/chats/${encodeURIComponent(jid)}/messages`),
  },
  ia: {
    setConfig: (id: string, config: Record<string, unknown>) =>
      req<{ ok: boolean }>('POST', `/sessions/${id}/ia-config`, config),
    getConfig: (id: string) =>
      req<{ ok: boolean; config: Record<string, unknown> | null }>('GET', `/sessions/${id}/ia-config`),
    history: (id: string) =>
      req<{ ok: boolean; conversations: { jid: string; messageCount: number; lastTs: number; lastText: string }[] }>('GET', `/sessions/${id}/ia-history`),
    historyJid: (id: string, jid: string) =>
      req<{ ok: boolean; messages: { role: string; text: string; ts: number }[] }>('GET', `/sessions/${id}/ia-history/${encodeURIComponent(jid)}`),
    clearHistory: (id: string, jid: string) =>
      req<{ ok: boolean }>('DELETE', `/sessions/${id}/ia-history/${encodeURIComponent(jid)}`),
    transfer: (id: string, jid: string, reason?: string) =>
      req<{ ok: boolean }>('POST', `/sessions/${id}/ia-transfer`, { jid, reason }),
    test: (id: string, message: string, history?: { role: string; text: string }[]) =>
      req<{ ok: boolean; response?: string; error?: string; latencyMs: number; provider?: string; model?: string }>('POST', `/sessions/${id}/ia-test`, { message, history }),
  },
  typing: (id: string, jid: string, duration?: number) => req<{ ok: boolean }>('POST', `/sessions/${id}/typing`, { jid, duration }),
  read: (id: string, jid: string, messageId: string) => req<{ ok: boolean }>('POST', `/sessions/${id}/read`, { jid, messageId }),
  stats: () => req<{ ok: boolean; stats: { sent: number; failed: number; total: number; startTime: number | null } }>('GET', '/stats'),
  autoReply: (id: string, config: { enabled: boolean; provider: string; apiKey: string; model: string; systemPrompt: string }) =>
    req<{ ok: boolean }>('POST', `/sessions/${id}/auto-reply`, config),
  autoReplyStats: (id: string) =>
    req<{ ok: boolean; stats: Record<string, { hitCount: number; lastHit: string | null }> }>('GET', `/sessions/${id}/auto-reply-stats`),
  autoReplyQueue: (id: string) =>
    req<{ ok: boolean; queue: { id: string; jid: string; senderNumber: string; ruleName: string; msgText: string; ts: number; status: string }[] }>('GET', `/sessions/${id}/auto-reply-queue`),
  autoReplyClearQueue: (id: string) =>
    req<{ ok: boolean }>('DELETE', `/sessions/${id}/auto-reply-queue`),
};

export const campaignApi = {
  list: () => req<Campaign[]>('GET', '/campaigns'),
  create: (c: Partial<Campaign>) => req<Campaign>('POST', '/campaigns', c),
  update: (id: string, c: Partial<Campaign>) => req<Campaign>('PUT', `/campaigns/${id}`, c),
  delete: (id: string) => req<{ ok: boolean }>('DELETE', `/campaigns/${id}`),
  toggle: (id: string, enabled: boolean) => req<{ ok: boolean; campaign: Campaign }>('POST', `/campaigns/${id}/toggle`, { enabled }),
  runNow: (id: string) => req<{ ok: boolean }>('POST', `/campaigns/${id}/run-now`),
};

export interface CampaignSchedule {
  type: 'interval' | 'daily' | 'weekly' | 'monthly';
  intervalValue?: number;
  intervalUnit?: 'minutes' | 'hours' | 'days';
  dailyTime?: string;
  weeklyDays?: number[];
  weeklyTime?: string;
  monthlyDay?: number;
  monthlyTime?: string;
}

export interface Campaign {
  id: string;
  name: string;
  enabled: boolean;
  sessionId: string;
  message: string;
  media?: string | null;
  mediaType?: string;
  numbers: string[];
  schedule: CampaignSchedule;
  delayMin: number;
  delayMax: number;
  limitPerDay: number;
  cronExpr?: string;
  status?: 'running' | 'paused' | 'scheduled';
  lastRun?: string;
  lastStats?: { sent: number; failed: number; total: number };
}
