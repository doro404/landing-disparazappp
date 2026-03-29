import { useState, useRef } from 'react';
import { Send, Brain, ArrowRightLeft, Tag, Database, Zap, RotateCcw, Wifi, WifiOff } from 'lucide-react';
import { IAConfig, TestResult } from './types';
import { simulateIATest, INTENT_META, SENTIMENT_META } from './iaData';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '@/context/AppContext';
import { api } from '@/lib/api';

interface Props { config: IAConfig; }

const EXAMPLE_MESSAGES = [
  'Quero saber o preço do plano pro',
  'Preciso falar com um atendente',
  'Meu pagamento não foi processado',
  'Quero comprar agora, como faço?',
  'Não tenho interesse, me remova',
  'Como funciona o sistema?',
];

interface TurnMessage {
  role: 'user' | 'assistant';
  text: string;
  ts: number;
  latencyMs?: number;
  provider?: string;
  model?: string;
  isReal?: boolean;
}

export function IATester({ config }: Props) {
  const { activeSessionId } = useApp();
  const [input, setInput] = useState('');
  const [result, setResult] = useState<TestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [useRealApi, setUseRealApi] = useState(false);
  const [turns, setTurns] = useState<TurnMessage[]>([]);
  const [multiTurn, setMultiTurn] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const runTest = async (msg?: string) => {
    const text = (msg ?? input).trim();
    if (!text) return;
    setInput('');
    setLoading(true);

    if (multiTurn) {
      const userTurn: TurnMessage = { role: 'user', text, ts: Date.now() };
      setTurns(prev => [...prev, userTurn]);

      if (useRealApi && activeSessionId) {
        try {
          const history = [...turns, userTurn].map(t => ({ role: t.role, text: t.text }));
          const res = await api.ia.test(activeSessionId, text, history.slice(0, -1));
          const asTurn: TurnMessage = {
            role: 'assistant',
            text: res.ok ? (res.response ?? '') : `Erro: ${res.error}`,
            ts: Date.now(),
            latencyMs: res.latencyMs,
            provider: res.provider,
            model: res.model,
            isReal: true,
          };
          setTurns(prev => [...prev, asTurn]);
        } catch (e) {
          setTurns(prev => [...prev, { role: 'assistant', text: `Erro: ${e instanceof Error ? e.message : String(e)}`, ts: Date.now() }]);
        }
      } else {
        await new Promise(r => setTimeout(r, 600 + Math.random() * 400));
        const sim = simulateIATest(text, config);
        setTurns(prev => [...prev, { role: 'assistant', text: sim.response, ts: Date.now(), isReal: false }]);
      }
      setResult(null);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    } else {
      setResult(null);
      if (useRealApi && activeSessionId) {
        try {
          const res = await api.ia.test(activeSessionId, text);
          setResult({
            input: text,
            response: res.ok ? (res.response ?? '') : `Erro: ${res.error}`,
            intent: 'unknown',
            sentiment: 'neutral',
            confidence: 1,
            wouldTransfer: false,
            tags: [],
            extractedData: res.latencyMs ? { latência: `${res.latencyMs}ms`, provider: res.provider ?? '', modelo: res.model ?? '' } : {},
          });
        } catch (e) {
          setResult({ input: text, response: `Erro: ${e instanceof Error ? e.message : String(e)}`, intent: 'unknown', sentiment: 'neutral', confidence: 0, wouldTransfer: false, tags: [], extractedData: {} });
        }
      } else {
        await new Promise(r => setTimeout(r, 800 + Math.random() * 600));
        setResult(simulateIATest(text, config));
      }
    }
    setLoading(false);
  };

  const intent = result ? INTENT_META[result.intent] : null;
  const sentiment = result ? SENTIMENT_META[result.sentiment] : null;

  return (
    <div className="space-y-6 overflow-y-auto h-full pr-1 pb-4">
      <div className="rounded-[12px] border border-slate-200 bg-white overflow-hidden shadow-sm">
        <div className="flex items-center gap-2.5 px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <Brain className="w-5 h-5 text-violet-600" />
          <span className="text-sm font-bold text-slate-800 tracking-tight">Testador de IA</span>
          <div className="ml-auto flex items-center gap-2.5">
            {/* Real API toggle */}
            <button
              onClick={() => setUseRealApi(v => !v)}
              title={useRealApi ? 'Usando API real' : 'Usando simulação local'}
              className={`flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-md border transition-all shadow-sm focus:outline-none ${useRealApi ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-white text-wa-muted hover:bg-slate-50 hover:text-slate-700'}`}
            >
              {useRealApi ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
              {useRealApi ? 'API Real' : 'Simulação'}
            </button>
            {/* Multi-turn toggle */}
            <button
              onClick={() => setMultiTurn(v => !v)}
              title={multiTurn ? 'Modo conversa' : 'Modo single'}
              className={`flex items-center gap-1.5 text-[11px] font-bold px-3 py-1.5 rounded-md border transition-all shadow-sm focus:outline-none ${multiTurn ? 'border-violet-200 bg-violet-50 text-violet-700' : 'border-slate-200 bg-white text-wa-muted hover:bg-slate-50 hover:text-slate-700'}`}
            >
              <ArrowRightLeft className="w-3.5 h-3.5" />
              {multiTurn ? 'Multi-turno' : 'Single'}
            </button>
            {multiTurn && turns.length > 0 && (
              <button onClick={() => setTurns([])} title="Limpar conversa"
                className="text-wa-muted hover:text-rose-500 transition-colors focus:outline-none w-8 h-8 flex items-center justify-center rounded-md hover:bg-rose-50">
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Multi-turn conversation view */}
        {multiTurn && (
          <div className="max-h-80 overflow-y-auto p-5 space-y-4 border-b border-slate-100 bg-slate-50/30">
            {turns.length === 0 ? (
              <p className="text-[13px] font-medium text-wa-muted text-center py-6">Inicie uma conversa multi-turno com a IA</p>
            ) : (
              turns.map((t, i) => (
                <div key={i} className={`flex ${t.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-[14px] px-4 py-3 text-[13px] leading-relaxed font-medium shadow-sm ${t.role === 'user' ? 'bg-violet-600 text-white rounded-tr-sm' : 'bg-white border border-slate-200 text-slate-800 rounded-tl-sm'}`}>
                    <p>{t.text}</p>
                    {t.latencyMs && (
                      <p className={`text-[10px] mt-1.5 flex items-center gap-1.5 ${t.role === 'user' ? 'text-violet-200' : 'text-wa-muted'}`}>
                        <Zap className="w-3 h-3" />{t.latencyMs}ms · {t.provider}/{t.model}
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-200 rounded-[14px] rounded-tl-sm px-4 py-3 shadow-sm">
                  <span className="flex gap-1.5">
                    {[0,1,2].map(i => <span key={i} className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}
                  </span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}

        <div className="p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-wa-muted uppercase tracking-widest">
              {multiTurn ? 'Sua mensagem' : 'Mensagem do cliente'}
            </label>
            <div className="flex gap-3">
              <input
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-[13px] text-slate-800 placeholder-slate-400 focus:outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 transition-all font-medium"
                placeholder="Digite uma mensagem para testar a IA..."
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !loading && runTest()}
              />
              <button onClick={() => runTest()}
                disabled={loading || !input.trim()}
                className="px-6 py-3 bg-violet-600 text-white rounded-xl hover:bg-violet-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-[13px] font-bold shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2">
                {loading ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Send className="w-4 h-4" />}
                Testar
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-[11px] font-bold text-wa-muted uppercase tracking-wider">Exemplos rápidos:</p>
            <div className="flex flex-wrap gap-2">
              {EXAMPLE_MESSAGES.map(msg => (
                <button key={msg} onClick={() => { setInput(msg); runTest(msg); }}
                  disabled={loading}
                  className="text-[12px] font-medium px-3.5 py-1.5 rounded-full bg-slate-100 text-wa-muted hover:bg-slate-200 hover:text-slate-900 transition-colors disabled:opacity-40 border border-slate-200/50 focus:outline-none">
                  {msg}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Single-turn result */}
      {!multiTurn && (
        <AnimatePresence>
          {loading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="rounded-[14px] border border-violet-100 bg-violet-50/50 p-8 flex flex-col items-center gap-4 shadow-sm">
              <div className="w-8 h-8 border-[3px] border-violet-200 border-t-violet-600 rounded-full animate-spin" />
              <p className="text-[13px] font-bold text-violet-700">{useRealApi ? 'Chamando API real...' : 'Analisando mensagem com IA local...'}</p>
            </motion.div>
          )}

          {result && !loading && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              <div className="rounded-[14px] border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
                <div className="flex items-center gap-2.5 mb-3">
                  <Brain className="w-5 h-5 text-emerald-600" />
                  <span className="text-sm font-bold text-emerald-800 tracking-tight">Resposta da IA</span>
                  {result.extractedData['latência'] && (
                    <span className="ml-auto flex items-center gap-1.5 text-[11px] font-medium text-emerald-600/70">
                      <Zap className="w-3.5 h-3.5 text-emerald-500" />{result.extractedData['latência']}
                      {result.extractedData['provider'] && ` · ${result.extractedData['provider']}/${result.extractedData['modelo']}`}
                    </span>
                  )}
                </div>
                <p className="text-[14px] text-emerald-950 font-medium leading-relaxed">"{result.response}"</p>
              </div>

              {!useRealApi && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-[10px] font-bold text-wa-muted uppercase tracking-widest mb-1.5">Intenção</p>
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${intent?.color}`}>{intent?.label}</span>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-[10px] font-bold text-wa-muted uppercase tracking-widest mb-1.5">Sentimento</p>
                    <span className={`text-xs font-bold ${sentiment?.color}`}>{sentiment?.icon} <span className="ml-1">{sentiment?.label}</span></span>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-[10px] font-bold text-wa-muted uppercase tracking-widest mb-1.5">Confiança</p>
                    <div className="flex items-center gap-2.5">
                      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-violet-500 rounded-full" style={{ width: `${result.confidence * 100}%` }} />
                      </div>
                      <span className="text-xs font-black text-violet-600">{Math.round(result.confidence * 100)}%</span>
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-[10px] font-bold text-wa-muted uppercase tracking-widest mb-1.5">Transferência</p>
                    {result.wouldTransfer ? (
                      <div className="flex items-center gap-1.5">
                        <ArrowRightLeft className="w-4 h-4 text-orange-500" />
                        <span className="text-[13px] text-orange-600 font-bold">Sim</span>
                      </div>
                    ) : (
                      <span className="text-[13px] text-emerald-600 font-bold">Não</span>
                    )}
                  </div>
                </div>
              )}

              {!useRealApi && result.wouldTransfer && result.transferReason && (
                <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 flex items-center gap-3 shadow-sm">
                  <ArrowRightLeft className="w-5 h-5 text-orange-600 flex-shrink-0" />
                  <p className="text-[13px] font-bold text-orange-800">Motivo: <span className="font-medium">{result.transferReason}</span></p>
                </div>
              )}

              {!useRealApi && result.tags.length > 0 && (
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <Tag className="w-4 h-4 text-wa-muted" />
                    <span className="text-[11px] font-bold text-wa-muted uppercase tracking-widest">Tags aplicadas</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {result.tags.map(t => (
                      <span key={t} className="text-[11px] font-bold px-2.5 py-1 rounded-md bg-violet-100 text-violet-700 border border-violet-200">{t}</span>
                    ))}
                  </div>
                </div>
              )}

              {!useRealApi && Object.keys(result.extractedData).filter(k => !['latência','provider','modelo'].includes(k)).length > 0 && (
                <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-center gap-2 mb-3">
                    <Database className="w-4 h-4 text-wa-muted" />
                    <span className="text-[11px] font-bold text-wa-muted uppercase tracking-widest">Dados extraídos</span>
                  </div>
                  <div className="space-y-2">
                    {Object.entries(result.extractedData).filter(([k]) => !['latência','provider','modelo'].includes(k)).map(([k, v]) => (
                      <div key={k} className="flex items-center gap-2 text-[13px]">
                        <span className="text-wa-muted capitalize font-medium">{k}:</span>
                        <span className="text-slate-900 font-bold">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  );
}

