import { motion } from 'framer-motion';
import { Search, Play, Pause, StopCircle, MapPin } from 'lucide-react';
import { useRef, useState } from 'react';
import { getCidadeSugestoes } from '@/components/map/mapUtils';
import type { CidadeSugestao } from '@/components/map/mapUtils';

export interface ExtractorConfig {
  keyword: string;
  location: string;
  maxResults: number;
  minRating: number;
  categoryFilter: string;
  extractPhone: boolean;
  extractWebsite: boolean;
  extractEmail: boolean;
  extractAddress: boolean;
  extractRating: boolean;
  extractReviews: boolean;
}

interface Props {
  config: ExtractorConfig;
  onChange: (c: ExtractorConfig) => void;
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
        className={`relative w-8 h-4 rounded-full transition-colors duration-200 focus:outline-none ${checked ? 'bg-wa-green' : 'bg-wa-border'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform duration-200 ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
      </button>
    </label>
  );
}

export function ExtractorConfigPanel({ config, onChange, status, onStart, onPause, onStop, disabled }: Props) {
  const set = <K extends keyof ExtractorConfig>(k: K, v: ExtractorConfig[K]) =>
    onChange({ ...config, [k]: v });

  const isRunning = status === 'running';
  const isPaused = status === 'paused';
  const isActive = isRunning || isPaused;

  // Autocomplete de localização
  const [sugestoes, setSugestoes] = useState<CidadeSugestao[]>([]);
  const [showSug, setShowSug] = useState(false);
  const locRef = useRef<HTMLDivElement>(null);

  function handleLocationChange(val: string) {
    set('location', val);
    setSugestoes(getCidadeSugestoes(val));
    setShowSug(true);
  }

  function handleSelectSugestao(s: CidadeSugestao) {
    set('location', s.label);
    setSugestoes([]);
    setShowSug(false);
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex flex-col gap-4 h-full overflow-y-auto pr-1"
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="p-1.5 rounded-lg bg-red-500/15">
          <MapPin className="w-4 h-4 text-red-400" />
        </div>
        <div>
          <p className="text-sm font-semibold text-wa-text">Google Maps Extractor</p>
          <p className="text-[11px] text-wa-muted">Extração de leads automatizada</p>
        </div>
      </div>

      {/* Search fields */}
      <div className="rounded-xl border border-wa-border bg-wa-card p-4 flex flex-col gap-3">
        <p className="text-xs font-semibold text-wa-muted/80 uppercase tracking-wider">Busca</p>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-wa-text/70">Palavra-chave</label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-wa-muted" />
            <input
              type="text"
              value={config.keyword}
              onChange={e => set('keyword', e.target.value)}
              placeholder="Ex: Clínicas dentárias"
              disabled={isActive}
              className="w-full bg-wa-bg/60 border border-wa-border rounded-lg pl-8 pr-3 py-2 text-xs text-wa-text placeholder:text-wa-muted focus:outline-none focus:border-wa-green/40 disabled:opacity-50"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-wa-text/70">Localização</label>
          <div className="relative" ref={locRef}>
            <input
              type="text"
              value={config.location}
              onChange={e => handleLocationChange(e.target.value)}
              onFocus={() => { if (sugestoes.length) setShowSug(true); }}
              onBlur={() => setTimeout(() => setShowSug(false), 150)}
              placeholder="Ex: São Paulo, SP"
              disabled={isActive}
              className="w-full bg-wa-bg/60 border border-wa-border rounded-lg px-3 py-2 text-xs text-wa-text placeholder:text-wa-muted focus:outline-none focus:border-wa-green/40 disabled:opacity-50"
            />
            {showSug && sugestoes.length > 0 && (
              <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-wa-card border border-wa-border rounded-lg overflow-hidden shadow-xl">
                {sugestoes.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    onMouseDown={() => handleSelectSugestao(s)}
                    className="w-full text-left px-3 py-2 text-xs text-wa-text hover:bg-[var(--color-borderColor)] hover:text-wa-text flex items-center gap-2 transition-colors"
                  >
                    <MapPin className="w-3 h-3 text-wa-green flex-shrink-0" />
                    <span>{s.city}</span>
                    <span className="text-wa-muted ml-auto">{s.state}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-wa-text/70">Máx. resultados</label>
          <select
            value={config.maxResults}
            onChange={e => set('maxResults', Number(e.target.value))}
            disabled={isActive}
            className="w-full bg-wa-bg/60 border border-wa-border rounded-lg px-3 py-2 text-xs text-wa-text focus:outline-none focus:border-wa-green/40 disabled:opacity-50"
          >
            {[50, 100, 200, 500].map(n => (
              <option key={n} value={n}>{n} resultados</option>
            ))}
          </select>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-wa-border bg-wa-card p-4 flex flex-col gap-3">
        <p className="text-xs font-semibold text-wa-muted/80 uppercase tracking-wider">Filtros</p>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-wa-text/70">Avaliação mínima (estrelas)</label>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min={0} max={5} step={0.5}
              value={config.minRating}
              onChange={e => set('minRating', Number(e.target.value))}
              disabled={isActive}
              className="flex-1 accent-[var(--color-accentSuccess)] disabled:opacity-50"
            />
            <span className="text-xs text-yellow-400 w-8 text-right">
              {config.minRating > 0 ? `≥${config.minRating}★` : 'Todos'}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-wa-text/70">Filtrar por categoria</label>
          <input
            type="text"
            value={config.categoryFilter}
            onChange={e => set('categoryFilter', e.target.value)}
            placeholder="Ex: restaurante, clínica..."
            disabled={isActive}
            className="w-full bg-wa-bg/60 border border-wa-border rounded-lg px-3 py-2 text-xs text-wa-text placeholder:text-wa-muted focus:outline-none focus:border-wa-green/40 disabled:opacity-50"
          />
        </div>
      </div>

      {/* Extraction options */}
      <div className="rounded-xl border border-wa-border bg-wa-card p-4 flex flex-col gap-3">
        <p className="text-xs font-semibold text-wa-muted/80 uppercase tracking-wider">Dados a extrair</p>
        <Toggle label="Telefone" checked={config.extractPhone} onChange={v => set('extractPhone', v)} />
        <Toggle label="Website" checked={config.extractWebsite} onChange={v => set('extractWebsite', v)} />
        <Toggle label="E-mail (se disponível)" checked={config.extractEmail} onChange={v => set('extractEmail', v)} />
        <Toggle label="Endereço" checked={config.extractAddress} onChange={v => set('extractAddress', v)} />
        <Toggle label="Avaliação" checked={config.extractRating} onChange={v => set('extractRating', v)} />
        <Toggle label="Nº de avaliações" checked={config.extractReviews} onChange={v => set('extractReviews', v)} />
      </div>

      {/* Action buttons */}
      <div className="flex flex-col gap-2 mt-auto">
        {!isActive ? (
          <motion.button
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            onClick={onStart}
            disabled={disabled || !config.keyword || !config.location}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-wa-green hover:bg-wa-green text-black font-semibold text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Play className="w-4 h-4" />
            {disabled ? 'Instale o Chromium para iniciar' : 'Iniciar Extração'}
          </motion.button>
        ) : (
          <div className="flex gap-2">
            <motion.button
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={onPause}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm transition-colors ${isPaused ? 'bg-wa-green text-black hover:bg-wa-green' : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 hover:bg-yellow-500/30'}`}
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

