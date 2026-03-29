import { useState, useEffect, useCallback } from 'react';
import { History, RefreshCw, Trash2, MessageSquare, Bot, User, ArrowRightLeft } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { api } from '@/lib/api';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ConvSummary {
  jid: string;
  messageCount: number;
  lastTs: number;
  lastText: string;
}

interface HistoryMsg {
  role: string;
  text: string;
  ts: number;
}

export function IAHistoryPanel() {
  const { activeSessionId } = useApp();
  const [conversations, setConversations] = useState<ConvSummary[]>([]);
  const [selected, setSelected] = useState<ConvSummary | null>(null);
  const [messages, setMessages] = useState<HistoryMsg[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMsgs, setLoadingMsgs] = useState(false);

  const fetchConversations = useCallback(async () => {
    if (!activeSessionId) return;
    setLoading(true);
    try {
      const res = await api.ia.history(activeSessionId);
      if (res.ok) setConversations(res.conversations);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [activeSessionId]);

  useEffect(() => { fetchConversations(); }, [fetchConversations]);

  const selectConversation = async (conv: ConvSummary) => {
    setSelected(conv);
    setLoadingMsgs(true);
    try {
      const res = await api.ia.historyJid(activeSessionId!, conv.jid);
      if (res.ok) setMessages(res.messages);
    } catch { setMessages([]); }
    finally { setLoadingMsgs(false); }
  };

  const clearHistory = async (jid: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!activeSessionId) return;
    await api.ia.clearHistory(activeSessionId, jid);
    setConversations(prev => prev.filter(c => c.jid !== jid));
    if (selected?.jid === jid) { setSelected(null); setMessages([]); }
  };

  const triggerTransfer = async (jid: string) => {
    if (!activeSessionId) return;
    await api.ia.transfer(activeSessionId, jid, 'manual_from_history');
  };

  return (
    <div className="grid grid-cols-[280px_1fr] gap-3 h-full overflow-hidden">
      {/* Conversation list */}
      <div className="flex flex-col rounded-xl border border-wa-border bg-wa-card overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-wa-border bg-wa-bgIA flex-shrink-0">
          <History className="w-3.5 h-3.5 text-violet-400" />
          <span className="text-xs font-semibold text-wa-text">Histórico Persistido</span>
          <button onClick={fetchConversations} disabled={loading}
            className="ml-auto text-wa-muted hover:text-violet-400 transition-colors disabled:opacity-40">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <ScrollArea className="flex-1">
          {conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 gap-2 text-center px-4">
              <MessageSquare className="w-6 h-6 text-slate-700" />
              <p className="text-xs text-wa-text/70">Nenhum histórico ainda</p>
            </div>
          ) : (
            conversations.map(c => (
              <div key={c.jid} onClick={() => selectConversation(c)}
                className={`p-3 border-b border-wa-border cursor-pointer transition-colors ${selected?.jid === c.jid ? 'bg-violet-500/10' : 'hover:bg-wa-bgIA'}`}>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs font-medium text-wa-text truncate max-w-[160px]">
                    {c.jid.replace('@s.whatsapp.net', '').replace('@g.us', '')}
                  </span>
                  <button onClick={e => clearHistory(c.jid, e)}
                    className="text-slate-700 hover:text-red-400 transition-colors flex-shrink-0">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
                <p className="text-[10px] text-wa-muted truncate">{c.lastText}</p>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[9px] text-wa-muted">{c.messageCount} msgs</span>
                  <span className="text-[9px] text-wa-muted">
                    {new Date(c.lastTs).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))
          )}
        </ScrollArea>
      </div>

      {/* Message detail */}
      <div className="flex flex-col rounded-xl border border-wa-border bg-wa-card overflow-hidden">
        {!selected ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-center px-6">
            <History className="w-8 h-8 text-slate-700" />
            <p className="text-sm text-wa-muted">Selecione uma conversa para ver o histórico</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-wa-border bg-wa-bgIA flex-shrink-0">
              <span className="text-xs font-semibold text-wa-text truncate">
                {selected.jid.replace('@s.whatsapp.net', '').replace('@g.us', '')}
              </span>
              <span className="text-[10px] text-wa-text/60">{messages.length} mensagens</span>
              <button onClick={() => triggerTransfer(selected.jid)}
                title="Transferir para humano e disparar webhook"
                className="ml-auto flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg border border-orange-500/30 bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 transition-colors">
                <ArrowRightLeft className="w-3 h-3" />Transferir
              </button>
            </div>
            <ScrollArea className="flex-1 p-3">
              {loadingMsgs ? (
                <div className="flex items-center justify-center h-24 gap-2 text-xs text-wa-muted">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />Carregando...
                </div>
              ) : (
                <div className="space-y-2">
                  {messages.map((m, i) => (
                    <div key={i} className={`flex gap-2 ${m.role === 'user' ? 'justify-start' : 'justify-end'}`}>
                      {m.role === 'user' && <User className="w-4 h-4 text-wa-muted flex-shrink-0 mt-0.5" />}
                      <div className={`max-w-[75%] rounded-xl px-3 py-2 text-xs ${m.role === 'user' ? 'bg-wa-bgIA border border-wa-border text-wa-text' : 'bg-violet-500/15 border border-violet-500/20 text-violet-100'}`}>
                        <p className="leading-relaxed">{m.text}</p>
                        <p className="text-[9px] text-wa-muted mt-1">
                          {new Date(m.ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      {m.role === 'assistant' && <Bot className="w-4 h-4 text-violet-400 flex-shrink-0 mt-0.5" />}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </>
        )}
      </div>
    </div>
  );
}

