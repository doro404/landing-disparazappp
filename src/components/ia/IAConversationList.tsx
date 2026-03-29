import { useState, useEffect, useCallback } from 'react';
import { Search, UserCheck, Pause, RefreshCw, MessageSquare, ArrowRightLeft } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { api, ChatEntry } from '@/lib/api';
import { INTENT_META, SENTIMENT_META, LEAD_SCORE_META } from './iaData';
import { Conversation, ConversationStatus, Intent, Sentiment, LeadScore } from './types';

// ─── Map a raw ChatEntry to a Conversation (client-side heuristics) ───────────

function inferIntent(text: string): Intent {
  const t = text.toLowerCase();
  if (/comprar|adquirir|contratar|quero/.test(t)) return 'want_to_buy';
  if (/preço|valor|quanto|custa|plano/.test(t)) return 'want_price';
  if (/suporte|problema|erro|não funciona/.test(t)) return 'need_support';
  if (/atendente|humano|pessoa|falar com/.test(t)) return 'want_human';
  if (/pagamento|boleto|pix|cartão/.test(t)) return 'payment_issue';
  if (/informação|saber mais|como funciona/.test(t)) return 'want_info';
  if (/não quero|sem interesse|remover/.test(t)) return 'not_interested';
  return 'unknown';
}

function inferSentiment(text: string): Sentiment {
  const t = text.toLowerCase();
  if (/ótimo|excelente|obrigado|perfeito|adorei/.test(t)) return 'positive';
  if (/raiva|absurdo|ridículo|péssimo|horrível/.test(t)) return 'frustrated';
  if (/ruim|problema|errado|não gostei/.test(t)) return 'negative';
  return 'neutral';
}

function inferLeadScore(intent: Intent, sentiment: Sentiment): LeadScore {
  if (intent === 'want_to_buy' || intent === 'want_price') return 'hot';
  if (sentiment === 'frustrated' || sentiment === 'negative') return 'cold';
  if (intent === 'want_info' || intent === 'need_support') return 'warm';
  return 'cold';
}

function chatToConversation(chat: ChatEntry, sessionId: string): Conversation {
  const intent = inferIntent(chat.lastMessage);
  const sentiment = inferSentiment(chat.lastMessage);
  return {
    id: chat.jid,
    sessionId,
    contact: chat.jid.replace('@s.whatsapp.net', '').replace('@g.us', ''),
    contactName: chat.name,
    lastMessage: chat.lastMessage,
    lastMessageTs: chat.lastMessageTs,
    status: 'ai_active' as ConversationStatus,
    intent,
    sentiment,
    leadScore: inferLeadScore(intent, sentiment),
    tags: chat.isGroup ? ['grupo'] : [],
    autoMessageCount: 0,
    assignedTo: 'ia',
    unread: chat.unread,
  };
}

// ─── Status meta ──────────────────────────────────────────────────────────────

const STATUS_META: Record<ConversationStatus, { label: string; color: string; dot: string }> = {
  ai_active:     { label: 'IA Ativa',        color: 'text-emerald-400', dot: 'bg-emerald-400' },
  waiting_human: { label: 'Aguard. Humano',  color: 'text-orange-400',  dot: 'bg-orange-400 animate-pulse' },
  transferred:   { label: 'Transferido',     color: 'text-blue-400',    dot: 'bg-blue-400' },
  closed:        { label: 'Encerrado',       color: 'text-neutral-500', dot: 'bg-neutral-600' },
  paused:        { label: 'Pausado',         color: 'text-yellow-400',  dot: 'bg-yellow-400' },
};

interface Props {
  onSelect: (c: Conversation) => void;
  selected: Conversation | null;
  chatScope?: 'all' | 'private' | 'groups';
}

