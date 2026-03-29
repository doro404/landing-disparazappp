import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Users, Search, RefreshCw, Play, Pause, StopCircle, CheckSquare, Square, Link2, Plus, Loader2 } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { api } from '@/lib/api';
import { Group } from '@/types';
import { ScrollArea } from '@/components/ui/scroll-area';

export interface ExtractConfig {
  extractPhone: boolean;
  extractName: boolean;
  removeDuplicates: boolean;
  ignoreAdmins: boolean;
  participantFilter: 'all' | 'admins' | 'members';
}

interface Props {
  selectedGroups: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  config: ExtractConfig;
  onConfigChange: (c: ExtractConfig) => void;
  status: 'idle' | 'running' | 'paused' | 'done';
  onStart: () => void;
  onPause: () => void;
  onStop: () => void;
  onGroupsLoaded?: (groups: { id: string; subject: string }[]) => void;
  onLinkGroupAdded?: (group: { id: string; subject: string; participantCount: number }) => void;
  onLinkParticipants?: (groupId: string, participants: { id: string; phone: string; admin: string | null }[]) => void;
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

export function GroupListPanel({ selectedGroups, onSelectionChange, config, onConfigChange, status, onStart, onPause, onStop, onGroupsLoaded, onLinkGroupAdded, onLinkParticipants }: Props) {
  const { activeSessionId, sessions, groupsUpdatedAt } = useApp();
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [linkInput, setLinkInput] = useState('');
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkError, setLinkError] = useState('');

  const isConnected = sessions.find(s => s.id === activeSessionId)?.status === 'connected';
  const isActive = status === 'running' || status === 'paused';

  const loadGroups = async (force = false) => {
    if (!activeSessionId || !isConnected) return;
    setLoading(true);
    try {
      const res = await api.groups.list(activeSessionId, force);
      setGroups(res.groups as Group[]);
      onGroupsLoaded?.(res.groups as Group[]);
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadGroups(); }, [activeSessionId, isConnected]);

  // Re-fetch when backend signals groups_updated
  useEffect(() => {
    if (!activeSessionId || !groupsUpdatedAt[activeSessionId]) return;
    api.groups.list(activeSessionId).then(res => {
      setGroups(res.groups as Group[]);
      onGroupsLoaded?.(res.groups as Group[]);
    }).catch(() => {});
  }, [groupsUpdatedAt[activeSessionId ?? '']]);

  const filtered = groups.filter(g => (g.subject ?? '').toLowerCase().includes(search.toLowerCase()));

  const toggleGroup = (id: string) => {
    const next = new Set(selectedGroups);
    next.has(id) ? next.delete(id) : next.add(id);
    onSelectionChange(next);
  };

