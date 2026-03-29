import { useState, useEffect, useRef } from 'react';
import { X, Tag, Brain, RefreshCw, Bot, User } from 'lucide-react';
import { Conversation } from './types';
import { INTENT_META, SENTIMENT_META, LEAD_SCORE_META } from './iaData';
import { api, ChatMessage } from '@/lib/api';
import { useApp } from '@/context/AppContext';

interface Props {
  conversation: Conversation | null;
  onClose: () => void;
}

function Badge({ children, color }: { children: React.ReactNode; color: string }) {
  return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${color}`}>{children}</span>;
}

export function IAConversationDetail({ conversation, onClose }: Props) {
  const { chatUpdatedAt } = useApp();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchMessages = async () => {
    if (!conversation) return;
    setLoading(true);
    try {
      const { messages: msgs } = await api.chats.messages(conversation.sessionId, conversation.id);
      setMessages(msgs);
    } catch {
      // sem mensagens ainda
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setMessages([]);
    if (conversation) fetchMessages();
  }, [conversation?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-fetch quando chegar nova mensagem ou resposta da IA
  useEffect(() => {
    if (conversation && chatUpdatedAt[conversation.sessionId]) {
      fetchMessages();
    }
  }, [chatUpdatedAt]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (!conversation) {
    return (
      <div className="flex flex-col items-center justify-center h-full rounded-xl border border-wa-border bg-wa-card text-wa-muted">
        <Brain className="w-8 h-8 mb-2 opacity-30" />
        <p className="text-sm">Selecione uma conversa</p>
      </div>
    );
  }

  const intent = INTENT_META[conversation.intent];
  const sentiment = SENTIMENT_META[conversation.sentiment];
  const score = LEAD_SCORE_META[conversation.leadScore];

  return (
    <div className="flex flex-col h-full rounded-xl border border-wa-border bg-wa-card overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between p-3 border-b border-wa-border bg-wa-bgIA">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-full bg-violet-500/20 flex items-center justify-center flex-shrink-0">
            <User className="w-3.5 h-3.5 text-violet-400" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-wa-text truncate">{conversation.contactName}</p>
            <p className="text-[10px] text-wa-text/60">{conversation.contact}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={fetchMessages} disabled={loading}
            className="text-wa-muted hover:text-violet-400 transition-colors disabled:opacity-40">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button onClick={onClose} className="text-wa-muted hover:text-wa-text transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Badges */}
      <div className="flex-shrink-0 flex flex-wrap gap-1.5 px-3 py-2 border-b border-wa-border">
        <Badge color={intent.color}>{intent.label}</Badge>
        <Badge color={sentiment.color}>{sentiment.icon} {sentiment.label}</Badge>
        <Badge color={score.color}>Lead {score.label}</Badge>
        <Badge color="text-violet-400 bg-violet-500/10">
          {conversation.assignedTo === 'ia' ? '🤖 IA' : `👤 ${conversation.assignedTo}`}
        </Badge>
        {conversation.tags.map(t => (
          <span key={t} className="flex items-center gap-0.5 text-[10px] px-2 py-0.5 rounded-full bg-wa-bgIA border border-wa-border text-wa-muted/80">
            <Tag className="w-2.5 h-2.5" />{t}
          </span>
        ))}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {loading ? (
          <div className="flex items-center justify-center h-20 gap-2 text-xs text-wa-muted">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />Carregando...
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2 text-center">
            <Brain className="w-6 h-6 text-slate-700" />
            <p className="text-xs text-wa-text/70">Nenhuma mensagem registrada ainda</p>
            <p className="text-[10px] text-slate-700">As mensagens aparecem após serem recebidas/enviadas com o app aberto</p>
          </div>
        ) : (
          messages.map(msg => (
            <div key={msg.id} className={`flex ${msg.fromMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex items-end gap-1.5 max-w-[80%] ${msg.fromMe ? 'flex-row-reverse' : ''}`}>
                {/* Avatar */}
                <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 mb-0.5 ${msg.fromMe ? 'bg-violet-500/20' : 'bg-wa-border'}`}>
                  {msg.fromMe
                    ? <Bot className="w-3 h-3 text-violet-400" />
                    : <User className="w-3 h-3 text-wa-muted/80" />
                  }
                </div>
                {/* Bubble */}
                <div className={`rounded-2xl px-3 py-2 ${msg.fromMe
                  ? 'bg-violet-500/20 border border-violet-500/20 rounded-tr-sm'
                  : 'bg-wa-bgIA border border-wa-border rounded-tl-sm'
                }`}>
                  {!msg.fromMe && (
                    <p className="text-[9px] font-semibold text-violet-400 mb-0.5">{msg.senderName}</p>
                  )}
                  <p className="text-xs text-wa-text leading-relaxed whitespace-pre-wrap break-words">{msg.text}</p>
                  <p className="text-[9px] text-wa-muted mt-1 text-right">
                    {new Date(msg.ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

