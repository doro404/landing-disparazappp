import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LogIn, Play, Square, Trash2, Copy, Download,
  CheckCircle, XCircle, Clock, AlertCircle, Loader2, Users, Link2,
  Pause, History, ChevronDown, ChevronUp, Bell,
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useApp } from '@/context/AppContext';

const SIDECAR = 'http://127.0.0.1:3001';

// ─── Tipos ────────────────────────────────────────────────────────────────────
type JoinStatus = 'joined' | 'already_member' | 'invalid' | 'full' | 'request_sent'
  | 'rate_limit' | 'error' | 'pending' | 'skipped_members' | 'skipped_type';

interface JoinResult {
  link: string;
  code: string | null;
  groupId?: string;
  groupName?: string;
  memberCount?: number;
  status: JoinStatus;
  errorMessage?: string;
  timestamp: string;
}

interface HistoryEntry {
  jobId: string;
  startedAt: string;
  finishedAt: string;
  sessionIds: string[];
  total: number;
  results: JoinResult[];
}

const STATUS_CONFIG: Record<JoinStatus, { label: string; color: string; icon: React.ElementType }> = {
  joined:          { label: 'Entrou',     color: 'text-wa-green',  icon: CheckCircle },
  already_member:  { label: 'Já membro',  color: 'text-sky-400',    icon: CheckCircle },
  request_sent:    { label: 'Solicitado', color: 'text-yellow-400', icon: Clock },
  invalid:         { label: 'Inválido',   color: 'text-red-400',    icon: XCircle },
  full:            { label: 'Cheio',      color: 'text-orange-400', icon: AlertCircle },
  rate_limit:      { label: 'Rate limit', color: 'text-orange-400', icon: AlertCircle },
  error:           { label: 'Erro',       color: 'text-red-400',    icon: XCircle },
  pending:         { label: 'Aguardando', color: 'text-wa-muted',  icon: Clock },
  skipped_members: { label: 'Pulado',     color: 'text-wa-muted',  icon: Clock },
  skipped_type:    { label: 'Pulado',     color: 'text-wa-muted',  icon: Clock },
};

async function sendFinishNotification(joined: number, total: number) {
  try {
    if ('Notification' in window) {
      if (Notification.permission === 'default') await Notification.requestPermission();
      if (Notification.permission === 'granted') {
        new Notification('Group Joiner — Concluído', {
          body: `Entrou em ${joined}/${total} grupos.`,
        });
      }
    }
  } catch {}
}