  const toggleAll = () => {
    if (selectedGroups.size === filtered.length) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(filtered.map(g => g.id)));
    }
  };

  const set = <K extends keyof ExtractConfig>(k: K, v: ExtractConfig[K]) =>
    onConfigChange({ ...config, [k]: v });

  const handleAddFromLink = async () => {
    if (!activeSessionId || !linkInput.trim()) return;
    setLinkLoading(true);
    setLinkError('');
    try {
      const res = await api.groups.fromLink(activeSessionId, linkInput.trim());
      const g: Group = { id: res.groupId, subject: res.subject, participantCount: res.participantCount };
      setGroups(prev => prev.some(x => x.id === g.id) ? prev : [...prev, g]);
      onGroupsLoaded?.([g]);
      onLinkGroupAdded?.(g);
      onLinkParticipants?.(res.groupId, res.participants);
      // Auto-select
      const next = new Set(selectedGroups);
      next.add(g.id);
      onSelectionChange(next);
      setLinkInput('');
    } catch (e) {
      setLinkError((e as Error).message);
    } finally {
      setLinkLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex flex-col h-full gap-3 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-wa-green/15">
            <Users className="w-4 h-4 text-wa-green" />
          </div>
          <div>
            <p className="text-sm font-semibold text-wa-text">Grupos WhatsApp</p>
            <p className="text-[11px] text-wa-muted">{groups.length} grupos disponíveis</p>
          </div>
        </div>
        <button
          onClick={() => loadGroups(true)}
          disabled={loading || !isConnected}
          className="p-1.5 rounded-lg border border-wa-border bg-wa-card text-wa-muted/80 hover:text-wa-text transition-colors disabled:opacity-30"
          title="Atualizar grupos"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Search */}
      <div className="relative flex-shrink-0">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-wa-muted" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar grupo..."
          className="w-full bg-wa-card border border-wa-border rounded-lg pl-8 pr-3 py-2 text-xs text-wa-text placeholder:text-wa-muted focus:outline-none focus:border-wa-green/40"
        />
      </div>

      {/* Group list */}
      <div className="flex-1 rounded-xl border border-wa-border bg-wa-card overflow-hidden flex flex-col min-h-0">
        {/* Select all */}
        {filtered.length > 0 && (
          <button
            onClick={toggleAll}
            className="flex items-center gap-2 px-3 py-2 border-b border-wa-border bg-wa-bg/80 hover:bg-wa-bg/60 transition-colors text-left"
          >
            {selectedGroups.size === filtered.length
              ? <CheckSquare className="w-3.5 h-3.5 text-wa-green" />
              : <Square className="w-3.5 h-3.5 text-wa-muted" />
            }
            <span className="text-[11px] text-wa-muted/80">
              {selectedGroups.size === filtered.length ? 'Desmarcar todos' : 'Selecionar todos'}
            </span>
            {selectedGroups.size > 0 && (
              <span className="ml-auto text-[10px] text-wa-green">{selectedGroups.size} selecionado{selectedGroups.size !== 1 ? 's' : ''}</span>
            )}
          </button>
        )}

        <ScrollArea className="flex-1">
          {!isConnected ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <Users className="w-7 h-7 text-slate-700" />
              <p className="text-xs text-wa-text/70">Sessão não conectada</p>
            </div>
          ) : loading && groups.length === 0 ? (
            <div className="flex items-center justify-center py-10">
              <RefreshCw className="w-4 h-4 text-wa-muted animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <Users className="w-7 h-7 text-slate-700" />
              <p className="text-xs text-wa-text/70">Nenhum grupo encontrado</p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--color-borderColor)]/50">
              {filtered.map(group => {
                const selected = selectedGroups.has(group.id);
                return (
                  <button
                    key={group.id}
                    onClick={() => toggleGroup(group.id)}
                    disabled={isActive}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors disabled:cursor-not-allowed ${selected ? 'bg-wa-green/8' : 'hover:bg-wa-bg/60'}`}
                  >
                    {/* Avatar */}
                    <div className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-[11px] font-bold ${selected ? 'bg-wa-green/20 text-wa-green' : 'bg-wa-border text-wa-muted/80'}`}>
                      {(group.subject ?? 'G')[0]?.toUpperCase() ?? 'G'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-medium truncate ${selected ? 'text-wa-green' : 'text-wa-text'}`}>{group.subject || '(sem nome)'}</p>
                      <p className="text-[10px] text-wa-text/60">{group.participantCount} participantes</p>
                    </div>
                    {selected
                      ? <CheckSquare className="w-3.5 h-3.5 text-wa-green flex-shrink-0" />
                      : <Square className="w-3.5 h-3.5 text-slate-700 flex-shrink-0" />
                    }
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Link extractor */}
      <div className="rounded-xl border border-wa-border bg-wa-card p-3 flex flex-col gap-2 flex-shrink-0">
        <p className="text-[10px] font-semibold text-wa-muted uppercase tracking-wider flex items-center gap-1.5">
          <Link2 className="w-3 h-3" />Adicionar por link
        </p>
        <div className="flex gap-1.5">
          <input
            type="text"
            value={linkInput}
            onChange={e => { setLinkInput(e.target.value); setLinkError(''); }}
            placeholder="https://chat.whatsapp.com/..."
            disabled={isActive || linkLoading}
            className="flex-1 bg-wa-bg/80 border border-wa-border rounded-lg px-2 py-1.5 text-xs text-wa-text placeholder:text-wa-muted focus:outline-none focus:border-wa-green/40 disabled:opacity-50 min-w-0"
          />
          <button
            onClick={handleAddFromLink}
            disabled={!linkInput.trim() || linkLoading || isActive}
            className="flex-shrink-0 p-1.5 rounded-lg bg-wa-green/10 border border-wa-green/30 text-wa-green hover:bg-wa-green/20 transition-colors disabled:opacity-30"
          >
            {linkLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
          </button>
        </div>
        {linkError && <p className="text-[10px] text-red-400">{linkError}</p>}
        <p className="text-[10px] text-wa-text/60">Extrai membros sem precisar ser membro do grupo</p>
      </div>

      {/* Options */}
      <div className="rounded-xl border border-wa-border bg-wa-card p-3 flex flex-col gap-2.5 flex-shrink-0">
        <p className="text-[10px] font-semibold text-wa-muted uppercase tracking-wider">Opções de extração</p>
        <Toggle label="Extrair telefones" checked={config.extractPhone} onChange={v => set('extractPhone', v)} />
        <Toggle label="Extrair nomes" checked={config.extractName} onChange={v => set('extractName', v)} />
        <Toggle label="Remover duplicatas" checked={config.removeDuplicates} onChange={v => set('removeDuplicates', v)} />

        {/* Participant filter */}
        <div className="space-y-1.5">
          <p className="text-[10px] text-wa-text/60">Filtrar participantes</p>
          <div className="grid grid-cols-3 gap-1">
            {(['all', 'admins', 'members'] as const).map(f => (
              <button key={f}
                onClick={() => set('participantFilter', f)}
                className={`py-1 rounded-lg text-[10px] font-semibold border transition-colors ${
                  config.participantFilter === f
                    ? 'bg-wa-green/10 border-wa-green/40 text-wa-green'
                    : 'bg-wa-bg/80 border-wa-border text-wa-muted hover:text-wa-text'
                }`}>
                {f === 'all' ? 'Todos' : f === 'admins' ? 'Admins' : 'Membros'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex flex-col gap-2 flex-shrink-0">
        {!isActive ? (
          <motion.button
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            onClick={onStart}
            disabled={selectedGroups.size === 0}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-wa-green hover:bg-wa-green text-black font-semibold text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Play className="w-4 h-4" />
            Iniciar Extração
          </motion.button>
        ) : (
          <div className="flex gap-2">
            <motion.button
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={onPause}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm transition-colors ${status === 'paused' ? 'bg-wa-green text-black hover:bg-wa-green' : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 hover:bg-yellow-500/30'}`}
            >
              <Pause className="w-4 h-4" />
              {status === 'paused' ? 'Retomar' : 'Pausar'}
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