export function IAConversationList({ onSelect, selected, chatScope = 'all' }: Props) {
  const { activeSessionId, sessions, chatUpdatedAt } = useApp();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<ConversationStatus | 'all'>('all');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [overrides, setOverrides] = useState<Record<string, Partial<Conversation>>>({});

  const isConnected = sessions.find(s => s.id === activeSessionId)?.status === 'connected';

  const fetchChats = useCallback(async () => {
    if (!activeSessionId || !isConnected) return;
    setLoading(true);
    try {
      const { chats } = await api.chats.list(activeSessionId);
      setConversations(chats.map(c => chatToConversation(c, activeSessionId)));
    } catch {
      // sidecar pode não ter chats ainda
    } finally {
      setLoading(false);
    }
  }, [activeSessionId, isConnected]);

  // Fetch on mount, session change, or new incoming message
  useEffect(() => { fetchChats(); }, [fetchChats]);
  useEffect(() => {
    if (activeSessionId && chatUpdatedAt[activeSessionId]) fetchChats();
  }, [chatUpdatedAt, activeSessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  const merged = conversations.map(c => ({ ...c, ...(overrides[c.id] ?? {}) }));

  const filtered = merged.filter(c => {
    const matchSearch =
      c.contactName.toLowerCase().includes(search.toLowerCase()) ||
      c.contact.includes(search) ||
      c.lastMessage.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || c.status === filterStatus;
    const matchScope =
      chatScope === 'all' ||
      (chatScope === 'groups' && c.tags.includes('grupo')) ||
      (chatScope === 'private' && !c.tags.includes('grupo'));
    return matchSearch && matchStatus && matchScope;
  });

  const setOverride = (id: string, patch: Partial<Conversation>) =>
    setOverrides(prev => ({ ...prev, [id]: { ...(prev[id] ?? {}), ...patch } }));

  const togglePause = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const cur = (overrides[id]?.status ?? conversations.find(c => c.id === id)?.status) as ConversationStatus;
    setOverride(id, { status: cur === 'paused' ? 'ai_active' : 'paused' });
  };

  const takeOver = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setOverride(id, { status: 'transferred', assignedTo: 'Você' });
  };

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center h-full rounded-xl border border-wa-border bg-wa-card gap-2 text-center p-6">
        <MessageSquare className="w-7 h-7 text-wa-muted" />
        <p className="text-sm text-wa-muted">Sessão não conectada</p>
        <p className="text-xs text-wa-text/70">Conecte uma sessão WhatsApp para ver as conversas</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full rounded-xl border border-wa-border bg-wa-card overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 p-3 border-b border-wa-border space-y-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-wa-muted" />
            <input
              className="w-full bg-wa-bgIA border border-wa-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-wa-text placeholder-wa-muted/40 focus:outline-none focus:border-violet-500/50"
              placeholder="Buscar conversa..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <button onClick={fetchChats} disabled={loading}
            className="text-wa-muted hover:text-violet-400 transition-colors disabled:opacity-40">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <span className="text-[10px] text-wa-muted flex-shrink-0">{filtered.length}</span>
        </div>
        <div className="flex gap-1 overflow-x-auto pb-0.5">
          {(['all', 'ai_active', 'waiting_human', 'transferred', 'paused', 'closed'] as const).map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`flex-shrink-0 text-[10px] px-2 py-0.5 rounded-full border transition-colors ${filterStatus === s ? 'border-violet-500/50 bg-violet-500/15 text-violet-400' : 'border-wa-border text-wa-muted hover:border-violet-500/30'}`}>
              {s === 'all' ? 'Todas' : STATUS_META[s].label}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-24 gap-2 text-xs text-wa-muted">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />Carregando...
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2 text-center px-4">
            <MessageSquare className="w-6 h-6 text-slate-700" />
            <p className="text-xs text-wa-text/70">
              {conversations.length === 0
                ? 'Nenhuma mensagem recebida ainda'
                : 'Nenhuma conversa encontrada'}
            </p>
          </div>
        ) : (
          filtered.map(c => {
            const status = STATUS_META[c.status];
            const intent = INTENT_META[c.intent];
            const sentiment = SENTIMENT_META[c.sentiment];
            const score = LEAD_SCORE_META[c.leadScore];
            const isSelected = selected?.id === c.id;

            return (
              <div key={c.id} onClick={() => onSelect(c)}
                className={`p-3 border-b border-wa-border cursor-pointer transition-colors ${isSelected ? 'bg-violet-500/10' : 'hover:bg-wa-bgIA'}`}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${status.dot}`} />
                    <span className="text-xs font-semibold text-wa-text truncate max-w-[120px]">{c.contactName}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {c.unread > 0 && (
                      <span className="w-4 h-4 rounded-full bg-violet-500 text-[9px] font-bold text-wa-text flex items-center justify-center">{c.unread}</span>
                    )}
                    <span className="text-[10px] text-wa-text/60">
                      {new Date(c.lastMessageTs).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-wa-muted truncate mb-1.5">{c.lastMessage}</p>

                <div className="flex items-center gap-1 flex-wrap">
                  <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${intent.color}`}>{intent.label}</span>
                  <span className="text-[10px]">{sentiment.icon}</span>
                  <span className={`text-[9px] font-semibold flex items-center gap-0.5 ${score.color}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${score.dot}`} />{score.label}
                  </span>
                  <span className={`text-[9px] ml-auto ${status.color}`}>{status.label}</span>
                </div>

                <div className="flex items-center gap-1 mt-2">
                  <button onClick={e => takeOver(c.id, e)}
                    className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors">
                    <UserCheck className="w-2.5 h-2.5" />Assumir
                  </button>
                  <button onClick={e => togglePause(c.id, e)}
                    className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 transition-colors">
                    <Pause className="w-2.5 h-2.5" />{c.status === 'paused' ? 'Retomar' : 'Pausar'}
                  </button>
                  {(c.status === 'ai_active' || c.status === 'paused') && (
                    <button
                      onClick={async e => {
                        e.stopPropagation();
                        setOverride(c.id, { status: 'waiting_human' });
                        if (activeSessionId) {
                          await api.ia.transfer(activeSessionId, c.id, 'manual').catch(() => {});
                        }
                      }}
                      className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 transition-colors">
                      <ArrowRightLeft className="w-2.5 h-2.5" />Transferir
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

