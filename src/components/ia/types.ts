// ─── IA Atendimento — Types ───────────────────────────────────────────────────

export type IAMode = 'automatic' | 'assisted' | 'hybrid';

export type AgentProfile =
  | 'seller'
  | 'support'
  | 'receptionist'
  | 'lead_qualifier'
  | 'post_sale'
  | 'collection';

export type ConversationStatus =
  | 'ai_active'
  | 'waiting_human'
  | 'transferred'
  | 'closed'
  | 'paused';

export type Intent =
  | 'want_to_buy'
  | 'want_price'
  | 'need_support'
  | 'want_human'
  | 'plan_question'
  | 'payment_issue'
  | 'want_info'
  | 'not_interested'
  | 'spam'
  | 'unknown';

export type Sentiment = 'positive' | 'neutral' | 'negative' | 'frustrated';
export type LeadScore = 'hot' | 'warm' | 'cold';

export type ChatScope = 'all' | 'private' | 'groups';

export interface IAConfig {
  enabled: boolean;
  mode: IAMode;
  chatScope: ChatScope;
  profile: AgentProfile;
  provider: string;
  model: string;
  apiKey?: string;
  basePrompt: string;
  tone: 'formal' | 'friendly' | 'direct' | 'empathetic';
  language: string;
  workingHoursEnabled: boolean;
  workingHoursStart: string;
  workingHoursEnd: string;
  responseDelayMin: number;
  responseDelayMax: number;
  maxAutoMessages: number;
  temperature: number;
  maxContextMessages: number;
  forbiddenWords: string[];
  sensitiveWords: string[];
  fallbackMessage: string;
  transferRules: TransferRule[];
  transferWebhook?: string;
}

export interface TransferRule {
  id: string;
  trigger: string;
  action: 'transfer' | 'pause' | 'tag';
  label: string;
}

export interface Conversation {
  id: string;
  sessionId: string;
  contact: string;
  contactName: string;
  lastMessage: string;
  lastMessageTs: number;
  status: ConversationStatus;
  intent: Intent;
  sentiment: Sentiment;
  leadScore: LeadScore;
  tags: string[];
  autoMessageCount: number;
  assignedTo: 'ia' | string;
  unread: number;
}

export interface IALogEntry {
  id: string;
  ts: number;
  conversationId: string;
  incomingMessage: string;
  interpretation: string;
  intent: Intent;
  sentiment: Sentiment;
  generatedResponse: string;
  responseReason: string;
  transferred: boolean;
  transferReason?: string;
  tags: string[];
  confidence: number;
}

export interface IAMetrics {
  totalConversations: number;
  resolvedByIA: number;
  transferred: number;
  avgResponseTime: number;
  topIntent: Intent;
  satisfactionRate: number;
  leadsQualified: number;
  conversionsStarted: number;
  iaFailures: number;
}

export interface PromptPreset {
  id: string;
  label: string;
  description: string;
  prompt: string;
  tone: IAConfig['tone'];
  profile: AgentProfile;
}

export interface TestResult {
  input: string;
  response: string;
  intent: Intent;
  sentiment: Sentiment;
  confidence: number;
  wouldTransfer: boolean;
  transferReason?: string;
  tags: string[];
  extractedData: Record<string, string>;
}
