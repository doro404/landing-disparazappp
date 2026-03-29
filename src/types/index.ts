export type SessionStatus = 'not_found' | 'connecting' | 'qr' | 'connected' | 'disconnected' | 'qr_timeout';

export interface Session {
  id: string;
  status: SessionStatus;
  user?: { id: string; name?: string };
  qr?: string;
  pairingCode?: string;
}

export interface BulkProgress {
  index: number;
  total: number;
  number: string;
  status: 'sent' | 'failed' | 'retrying' | 'blacklisted';
  error?: string;
  stats: SendStats;
}

export interface SendStats {
  sent: number;
  failed: number;
  skipped: number;
  total: number;
  startTime: number | null;
}

export interface Group {
  id: string;
  subject: string;
  participantCount: number;
  announce?: boolean;
  restrict?: boolean;
  isCommunity?: boolean;
  isCommunityAnnounce?: boolean;
  joinApprovalMode?: boolean;
  memberAddMode?: boolean;
  desc?: string | null;
  linkedParent?: string | null;
}

export interface Participant {
  id: string;
  phone: string;
  admin: string | null;
}

export interface LogEntry {
  id: string;
  ts: number;
  level: 'info' | 'success' | 'error' | 'warn';
  message: string;
}

export interface AppSettings {
  delayMin: number;
  delayMax: number;
  limitPerHour: number;
  limitPerDay: number;
  autostart: boolean;
  aiProvider: 'none' | 'openai' | 'anthropic' | 'groq' | 'grok' | 'ollama';
  aiApiKey: string;
  aiModel: string;
  aiSystemPrompt: string;
  proxyEnabled: boolean;
  proxyUrl: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  delayMin: 1200,
  delayMax: 3500,
  limitPerHour: 200,
  limitPerDay: 1000,
  autostart: false,
  aiProvider: 'none',
  aiApiKey: '',
  aiModel: 'llama3-8b-8192',
  aiSystemPrompt: 'Você é um assistente prestativo. Responda de forma breve e amigável.',
  proxyEnabled: false,
  proxyUrl: '',
};
