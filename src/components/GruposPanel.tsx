import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Users, Download, ChevronRight, Loader2, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';
import { useApp } from '@/context/AppContext';
import { api } from '@/lib/api';
import { Group, Participant } from '@/types';
import { exportCSV } from '@/lib/utils';

export function GruposPanel() {
  const { activeSessionId, sessions, addLog, groupsUpdatedAt } = useApp();
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [loadingParticipants, setLoadingParticipants] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  const isConnected = sessions.find((s) => s.id === activeSessionId)?.status === 'connected';

  // Quando o backend termina de atualizar o cache, busca a lista nova
  useEffect(() => {
    if (!activeSessionId || !groupsUpdatedAt[activeSessionId]) return;
    api.groups.list(activeSessionId).then((res) => {
      setGroups(res.groups as Group[]);
      setRefreshing(false);
    }).catch(() => setRefreshing(false));
  }, [groupsUpdatedAt[activeSessionId ?? '']]);

  const loadGroups = async (forceRefresh = false) => {
    if (!activeSessionId || !isConnected) return;
    if (forceRefresh) setRefreshing(true);
    else setLoadingGroups(true);
    try {
      const res = await api.groups.list(activeSessionId, forceRefresh);
      setGroups(res.groups as Group[]);
      if (res.loading) {
        // Backend está buscando em background — aguarda groups_updated
        addLog('info', 'Carregando grupos em background...');
        setRefreshing(true);
      } else if (res.refreshing) {
        addLog('info', `${res.groups.length} grupos (atualizando em background...)`);
        setRefreshing(true);
      } else {
        addLog('success', `${res.groups.length} grupos carregados`);
        setRefreshing(false);
      }
    } catch (e) {
      addLog('error', `Erro ao carregar grupos: ${(e as Error).message}`);
      setRefreshing(false);
    } finally {
      setLoadingGroups(false);
    }
  };

  const loadParticipants = async (group: Group) => {
    if (!activeSessionId) return;
    setSelectedGroup(group);
    setLoadingParticipants(true);
    try {
      const res = await api.groups.participants(activeSessionId, group.id);
      setParticipants(res.participants);
      addLog('success', `${res.participants.length} participantes extraídos de "${group.subject}"`);
    } catch (e) {
      addLog('error', `Erro ao extrair participantes: ${(e as Error).message}`);
    } finally {
      setLoadingParticipants(false);
    }
  };

  const handleExportParticipants = async () => {
    if (!participants.length) return;
    await exportCSV(
      participants.map((p) => ({ numero: p.phone, jid: p.id, admin: p.admin || 'não' })),
      `participantes-${selectedGroup?.subject}-${Date.now()}.csv`
    );
  };

  const handleCopyNumbers = () => {
    const nums = participants.map((p) => p.phone).join('\n');
    navigator.clipboard.writeText(nums);
    addLog('success', `${participants.length} números copiados`);
  };

  const filteredGroups = groups.filter((g) =>
    (g.subject || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button onClick={() => loadGroups(false)} disabled={!isConnected || loadingGroups}>
          {loadingGroups ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
          Carregar Grupos
        </Button>
        {groups.length > 0 && (
          <>
            <span className="text-sm text-wa-muted">{groups.length} grupos</span>
            <Button size="sm" variant="outline" onClick={() => loadGroups(true)} disabled={refreshing} title="Forçar atualização">
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
            {refreshing && <span className="text-xs text-wa-muted animate-pulse">atualizando...</span>}
          </>
        )}
      </div>

      {groups.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Input
              placeholder="Buscar grupo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="mb-2"
            />
            <ScrollArea className="h-72">
              <div className="space-y-1 pr-2">
                {filteredGroups.map((group) => (
                  <motion.button
                    key={group.id}
                    whileHover={{ x: 4 }}
                    onClick={() => loadParticipants(group)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-colors ${
                      selectedGroup?.id === group.id
                        ? 'bg-wa-medium/30 border border-wa-medium/50'
                        : 'hover:bg-wa-border/30 border border-transparent'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full bg-wa-medium/20 flex items-center justify-center flex-shrink-0">
                      <Users className="w-4 h-4 text-wa-medium" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-wa-text truncate">{group.subject}</p>
                      <p className="text-xs text-wa-text/70">{group.participantCount} participantes</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-wa-muted flex-shrink-0" />
                  </motion.button>
                ))}
              </div>
            </ScrollArea>
          </div>

          <div className="space-y-2">
            {selectedGroup && (
              <>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-wa-text truncate">{selectedGroup.subject}</h3>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={handleCopyNumbers} disabled={!participants.length}>
                      Copiar Números
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleExportParticipants} disabled={!participants.length}>
                      <Download className="w-3.5 h-3.5" />CSV
                    </Button>
                  </div>
                </div>
                <ScrollArea className="h-64">
                  <div className="space-y-1 pr-2">
                    {loadingParticipants ? (
                      <div className="flex items-center justify-center h-32">
                        <Loader2 className="w-6 h-6 text-wa-green animate-spin" />
                      </div>
                    ) : (
                      participants.map((p) => (
                        <div key={p.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-wa-border/20">
                          <span className="font-mono text-sm text-wa-text">{p.phone}</span>
                          {p.admin && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-wa-green/20 text-wa-green">
                              {p.admin}
                            </span>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
