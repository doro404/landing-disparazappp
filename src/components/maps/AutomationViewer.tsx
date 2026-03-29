import { useEffect, useRef, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { MapPin, RefreshCw } from 'lucide-react';
import { BrazilMap } from '@/components/map/BrazilMap';
import { resolveLocationToStates, getStatesFromLocation, pinCoords } from '@/components/map/mapUtils';
import type { StateMapData, MapPin as IMapPin } from '@/components/map/types';

interface Props {
  status: 'idle' | 'running' | 'paused' | 'done';
  keyword: string;
  location: string;
  collected: number;
  maxResults: number;
  currentBusiness: string;
}

export function AutomationViewer({ status, location, collected, maxResults, currentBusiness }: Props) {
  const isRunning = status === 'running';
  const isPaused = status === 'paused';
  const isDone = status === 'done';
  const progress = maxResults > 0 ? Math.min((collected / maxResults) * 100, 100) : 0;

  // Resolve location → states (async, debounced 400ms, com fallback síncrono imediato)
  const [activeStates, setActiveStates] = useState<string[]>(() => getStatesFromLocation(location));
  useEffect(() => {
    // Aplica fallback local imediatamente (sem delay)
    setActiveStates(getStatesFromLocation(location));
    if (!location.trim()) return;
    // Tenta Nominatim em background
    const timer = setTimeout(() => {
      resolveLocationToStates(location).then(states => {
        if (states.length > 0) setActiveStates(states);
      }).catch(() => {/* silencioso */});
    }, 400);
    return () => clearTimeout(timer);
  }, [location]);

  const [stateCounts, setStateCounts] = useState<Record<string, number>>({});
  const [pins, setPins] = useState<IMapPin[]>([]);
  const prevCollected = useRef(0);
  const totalPinsRef = useRef(0);

  // Reset on new extraction
  useEffect(() => {
    if (status === 'running' && collected === 0) {
      setStateCounts({});
      setPins([]);
      prevCollected.current = 0;
      totalPinsRef.current = 0;
    }
  }, [status, collected]);

  // Add pins as leads are collected
  useEffect(() => {
    if (collected > prevCollected.current && activeStates.length > 0) {
      const newCount = collected - prevCollected.current;
      const newPins: IMapPin[] = [];
      const countDelta: Record<string, number> = {};

      for (let i = 0; i < newCount; i++) {
        const globalIdx = totalPinsRef.current + i;
        const state = activeStates[globalIdx % activeStates.length];
        if (!state) continue; // guard: never undefined
        const coords = pinCoords(state, globalIdx);
        newPins.push({ ...coords, label: currentBusiness || state, active: false });
        countDelta[state] = (countDelta[state] ?? 0) + 1;
      }

      totalPinsRef.current += newCount;

      // Mark last pin as active
      if (newPins.length > 0) newPins[newPins.length - 1].active = true;

      setPins(prev => {
        const updated = prev.map(p => ({ ...p, active: false }));
        // Keep max 150 pins visible
        const combined = [...updated, ...newPins];
        return combined.slice(-150);
      });

      setStateCounts(prev => {
        const next = { ...prev };
        for (const [s, c] of Object.entries(countDelta)) next[s] = (next[s] ?? 0) + c;
        return next;
      });
    }
    prevCollected.current = collected;
  }, [collected, activeStates, currentBusiness]);

  const mapData: StateMapData[] = useMemo(() => {
    const maxCount = Math.max(...Object.values(stateCounts), 1);
    return Object.entries(stateCounts).map(([id, count]) => {
      const pct = (count / maxCount) * 100;
      const st = pct >= 66 ? 'alto' : pct >= 33 ? 'medio' : 'baixo';
      return { id, value: count, status: st };
    });
  }, [stateCounts]);

  const statusLabel = isRunning ? `Extraindo: "${currentBusiness}"`
    : isPaused ? 'Pausado'
    : isDone ? 'Extração concluída'
    : 'Aguardando início...';

  const statusColor = isRunning ? 'text-wa-green'
    : isPaused ? 'text-yellow-400'
    : isDone ? 'text-wa-green'
    : 'text-wa-muted';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col h-full rounded-xl border border-wa-border bg-wa-bg/80 overflow-hidden"
    >
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-wa-border bg-wa-card">
        <div className="flex items-center gap-2">
          <MapPin className="w-3.5 h-3.5 text-wa-green" />
          <span className="text-xs font-semibold text-wa-text">Mapa de Extração</span>
          {location && (
            <span className="text-[10px] text-wa-muted bg-wa-bg/60 border border-wa-border rounded px-1.5 py-0.5 truncate max-w-[160px]">
              {location}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isRunning && <RefreshCw className="w-3 h-3 text-wa-green animate-spin" />}
          <div className={`w-1.5 h-1.5 rounded-full ${isRunning ? 'bg-wa-green animate-pulse' : isPaused ? 'bg-yellow-400' : isDone ? 'bg-wa-green' : 'bg-slate-600'}`} />
          <span className="text-[10px] text-wa-text/60">
            {isRunning ? 'Executando' : isPaused ? 'Pausado' : isDone ? 'Concluído' : 'Aguardando'}
          </span>
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 min-h-0 overflow-hidden relative">
        <BrazilMap
          selectedStates={activeStates}
          data={mapData}
          pins={pins}
          multiSelect={false}
          interactive={false}
          height="100%"
        />

        {/* No location hint */}
        {(isRunning || isPaused) && activeStates.length === 0 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-3 py-1.5 pointer-events-none z-10">
            <p className="text-[10px] text-yellow-400 text-center whitespace-nowrap">
              Digite uma cidade ou estado para ver no mapa
            </p>
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="flex-shrink-0 border-t border-wa-border bg-wa-card px-3 py-2 flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-[10px]">
          <span className={`truncate max-w-[60%] ${statusColor}`}>{statusLabel}</span>
          <span className="text-wa-muted flex-shrink-0">
            <span className="text-wa-text font-semibold">{collected}</span>
            <span className="text-wa-muted"> / {maxResults} coletados</span>
          </span>
        </div>
        <div className="h-1 rounded-full bg-[var(--color-borderColor)] overflow-hidden">
          <motion.div
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className={`h-full rounded-full ${isDone ? 'bg-wa-green' : isPaused ? 'bg-yellow-400' : 'bg-gradient-to-r from-[var(--color-accentSuccess)] to-emerald-400'}`}
          />
        </div>
      </div>
    </motion.div>
  );
}

