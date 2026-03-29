import { useState } from 'react';
import { Sparkles, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';
import { IAConfig } from './types';
import { PROMPT_PRESETS, PROFILE_META } from './iaData';

interface Props {
  config: IAConfig;
  onChange: (c: IAConfig) => void;
}

const inputCls = 'w-full bg-wa-bgIA border border-wa-border rounded-lg px-3 py-2 text-sm text-wa-text placeholder-wa-muted/40 focus:outline-none focus:border-violet-500/50 transition-colors';
const selectCls = inputCls + ' cursor-pointer';

export function IAPromptEditor({ config, onChange }: Props) {
  const [expandedPreset, setExpandedPreset] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const set = <K extends keyof IAConfig>(key: K, value: IAConfig[K]) =>
    onChange({ ...config, [key]: value });

  const applyPreset = (presetId: string) => {
    const preset = PROMPT_PRESETS.find(p => p.id === presetId);
    if (!preset) return;
    onChange({ ...config, basePrompt: preset.prompt, tone: preset.tone, profile: preset.profile });
  };

  const copyPrompt = () => {
    navigator.clipboard.writeText(config.basePrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4 overflow-y-auto h-full pr-1">

      {/* Presets */}
      <div className="rounded-xl border border-wa-border bg-wa-card overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-wa-border bg-wa-bgIA">
          <Sparkles className="w-4 h-4 text-violet-400" />
          <span className="text-sm font-semibold text-wa-text">Prompts Prontos</span>
          <span className="text-[10px] text-wa-muted ml-auto">{PROMPT_PRESETS.length} presets</span>
        </div>
        <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-2">
          {PROMPT_PRESETS.map(preset => {
            const isExpanded = expandedPreset === preset.id;
            const profileMeta = PROFILE_META[preset.profile];
            return (
              <div key={preset.id} className="rounded-xl border border-wa-border bg-wa-bgIA overflow-hidden">
                <div className="flex items-center justify-between p-3">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${profileMeta.color}`}>
                      {profileMeta.label.split(' ')[0]}
                    </span>
                    <div>
                      <p className="text-xs font-semibold text-wa-text">{preset.label}</p>
                      <p className="text-[10px] text-wa-text/60">{preset.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => applyPreset(preset.id)}
                      className="text-[10px] px-2 py-1 bg-violet-500/15 text-violet-400 rounded-lg hover:bg-violet-500/25 transition-colors font-medium">
                      Usar
                    </button>
                    <button onClick={() => setExpandedPreset(isExpanded ? null : preset.id)}
                      className="text-wa-muted hover:text-wa-muted/80 transition-colors p-1">
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
                {isExpanded && (
                  <div className="px-3 pb-3 border-t border-wa-border pt-2">
                    <p className="text-[11px] text-wa-muted/80 leading-relaxed">{preset.prompt}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Prompt editor */}
      <div className="rounded-xl border border-wa-border bg-wa-card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-wa-border bg-wa-bgIA">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-violet-400" />
            <span className="text-sm font-semibold text-wa-text">Prompt do Agente</span>
          </div>
          <button onClick={copyPrompt} className="flex items-center gap-1.5 text-[11px] text-wa-muted hover:text-violet-400 transition-colors">
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copiado!' : 'Copiar'}
          </button>
        </div>
        <div className="p-4 space-y-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-wa-muted/80">Prompt base (instruções do agente)</label>
            <textarea
              className={inputCls + ' h-36 resize-none font-mono text-xs leading-relaxed'}
              value={config.basePrompt}
              onChange={e => set('basePrompt', e.target.value)}
              placeholder="Você é um assistente de vendas..."
            />
            <p className="text-[10px] text-wa-text/60">{config.basePrompt.length} caracteres</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-wa-muted/80">Tom de voz</label>
              <select className={selectCls} value={config.tone} onChange={e => set('tone', e.target.value as IAConfig['tone'])}>
                <option value="formal">Formal</option>
                <option value="friendly">Amigável</option>
                <option value="direct">Direto</option>
                <option value="empathetic">Empático</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-wa-muted/80">Idioma</label>
              <select className={selectCls} value={config.language} onChange={e => set('language', e.target.value)}>
                <option value="pt-BR">Português (BR)</option>
                <option value="en-US">English (US)</option>
                <option value="es-ES">Español</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Advanced prompt sections */}
      <div className="rounded-xl border border-wa-border bg-wa-card overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-wa-border bg-wa-bgIA">
          <Sparkles className="w-4 h-4 text-violet-400" />
          <span className="text-sm font-semibold text-wa-text">Engenharia de Prompt Avançada</span>
        </div>
        <div className="p-4 space-y-3">
          {[
            { key: 'objectives', label: 'Objetivos principais', placeholder: 'Ex: Qualificar o lead, apresentar planos, fechar venda...' },
            { key: 'restrictions', label: 'Restrições', placeholder: 'Ex: Não mencionar concorrentes, não prometer descontos...' },
            { key: 'closing', label: 'Forma de encerramento', placeholder: 'Ex: Sempre perguntar se pode ajudar em mais algo...' },
            { key: 'scope', label: 'Escopo de atuação', placeholder: 'Ex: Apenas responder sobre nossos produtos e serviços...' },
          ].map(field => (
            <div key={field.key} className="space-y-1">
              <label className="text-xs font-medium text-wa-muted/80">{field.label}</label>
              <textarea
                className={inputCls + ' h-16 resize-none text-xs'}
                placeholder={field.placeholder}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

