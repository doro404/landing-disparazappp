import { Brain, Power, AlertTriangle } from 'lucide-react';
import { IAConfig } from './types';
import { useApp } from '@/context/AppContext';

interface Props {
  config: IAConfig;
  onToggle: () => void;
}

export function IAHeader({ config, onToggle }: Props) {
  const { settings } = useApp();
  const noProvider = settings.aiProvider === 'none' || !settings.aiProvider;
  const noKey = settings.aiProvider !== 'none' && settings.aiProvider !== 'ollama' && !settings.aiApiKey;
  return (
    <div className="flex-shrink-0 rounded-[14px] border border-wa-border bg-wa-card p-6 shadow-sm">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-xl bg-violet-50 flex items-center justify-center border border-violet-100">
              <Brain className="w-6 h-6 text-violet-600" />
            </div>
            <span className={`absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full border-[2.5px] border-white ${config.enabled ? 'bg-emerald-500' : 'bg-slate-400'}`} />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">Status da IA</h1>
              <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full ${config.enabled ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-wa-muted border border-slate-200'}`}>
                {config.enabled ? '● ONLINE' : '○ OFFLINE'}
              </span>
            </div>
            <p className="text-[13px] text-wa-muted mt-1 font-medium">
              Modo: <span className="text-violet-600 font-semibold">
                {config.mode === 'automatic' ? 'Automático' : config.mode === 'assisted' ? 'Assistido' : 'Híbrido'}
              </span>
              <span className="mx-1.5 text-wa-text">•</span>Perfil: <span className="text-slate-700">{config.profile}</span>
              <span className="mx-1.5 text-wa-text">•</span>Provedor: <span className={noProvider ? 'text-orange-500 font-semibold' : 'text-slate-700'}>{noProvider ? 'não configurado' : settings.aiProvider}</span>
            </p>
          </div>
        </div>

        <button
          onClick={onToggle}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all shadow-sm ${
            config.enabled
              ? 'bg-white text-rose-600 border-2 border-rose-100 hover:bg-rose-50 hover:border-rose-200'
              : 'bg-gradient-to-r from-emerald-500 to-emerald-400 text-white border-none hover:shadow-md hover:-translate-y-0.5'
          }`}
        >
          <Power className="w-4 h-4" />
          {config.enabled ? 'Desativar IA' : 'Ativar IA'}
        </button>
      </div>

      {/* Aviso de configuração */}
      {(noProvider || noKey) && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
          {noProvider
            ? 'Nenhum provedor de IA configurado. Acesse Configurações → IA para configurar.'
            : 'Chave de API não configurada. Acesse Configurações → IA para adicionar.'}
        </div>
      )}
    </div>
  );
}

