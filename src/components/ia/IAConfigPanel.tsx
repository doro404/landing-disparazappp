import { useState } from 'react';
import { Settings2, Brain, Clock, Shield, Plus, Trash2, MessageSquare, Users, Key, ArrowRightLeft } from 'lucide-react';
import { IAConfig, AgentProfile, TransferRule, ChatScope } from './types';
import { PROFILE_META } from './iaData';

interface Props {
  config: IAConfig;
  onChange: (c: IAConfig) => void;
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[12px] border border-slate-200 bg-white overflow-hidden shadow-sm">
      <div className="flex items-center gap-2.5 px-6 py-4 border-b border-slate-100 bg-slate-50/50">
        <span className="text-violet-600">{icon}</span>
        <span className="text-sm font-bold text-slate-800 tracking-tight">{title}</span>
      </div>
      <div className="p-6 space-y-5">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5 flex flex-col">
      <label className="text-xs font-semibold text-wa-muted uppercase tracking-widest">{label}</label>
      {children}
    </div>
  );
}

const inputCls = 'w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-[13px] text-slate-800 placeholder-slate-400 focus:outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10 transition-all font-medium';
const selectCls = inputCls + ' cursor-pointer appearance-none bg-no-repeat';

export function IAConfigPanel({ config, onChange }: Props) {
  const [newForbidden, setNewForbidden] = useState('');
  const [newSensitive, setNewSensitive] = useState('');

  const set = <K extends keyof IAConfig>(key: K, value: IAConfig[K]) =>
    onChange({ ...config, [key]: value });

  const addTransferRule = () => {
    const rule: TransferRule = { id: crypto.randomUUID(), trigger: 'want_human', action: 'transfer', label: 'Nova regra' };
    set('transferRules', [...config.transferRules, rule]);
  };

  const removeTransferRule = (id: string) =>
    set('transferRules', config.transferRules.filter(r => r.id !== id));

  const updateRule = (id: string, patch: Partial<TransferRule>) =>
    set('transferRules', config.transferRules.map(r => r.id === id ? { ...r, ...patch } : r));

  return (
    <div className="space-y-6 overflow-y-auto h-full pr-1 pb-4">

      {/* Provider override per session */}
      <Section icon={<Key className="w-5 h-5" />} title="Provider desta Sessão">
        <p className="text-xs text-wa-muted mb-4 font-medium leading-relaxed">Sobrescreve o provider global das configurações para esta sessão.</p>
        <Field label="Provider">
          <select className={selectCls} value={config.provider} onChange={e => set('provider', e.target.value)}>
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic (Claude)</option>
            <option value="groq">Groq</option>
            <option value="grok">Grok (xAI)</option>
            <option value="ollama">Ollama (local)</option>
          </select>
        </Field>
        <Field label="Modelo">
          <input className={inputCls} value={config.model} onChange={e => set('model', e.target.value)}
            placeholder="Ex: gpt-4o-mini, claude-3-haiku..." />
        </Field>
        <Field label="API Key (opcional — usa a global se vazio)">
          <input type="password" className={inputCls} value={config.apiKey ?? ''}
            onChange={e => set('apiKey', e.target.value)}
            placeholder="sk-... (deixe vazio para usar a global)" />
        </Field>
      </Section>

      {/* Mode */}
      <Section icon={<Brain className="w-5 h-5" />} title="Modo de Operação">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {(['automatic', 'assisted', 'hybrid'] as const).map(m => (
            <button key={m} onClick={() => set('mode', m)}
              className={`p-4 rounded-xl border text-center transition-all duration-200 focus:outline-none ${config.mode === m ? 'border-violet-500 bg-violet-50 shadow-[0_0_0_2px_rgba(139,92,246,0.1)] ring-1 ring-violet-500' : 'border-slate-200 bg-white hover:border-violet-300 hover:bg-slate-50'}`}>
              <p className={`text-[13px] font-bold ${config.mode === m ? 'text-violet-700' : 'text-slate-700'}`}>
                {m === 'automatic' ? 'Automático' : m === 'assisted' ? 'Assistido' : 'Híbrido'}
              </p>
              <p className={`text-[11px] mt-1.5 font-medium ${config.mode === m ? 'text-violet-600/80' : 'text-wa-muted'}`}>
                {m === 'automatic' ? 'IA responde sozinha' : m === 'assisted' ? 'IA sugere, humano aprova' : 'IA + escalonamento'}
              </p>
            </button>
          ))}
        </div>

        {/* Chat scope */}
        <div className="pt-3 border-t border-slate-100 mt-5">
          <p className="text-[11px] font-bold text-wa-muted uppercase tracking-widest mb-3">Atender em</p>
          <div className="grid grid-cols-3 gap-3">
            {([
              { value: 'all',     label: 'Todos os chats',    icon: <MessageSquare className="w-4 h-4" />, desc: 'Privado + grupos' },
              { value: 'private', label: 'Privado',  icon: <MessageSquare className="w-4 h-4" />, desc: 'Só chats diretos' },
              { value: 'groups',  label: 'Grupos',   icon: <Users className="w-4 h-4" />,         desc: 'Só grupos' },
            ] as { value: ChatScope; label: string; icon: React.ReactNode; desc: string }[]).map(opt => (
              <button key={opt.value} onClick={() => set('chatScope', opt.value)}
                className={`flex flex-col items-center gap-2 p-3.5 rounded-xl border text-center transition-all focus:outline-none ${config.chatScope === opt.value ? 'border-violet-500 bg-violet-50 text-violet-700 shadow-sm ring-1 ring-violet-500' : 'border-slate-200 bg-white text-wa-muted hover:border-violet-300 hover:bg-slate-50'}`}>
                {opt.icon}
                <div className="space-y-0.5">
                  <p className="text-xs font-bold leading-tight">{opt.label}</p>
                  <p className={`text-[10px] ${config.chatScope === opt.value ? 'text-violet-600/70' : 'text-wa-muted'}`}>{opt.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </Section>

      {/* Profile */}
      <Section icon={<Settings2 className="w-5 h-5" />} title="Perfil da Inteligência Artificial">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {(Object.keys(PROFILE_META) as AgentProfile[]).map(p => {
            const meta = PROFILE_META[p];
            return (
              <button key={p} onClick={() => set('profile', p)}
                className={`flex items-start gap-3 p-4 rounded-xl border text-left transition-all focus:outline-none ${config.profile === p ? 'border-violet-500 bg-violet-50 ring-1 ring-violet-500 shadow-sm' : 'border-slate-200 bg-white hover:border-violet-300 hover:bg-slate-50'}`}>
                <span className={`text-[10px] font-black px-2 py-1 rounded-md tracking-wider uppercase ${meta.color}`}>
                  {meta.label.split(' ')[0]}
                </span>
                <div className="space-y-1">
                  <p className={`text-[13px] font-bold leading-tight ${config.profile === p ? 'text-violet-800' : 'text-slate-800'}`}>{meta.label}</p>
                  <p className={`text-[11px] font-medium leading-relaxed ${config.profile === p ? 'text-violet-600/80' : 'text-wa-muted'}`}>{meta.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </Section>

      {/* Timing */}
      <Section icon={<Clock className="w-5 h-5" />} title="Horário e Delays">
        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
          <div>
            <span className="text-[13px] font-bold text-slate-800">Horário de funcionamento</span>
            <p className="text-[11px] font-medium text-wa-muted mt-0.5">Definir quando a IA deve responder</p>
          </div>
          <button onClick={() => set('workingHoursEnabled', !config.workingHoursEnabled)}
            className={`w-11 h-6 rounded-full transition-colors relative shadow-inner ${config.workingHoursEnabled ? 'bg-emerald-500' : 'bg-slate-300'}`}>
            <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm transition-all ${config.workingHoursEnabled ? 'left-6' : 'left-1'}`} />
          </button>
        </div>
        {config.workingHoursEnabled && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Início">
              <input type="time" className={inputCls} value={config.workingHoursStart}
                onChange={e => set('workingHoursStart', e.target.value)} />
            </Field>
            <Field label="Fim">
              <input type="time" className={inputCls} value={config.workingHoursEnd}
                onChange={e => set('workingHoursEnd', e.target.value)} />
            </Field>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Delay mín. (s)">
            <input type="number" min={0} max={60} className={inputCls} value={config.responseDelayMin}
              onChange={e => set('responseDelayMin', parseInt(e.target.value))} />
          </Field>
          <Field label="Delay máx. (s)">
            <input type="number" min={0} max={120} className={inputCls} value={config.responseDelayMax}
              onChange={e => set('responseDelayMax', parseInt(e.target.value))} />
          </Field>
        </div>
        <Field label="Máx. mensagens automáticas por conversa">
          <input type="number" min={1} max={100} className={inputCls} value={config.maxAutoMessages}
            onChange={e => set('maxAutoMessages', parseInt(e.target.value))} />
        </Field>
      </Section>

      {/* Safety */}
      <Section icon={<Shield className="w-5 h-5" />} title="Segurança e Filtros">
        <Field label="Palavras proibidas (IA nunca usa)">
          <div className="flex flex-wrap gap-2 mb-3">
            {config.forbiddenWords.map(w => (
              <span key={w} className="flex items-center gap-1.5 text-xs font-semibold bg-rose-50 text-rose-600 border border-rose-200 px-3 py-1 rounded-full shadow-sm">
                {w}
                <button onClick={() => set('forbiddenWords', config.forbiddenWords.filter(x => x !== w))} className="hover:text-rose-800 focus:outline-none">
                  <Trash2 className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-3">
            <input className={inputCls} placeholder="Adicionar palavra proibida..." value={newForbidden}
              onChange={e => setNewForbidden(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && newForbidden.trim()) { set('forbiddenWords', [...config.forbiddenWords, newForbidden.trim()]); setNewForbidden(''); }}} />
            <button onClick={() => { if (newForbidden.trim()) { set('forbiddenWords', [...config.forbiddenWords, newForbidden.trim()]); setNewForbidden(''); }}}
              className="px-4 py-3 bg-white border border-slate-200 text-wa-muted rounded-xl hover:bg-slate-50 hover:text-rose-600 transition-colors shadow-sm font-semibold focus:outline-none focus:ring-2 focus:ring-slate-200">
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </Field>

        <Field label="Palavras sensíveis (aciona transferência)">
          <div className="flex flex-wrap gap-2 mb-3 mt-4">
            {config.sensitiveWords.map(w => (
              <span key={w} className="flex items-center gap-1.5 text-xs font-semibold bg-amber-50 text-amber-600 border border-amber-200 px-3 py-1 rounded-full shadow-sm">
                {w}
                <button onClick={() => set('sensitiveWords', config.sensitiveWords.filter(x => x !== w))} className="hover:text-amber-800 focus:outline-none">
                  <Trash2 className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-3">
            <input className={inputCls} placeholder="Adicionar palavra sensível..." value={newSensitive}
              onChange={e => setNewSensitive(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && newSensitive.trim()) { set('sensitiveWords', [...config.sensitiveWords, newSensitive.trim()]); setNewSensitive(''); }}} />
            <button onClick={() => { if (newSensitive.trim()) { set('sensitiveWords', [...config.sensitiveWords, newSensitive.trim()]); setNewSensitive(''); }}}
              className="px-4 py-3 bg-white border border-slate-200 text-wa-muted rounded-xl hover:bg-slate-50 hover:text-amber-600 transition-colors shadow-sm font-semibold focus:outline-none focus:ring-2 focus:ring-slate-200">
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </Field>

        <div className="mt-4">
          <Field label="Mensagem de fallback">
            <textarea className={inputCls + ' h-24 resize-none leading-relaxed'} value={config.fallbackMessage}
              onChange={e => set('fallbackMessage', e.target.value)} />
          </Field>
        </div>
      </Section>

      {/* Transfer rules */}
      <Section icon={<ArrowRightLeft className="w-5 h-5" />} title="Regras de Transferência">
        <Field label="Webhook de notificação (POST ao transferir)">
          <input className={inputCls} value={config.transferWebhook ?? ''}
            onChange={e => set('transferWebhook', e.target.value)}
            placeholder="https://seu-webhook.com/ia-transfer" />
        </Field>
        <div className="space-y-3 mt-4">
          {config.transferRules.map(rule => (
            <div key={rule.id} className="flex items-center gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200 shadow-sm">
              <div className="flex-1 space-y-2">
                <input className={inputCls} value={rule.label}
                  onChange={e => updateRule(rule.id, { label: e.target.value })} />
                <select className={selectCls} value={rule.action}
                  onChange={e => updateRule(rule.id, { action: e.target.value as TransferRule['action'] })}>
                  <option value="transfer">Transferir para humano</option>
                  <option value="pause">Pausar IA</option>
                  <option value="tag">Aplicar tag</option>
                </select>
              </div>
              <button onClick={() => removeTransferRule(rule.id)} className="w-10 h-10 flex items-center justify-center rounded-lg text-wa-muted hover:text-rose-500 hover:bg-rose-50 transition-colors focus:outline-none">
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          ))}
          <button onClick={addTransferRule}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl border-2 border-dashed border-slate-300 text-[13px] font-bold text-wa-muted hover:border-violet-400 hover:text-violet-600 hover:bg-violet-50 transition-all focus:outline-none">
            <Plus className="w-4 h-4" />Adicionar Nova Regra
          </button>
        </div>
      </Section>
    </div>
  );
}