// ─── HistoryPanel ─────────────────────────────────────────────────────────────
function HistoryPanel({ onRestore }: { onRestore: (results: JoinResult[]) => void }) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${SIDECAR}/groups/join/history`)
      .then(r => r.json())
      .then(d => setHistory((d.history || []).reverse()))
      .catch(() => {});
  }, []);

  const handleClear = async () => {
    await fetch(`${SIDECAR}/groups/join/history`, { method: 'DELETE' });
    setHistory([]);
  };

  if (history.length === 0) {
    return <p className="text-xs text-wa-muted text-center py-4">Nenhum histórico salvo</p>;
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] text-wa-text/60">{history.length} job(s) salvos</span>
        <button onClick={handleClear} className="text-[10px] text-wa-muted hover:text-red-400 transition-colors flex items-center gap-1">
          <Trash2 className="w-3 h-3" />Limpar
        </button>
      </div>
      {history.map(entry => {
        const joined = entry.results.filter(r => r.status === 'joined').length;
        const isOpen = expanded === entry.jobId;
        return (
          <div key={entry.jobId} className="rounded-lg border border-wa-border bg-wa-bg/80 overflow-hidden">
            <button
              onClick={() => setExpanded(isOpen ? null : entry.jobId)}
              className="w-full flex items-center justify-between px-3 py-2 hover:bg-wa-card transition-colors">
              <div className="text-left min-w-0">
                <p className="text-[10px] text-wa-text font-mono truncate">{entry.jobId}</p>
                <p className="text-[10px] text-wa-text/60">
                  {new Date(entry.startedAt).toLocaleString('pt-BR')} · {joined}/{entry.total} entrou
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={(e) => { e.stopPropagation(); onRestore(entry.results); }}
                  className="text-[10px] text-wa-green/70 hover:text-wa-green transition-colors px-1.5 py-0.5 rounded border border-wa-green/20 hover:border-wa-green/40">
                  Restaurar
                </button>
                {isOpen ? <ChevronUp className="w-3 h-3 text-wa-muted" /> : <ChevronDown className="w-3 h-3 text-wa-muted" />}
              </div>
            </button>
            {isOpen && (
              <div className="border-t border-wa-border max-h-40 overflow-y-auto">
                {entry.results.map((r, i) => {
                  const sc = STATUS_CONFIG[r.status];
                  const Icon = sc.icon;
                  return (
                    <div key={i} className="flex items-center gap-2 px-3 py-1.5 border-b border-wa-border/50 last:border-0">
                      <Icon className={`w-3 h-3 flex-shrink-0 ${sc.color}`} />
                      <span className="text-[10px] text-wa-muted/80 truncate flex-1">{r.groupName || r.code || r.link}</span>
                      <span className={`text-[10px] ${sc.color}`}>{sc.label}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── GroupJoiner (main) ───────────────────────────────────────────────────────
export function GroupJoiner({ initialLinks = [], onLinksConsumed }: { initialLinks?: string[]; onLinksConsumed?: () => void }) {
  const { sessions } = useApp();
  const connectedSessions = sessions.filter(s => s.status === 'connected');
  const connectedSession = connectedSessions[0];

  const [linksText, setLinksText] = useState('');
  const [selectedSessions, setSelectedSessions] = useState<string[]>([]);
  const [maxPerHour, setMaxPerHour] = useState(15);
  const [delayMin, setDelayMin] = useState(8);
  const [delayMax, setDelayMax] = useState(20);
  const [status, setStatus] = useState<'idle' | 'running' | 'paused' | 'done'>('idle');
  const [results, setResults] = useState<JoinResult[]>([]);
  const [currentIdx, setCurrentIdx] = useState<number | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [filterMembers, setFilterMembers] = useState(false);
  const [minMembers, setMinMembers] = useState(10);
  const [maxMembers, setMaxMembers] = useState(500);
  const [groupType, setGroupType] = useState<'any' | 'open' | 'closed'>('any');
  const [showHistory, setShowHistory] = useState(false);
  const [notifyOnDone, setNotifyOnDone] = useState(true);

  const esRef = useRef<EventSource | null>(null);
  const jobIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (initialLinks.length > 0) {
      setLinksText(initialLinks.join('\n'));
      onLinksConsumed?.();
    }
  }, [initialLinks]);

  // Default selected sessions to all connected
  useEffect(() => {
    setSelectedSessions(connectedSessions.map(s => s.id));
  }, [connectedSessions.length]);

  const addLog = (msg: string) => setLogs(prev => [...prev.slice(-199), msg]);

  const stopStream = useCallback(() => {
    if (esRef.current) { esRef.current.close(); esRef.current = null; }
  }, []);

  const handleStop = useCallback(() => {
    stopStream();
    if (jobIdRef.current) {
      fetch(`${SIDECAR}/groups/join/stop/${jobIdRef.current}`, { method: 'DELETE' }).catch(() => {});
      jobIdRef.current = null;
    }
    setStatus('idle');
    addLog('■ Interrompido pelo usuário.');
  }, [stopStream]);

  const handlePauseResume = useCallback(async () => {
    if (!jobIdRef.current) return;
    if (status === 'running') {
      await fetch(`${SIDECAR}/groups/join/pause/${jobIdRef.current}`, { method: 'POST' });
      setStatus('paused');
      addLog('⏸ Pausado.');
    } else if (status === 'paused') {
      await fetch(`${SIDECAR}/groups/join/resume/${jobIdRef.current}`, { method: 'POST' });
      setStatus('running');
      addLog('▶ Retomado.');
    }
  }, [status]);

  const handleStart = useCallback(async () => {
    const activeSessions = selectedSessions.length > 0 ? selectedSessions : (connectedSession ? [connectedSession.id] : []);
    if (activeSessions.length === 0) { addLog('⚠ Nenhuma sessão selecionada.'); return; }

    const links = linksText.split(/[\n,;]+/).map(l => l.trim()).filter(l => l.length > 0);
    if (links.length === 0) { addLog('⚠ Nenhum link inserido.'); return; }

    stopStream();
    setResults([]);
    setLogs([]);
    setCurrentIdx(null);
    setStatus('running');
    addLog(`▶ Iniciando: ${links.length} links — ${activeSessions.length} sessão(ões)`);

    try {
      const res = await fetch(`${SIDECAR}/groups/join/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          links,
          sessionIds: activeSessions,
          options: {
            maxJoinsPerHour: maxPerHour,
            delayMinMs: delayMin * 1000,
            delayMaxMs: delayMax * 1000,
            minMembers: filterMembers ? minMembers : null,
            maxMembers: filterMembers ? maxMembers : null,
            groupType: groupType === 'any' ? null : groupType,
          },
        }),
      });
      const { ok, jobId, error } = await res.json();
      if (!ok) throw new Error(error || 'Falha ao iniciar');

      jobIdRef.current = jobId;
      const es = new EventSource(`${SIDECAR}/groups/join/stream/${jobId}`);
      esRef.current = es;

      es.addEventListener('progress', (e) => {
        const upd = JSON.parse(e.data);
        setCurrentIdx(upd.index);
        addLog(`[${upd.index + 1}] ${upd.status.toUpperCase()}: ${upd.message || upd.link}`);
      });

      es.addEventListener('done', (e) => {
        const { results: finalResults } = JSON.parse(e.data);
        setResults(finalResults || []);
        setStatus('done');
        setCurrentIdx(null);
        es.close();
        esRef.current = null;
        jobIdRef.current = null;
        const joined = (finalResults || []).filter((r: JoinResult) => r.status === 'joined').length;
        addLog(`✓ Concluído: ${joined}/${(finalResults || []).length} grupos entrou`);
        if (notifyOnDone) sendFinishNotification(joined, (finalResults || []).length);
      });

      es.addEventListener('error', (e) => {
        const msg = (e as any).data ? JSON.parse((e as any).data).message : 'Erro no stream';
        addLog(`✗ ${msg}`);
        setStatus('done');
        es.close();
      });

      es.onerror = () => {
        if (es.readyState === EventSource.CLOSED) setStatus(p => p === 'running' || p === 'paused' ? 'done' : p);
      };
    } catch (err) {
      addLog(`✗ ${err instanceof Error ? err.message : String(err)}`);
      setStatus('idle');
    }
  }, [connectedSession, selectedSessions, linksText, maxPerHour, delayMin, delayMax, filterMembers, minMembers, maxMembers, groupType, notifyOnDone, stopStream]);

  useEffect(() => () => stopStream(), [stopStream]);

  const total   = results.length;
  const joined  = results.filter(r => r.status === 'joined').length;
  const already = results.filter(r => r.status === 'already_member').length;
  const invalid = results.filter(r => ['invalid', 'error', 'rate_limit', 'full'].includes(r.status)).length;

  const exportCSV = () => {
    const header = 'Nome,Link,Status,Membros,Erro\n';
    const rows = results.map(r =>
      [r.groupName || r.code || r.link, r.link, r.status, r.memberCount ?? '', r.errorMessage || '']
        .map(v => `"${String(v).replace(/"/g, '""')}"`)
        .join(',')
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'join-results.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const isRunning = status === 'running' || status === 'paused';

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3 h-full min-h-0 overflow-hidden">

      {/* ── Painel esquerdo: config ── */}
      <div className="w-[280px] flex-shrink-0 flex flex-col gap-3 overflow-y-auto min-h-0 pr-0.5">

        {/* Sessões */}
        <div className="rounded-xl border border-wa-border bg-wa-card p-3 flex flex-col gap-2">
          <p className="text-[11px] font-semibold text-wa-muted/80 uppercase tracking-wider">Sessões</p>
          {connectedSessions.length === 0 ? (
            <p className="text-xs text-red-400">Nenhuma sessão conectada</p>
          ) : (
            connectedSessions.map(s => (
              <label key={s.id} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox"
                  checked={selectedSessions.includes(s.id)}
                  onChange={e => setSelectedSessions(prev =>
                    e.target.checked ? [...prev, s.id] : prev.filter(id => id !== s.id)
                  )}
                  disabled={isRunning}
                  className="accent-[var(--color-accentSuccess)]" />
                <span className="text-xs text-wa-text">{s.user?.name || s.id}</span>
                <span className="text-[10px] text-wa-green">● conectado</span>
              </label>
            ))
          )}
          {connectedSessions.length > 1 && (
            <p className="text-[10px] text-wa-text/60">Links distribuídos entre {selectedSessions.length} sessão(ões)</p>
          )}
        </div>

        {/* Links */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-semibold text-wa-muted/80 uppercase tracking-wider flex items-center gap-1.5">
            <Link2 className="w-3 h-3" /> Links / Códigos
          </label>
          <textarea
            value={linksText}
            onChange={e => setLinksText(e.target.value)}
            disabled={isRunning}
            placeholder={'https://chat.whatsapp.com/ABC123\nhttps://chat.whatsapp.com/XYZ789\n...'}
            className="w-full h-36 bg-wa-card border border-wa-border rounded-lg px-3 py-2 text-xs text-wa-text placeholder:text-wa-muted focus:outline-none focus:border-wa-green/40 resize-none font-mono disabled:opacity-50"
          />
          <p className="text-[10px] text-wa-text/60">
            {linksText.split(/[\n,;]+/).filter(l => l.trim()).length} links detectados
          </p>
        </div>

        {/* Anti-ban */}
        <div className="rounded-xl border border-wa-border bg-wa-card p-3 flex flex-col gap-3">
          <p className="text-[11px] font-semibold text-wa-muted/80 uppercase tracking-wider">Anti-Ban</p>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] text-wa-text/60">Máx. joins/hora</label>
            <input type="number" min={1} max={30} value={maxPerHour}
              onChange={e => setMaxPerHour(Number(e.target.value))} disabled={isRunning}
              className="bg-wa-bg/80 border border-wa-border rounded-lg px-2 py-1.5 text-xs text-wa-text focus:outline-none focus:border-wa-green/40 disabled:opacity-50" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[['Delay mín (s)', delayMin, setDelayMin, 3, 60], ['Delay máx (s)', delayMax, setDelayMax, 5, 120]].map(([label, val, setter, min, max]) => (
              <div key={label as string} className="flex flex-col gap-1">
                <label className="text-[10px] text-wa-text/60">{label as string}</label>
                <input type="number" min={min as number} max={max as number} value={val as number}
                  onChange={e => (setter as (v: number) => void)(Number(e.target.value))} disabled={isRunning}
                  className="bg-wa-bg/80 border border-wa-border rounded-lg px-2 py-1.5 text-xs text-wa-text focus:outline-none focus:border-wa-green/40 disabled:opacity-50" />
              </div>
            ))}
          </div>
        </div>

        {/* Filtro de membros */}
        <div className="rounded-xl border border-wa-border bg-wa-card p-3 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold text-wa-muted/80 uppercase tracking-wider">Filtro de Membros</p>
            <button onClick={() => setFilterMembers(v => !v)} disabled={isRunning}
              className={`relative w-8 h-4 rounded-full transition-colors ${filterMembers ? 'bg-wa-green' : 'bg-wa-border'} disabled:opacity-50`}>
              <span className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-transform ${filterMembers ? 'translate-x-4' : 'translate-x-0'}`} />
            </button>
          </div>
          {filterMembers && (
            <div className="grid grid-cols-2 gap-2">
              {[['Mín.', minMembers, setMinMembers], ['Máx.', maxMembers, setMaxMembers]].map(([label, val, setter]) => (
                <div key={label as string} className="flex flex-col gap-1">
                  <label className="text-[10px] text-wa-text/60">{label as string} membros</label>
                  <input type="number" min={1} value={val as number}
                    onChange={e => (setter as (v: number) => void)(Number(e.target.value))} disabled={isRunning}
                    className="bg-wa-bg/80 border border-wa-border rounded-lg px-2 py-1.5 text-xs text-wa-text focus:outline-none focus:border-wa-green/40 disabled:opacity-50" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tipo de grupo */}
        <div className="rounded-xl border border-wa-border bg-wa-card p-3 flex flex-col gap-2">
          <p className="text-[11px] font-semibold text-wa-muted/80 uppercase tracking-wider">Tipo de Grupo</p>
          <div className="grid grid-cols-3 gap-1.5">
            {(['any', 'open', 'closed'] as const).map(t => (
              <button key={t} onClick={() => setGroupType(t)} disabled={isRunning}
                className={`py-1.5 rounded-lg text-[10px] font-semibold border transition-colors disabled:opacity-50 ${
                  groupType === t ? 'bg-wa-green/10 border-wa-green/40 text-wa-green' : 'bg-wa-bg/80 border-wa-border text-wa-muted hover:text-wa-text'
                }`}>
                {t === 'any' ? 'Qualquer' : t === 'open' ? 'Aberto' : 'Fechado'}
              </button>
            ))}
          </div>
        </div>

        {/* Notificação */}
        <label className="flex items-center gap-2 px-1 cursor-pointer">
          <input type="checkbox" checked={notifyOnDone} onChange={e => setNotifyOnDone(e.target.checked)}
            className="accent-[var(--color-accentSuccess)]" />
          <Bell className="w-3 h-3 text-wa-muted" />
          <span className="text-[10px] text-wa-muted/80">Notificar ao terminar</span>
        </label>

        {/* Botões de ação */}
        <div className="flex gap-2">
          {isRunning ? (
            <>
              <button onClick={handlePauseResume}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border text-sm font-semibold transition-colors ${
                  status === 'paused'
                    ? 'bg-wa-green/10 border-wa-green/30 text-wa-green hover:bg-wa-green/20'
                    : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/20'
                }`}>
                <Pause className="w-4 h-4" />{status === 'paused' ? 'Retomar' : 'Pausar'}
              </button>
              <button onClick={handleStop}
                className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-semibold hover:bg-red-500/20 transition-colors">
                <Square className="w-4 h-4" />
              </button>
            </>
          ) : (
            <button onClick={handleStart} disabled={selectedSessions.length === 0 || linksText.trim().length === 0}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-wa-green/10 border border-wa-green/30 text-wa-green text-sm font-semibold hover:bg-wa-green/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
              <Play className="w-4 h-4" /> Iniciar
            </button>
          )}
        </div>

        {results.length > 0 && (
          <div className="flex gap-2">
            <button onClick={() => navigator.clipboard.writeText(results.filter(r => r.status === 'joined').map(r => r.link).join('\n'))}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border border-wa-border bg-wa-card text-xs text-wa-muted/80 hover:text-wa-text transition-colors">
              <Copy className="w-3.5 h-3.5" /> Copiar válidos
            </button>
            <button onClick={exportCSV}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border border-wa-border bg-wa-card text-xs text-wa-muted/80 hover:text-wa-green transition-colors">
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
          </div>
        )}

        {/* Histórico */}
        <div className="rounded-xl border border-wa-border bg-wa-card overflow-hidden">
          <button onClick={() => setShowHistory(v => !v)}
            className="w-full flex items-center justify-between px-3 py-2 hover:bg-wa-card/80 transition-colors">
            <div className="flex items-center gap-2 text-[11px] font-semibold text-wa-muted/80 uppercase tracking-wider">
              <History className="w-3.5 h-3.5" />Histórico
            </div>
            {showHistory ? <ChevronUp className="w-3.5 h-3.5 text-wa-muted" /> : <ChevronDown className="w-3.5 h-3.5 text-wa-muted" />}
          </button>
          {showHistory && (
            <div className="border-t border-wa-border p-2 max-h-64 overflow-y-auto">
              <HistoryPanel onRestore={(r) => { setResults(r); setStatus('done'); }} />
            </div>
          )}
        </div>
      </div>

      {/* ── Painel direito: resultados + log ── */}
      <div className="flex-1 flex flex-col gap-3 min-h-0 min-w-0">

        {/* Stats */}
        {(isRunning || results.length > 0) && (
          <div className="grid grid-cols-4 gap-2 flex-shrink-0">
            {[
              { label: 'Total',  value: total,   color: 'text-wa-text' },
              { label: 'Entrou', value: joined,  color: 'text-wa-green' },
              { label: 'Já era', value: already, color: 'text-sky-400' },
              { label: 'Falhou', value: invalid, color: 'text-red-400' },
            ].map(s => (
              <div key={s.label} className="rounded-xl border border-wa-border bg-wa-card px-3 py-2 text-center">
                <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                <p className="text-[10px] text-wa-text/60">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Status badge */}
        {status === 'paused' && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-yellow-500/30 bg-yellow-500/5 text-yellow-400 text-xs">
            <Pause className="w-3.5 h-3.5" />Job pausado — clique em Retomar para continuar
          </div>
        )}

        {/* Tabela de resultados */}
        <div className="flex-1 rounded-xl border border-wa-border bg-wa-card overflow-hidden flex flex-col min-h-0">
          <div className="grid grid-cols-[1fr_80px_70px] gap-2 px-3 py-2 border-b border-wa-border bg-wa-bg/80 flex-shrink-0">
            <span className="text-[10px] font-semibold text-wa-muted uppercase tracking-wider">Grupo / Link</span>
            <span className="text-[10px] font-semibold text-wa-muted uppercase tracking-wider">Membros</span>
            <span className="text-[10px] font-semibold text-wa-muted uppercase tracking-wider">Status</span>
          </div>
          <ScrollArea className="flex-1">
            {results.length === 0 && !isRunning ? (
              <div className="flex flex-col items-center justify-center py-16 gap-2">
                <LogIn className="w-8 h-8 text-slate-700" />
                <p className="text-xs text-wa-text/70">Insira os links e clique em Iniciar</p>
              </div>
            ) : (
              <div className="divide-y divide-[var(--color-borderColor)]/50">
                <AnimatePresence initial={false}>
                  {results.map((r, i) => {
                    const sc = STATUS_CONFIG[r.status];
                    const Icon = sc.icon;
                    return (
                      <motion.div key={r.link + i}
                        initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }}
                        className="grid grid-cols-[1fr_80px_70px] gap-2 px-3 py-2.5 items-center hover:bg-wa-card/80 transition-colors">
                        <div className="min-w-0">
                          <p className="text-xs text-wa-text font-medium truncate">{r.groupName || r.code || '—'}</p>
                          <p className="text-[10px] text-violet-400/70 truncate font-mono">
                            {r.link.replace('https://chat.whatsapp.com/', '')}
                          </p>
                          {r.errorMessage && <p className="text-[10px] text-red-400/70 truncate">{r.errorMessage}</p>}
                        </div>
                        <div className="flex items-center gap-1">
                          {r.memberCount != null
                            ? <><Users className="w-2.5 h-2.5 text-wa-muted" /><span className="text-[10px] text-wa-muted/80">{r.memberCount}</span></>
                            : <span className="text-[10px] text-slate-700">—</span>}
                        </div>
                        <div className="flex items-center gap-1">
                          <Icon className={`w-3 h-3 ${sc.color}`} />
                          <span className={`text-[10px] ${sc.color}`}>{sc.label}</span>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
                {isRunning && currentIdx !== null && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="grid grid-cols-[1fr_80px_70px] gap-2 px-3 py-2.5 items-center bg-wa-card">
                    <div className="flex items-center gap-2 min-w-0">
                      <Loader2 className="w-3 h-3 text-wa-green animate-spin flex-shrink-0" />
                      <p className="text-xs text-wa-muted/80 truncate">
                        {status === 'paused' ? 'Pausado...' : `Processando #${currentIdx + 1}...`}
                      </p>
                    </div>
                    <span /><span className="text-[10px] text-wa-text/60">...</span>
                  </motion.div>
                )}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Log terminal */}
        <div className="flex-shrink-0 rounded-xl border border-wa-border bg-wa-bg/80 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-wa-border">
            <span className="text-[10px] font-semibold text-wa-muted uppercase tracking-wider">Log</span>
            <button onClick={() => setLogs([])} className="text-[10px] text-wa-muted hover:text-wa-muted/80 transition-colors flex items-center gap-1">
              <Trash2 className="w-3 h-3" /> Limpar
            </button>
          </div>
          <ScrollArea className="h-28">
            <div className="px-3 py-2 space-y-0.5 font-mono">
              {logs.length === 0
                ? <p className="text-[10px] text-slate-700">aguardando...</p>
                : logs.map((l, i) => (
                  <p key={i} className={`text-[10px] leading-5 ${
                    l.startsWith('✓') ? 'text-wa-green' :
                    l.startsWith('✗') ? 'text-red-400' :
                    l.startsWith('⚠') || l.startsWith('⏸') ? 'text-yellow-400' :
                    'text-wa-muted/80'
                  }`}>{l}</p>
                ))
              }
            </div>
          </ScrollArea>
        </div>
      </div>
    </motion.div>
  );
}
