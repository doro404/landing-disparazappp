import { motion } from 'framer-motion';
import { Search, Play, Pause, StopCircle, Telescope } from 'lucide-react';

export interface FinderConfig {
  keyword: string;
  location: string;
  maxResults: number;
  sources: {
    google: boolean;
    telegram: boolean;
    groupSites: boolean;
    forums: boolean;
    reddit: boolean;
  };
  onlyActive: boolean;
  removeDuplicates: boolean;
  validateLinks: boolean;
}

export const DEFAULT_FINDER_CONFIG: FinderConfig = {
  keyword: '',
  location: '',
  maxResults: 100,
  sources: { google: true, telegram: true, groupSites: true, forums: true, reddit: false },
  onlyActive: true,
  removeDuplicates: true,
  validateLinks: false,
};

interface Props {
  config: FinderConfig;
  onChange: (c: FinderConfig) => void;
  status: 'idle' | 'running' | 'paused' | 'done';
  onStart: () => void;
  onPause: () => void;
  onStop: () => void;
  disabled?: boolean;
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-2 cursor-pointer select-none">
      <span className="text-xs text-wa-muted/80">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-8 h-4 rounded-full transition-colors duration-200 focus:outline-none ${checked ? 'bg-accent-success' : 'bg-text-secondary/30'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform duration-200 ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
      </button>
    </label>
  );
}

export function FinderConfigPanel({ config, onChange, status, onStart, onPause, onStop, disabled }: Props) {
  const set = <K extends keyof FinderConfig>(k: K, v: FinderConfig[K]) => onChange({ ...config, [k]: v });
  const setSrc = (k: keyof FinderConfig['sources'], v: boolean) =>
    onChange({ ...config, sources: { ...config.sources, [k]: v } });

  const isActive = status === 'running' || status === 'paused';
  const isPaused = status === 'paused';

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex flex-col gap-4 h-full overflow-y-auto pr-1"
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded-lg bg-violet-500/15">
          <Telescope className="w-4 h-4 text-violet-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-wa-text">Group Finder</p>
          <p className="text-[11px] text-wa-muted">Busca links de grupos no Google e mais</p>
        </div>
      </div>

      {/* Search fields */}
      <div className="rounded-xl border border-wa-border bg-wa-card p-4 flex flex-col gap-3">
        <p className="text-xs font-semibold text-wa-muted/80 uppercase tracking-wider">Busca</p>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-text-secondary">Palavra-chave</label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-secondary/50" />
            <input
              type="text"
              value={config.keyword}
              onChange={e => set('keyword', e.target.value)}
              placeholder="Ex: marketing, criptomoedas"
              disabled={isActive}
              className="w-full bg-bg-secondary border border-border-color rounded-lg pl-8 pr-3 py-2 text-xs text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-accent-primary/40 disabled:opacity-50"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-text-secondary">Localização (opcional)</label>
          <input
            type="text"
            value={config.location}
            onChange={e => set('location', e.target.value)}
            placeholder="Ex: Brazil, Portugal"
            disabled={isActive}
            className="w-full bg-bg-secondary border border-border-color rounded-lg px-3 py-2 text-xs text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-accent-primary/40 disabled:opacity-50"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-text-secondary">Máx. resultados</label>
          <select
            value={config.maxResults}
            onChange={e => set('maxResults', Number(e.target.value))}
            disabled={isActive}
            className="w-full bg-bg-secondary border border-border-color rounded-lg px-3 py-2 text-xs text-text-primary focus:outline-none focus:border-accent-primary/40 disabled:opacity-50"
          >
            {[50, 100, 200, 500].map(n => <option key={n} value={n}>{n} grupos</option>)}
          </select>
        </div>
      </div>

      {/* Sources */}
      <div className="rounded-xl border border-wa-border bg-wa-card p-4 flex flex-col gap-3">
        <p className="text-xs font-semibold text-wa-muted/80 uppercase tracking-wider">Fontes de busca</p>
        <Toggle label="Google Search" checked={config.sources.google} onChange={v => setSrc('google', v)} />
        <Toggle label="Diretórios Telegram" checked={config.sources.telegram} onChange={v => setSrc('telegram', v)} />
        <Toggle label="Sites de grupos" checked={config.sources.groupSites} onChange={v => setSrc('groupSites', v)} />
        <Toggle label="Fóruns e blogs" checked={config.sources.forums} onChange={v => setSrc('forums', v)} />
        <Toggle label="Reddit" checked={config.sources.reddit} onChange={v => setSrc('reddit', v)} />
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-wa-border bg-wa-card p-4 flex flex-col gap-3">
        <p className="text-xs font-semibold text-wa-muted/80 uppercase tracking-wider">Filtros</p>
        <Toggle label="Apenas grupos ativos" checked={config.onlyActive} onChange={v => set('onlyActive', v)} />
        <Toggle label="Remover duplicatas" checked={config.removeDuplicates} onChange={v => set('removeDuplicates', v)} />
        <Toggle label="Validar links" checked={config.validateLinks} onChange={v => set('validateLinks', v)} />
      </div>

      {/* Buttons */}
      <div className="flex flex-col gap-2 mt-auto">
        {!isActive ? (
          <motion.button
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            onClick={onStart}
            disabled={disabled || !config.keyword}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-accent-success hover:bg-accent-success/80 text-text-inverse font-semibold text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Play className="w-4 h-4" />
            {disabled ? 'Instale o Chromium para iniciar' : 'Iniciar Busca'}
          </motion.button>
        ) : (
          <div className="flex gap-2">
            <motion.button
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={onPause}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm transition-colors ${isPaused ? 'bg-accent-success text-text-inverse hover:bg-accent-success/80' : 'bg-accent-warning/20 text-accent-warning border border-accent-warning/30 hover:bg-accent-warning/30'}`}
            >
              <Pause className="w-4 h-4" />
              {isPaused ? 'Retomar' : 'Pausar'}
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={onStop}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 font-semibold text-sm transition-colors"
            >
              <StopCircle className="w-4 h-4" />
              Parar
            </motion.button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

