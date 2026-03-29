import { useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { GroupListPanel, ExtractConfig } from './GroupListPanel';
import { ExtractionViewer, ActivityItem } from './ExtractionViewer';
import { ExtractedContactsTable, ExtractedContact } from './ExtractedContactsTable';
import { ExtractionLogs, GroupLogLine } from './ExtractionLogs';
import { useApp } from '@/context/AppContext';
import { api } from '@/lib/api';

interface Props {
  onSendToBulk: (numbers: string) => void;
}

function makeLog(level: GroupLogLine['level'], message: string): GroupLogLine {
  return { id: crypto.randomUUID(), level, message, ts: Date.now() };
}

function makeActivity(text: string, type: ActivityItem['type'] = 'info'): ActivityItem {
  return { id: crypto.randomUUID(), text, type, ts: Date.now() };
}

export function WhatsAppGroupExtractor({ onSendToBulk }: Props) {
  const { activeSessionId } = useApp();

  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [config, setConfig] = useState<ExtractConfig>({
    extractPhone: true,
    extractName: true,
    removeDuplicates: true,
    ignoreAdmins: false,
    participantFilter: 'all',
  });

  const [status, setStatus] = useState<'idle' | 'running' | 'paused' | 'done'>('idle');
  const [contacts, setContacts] = useState<ExtractedContact[]>([]);
  const [logs, setLogs] = useState<GroupLogLine[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);

  // Live state
  const [currentGroup, setCurrentGroup] = useState('');
  const [currentMember, setCurrentMember] = useState('');
  const [totalMembers, setTotalMembers] = useState(0);
  const [groupsDone, setGroupsDone] = useState(0);

  const pausedRef = useRef(false);
  const stoppedRef = useRef(false);
  // Store group subjects for display
  const groupSubjectsRef = useRef<Map<string, string>>(new Map());
  // Groups added via invite link (need fromLink extraction, not groupMetadata)
  const linkGroupsRef = useRef<Map<string, { participants: { id: string; phone: string; admin: string | null }[] }>>(new Map());

  const addLog = useCallback((level: GroupLogLine['level'], msg: string) => {
    setLogs(prev => [...prev.slice(-299), makeLog(level, msg)]);
  }, []);

  const addActivity = useCallback((text: string, type: ActivityItem['type'] = 'info') => {
    setActivity(prev => [...prev.slice(-99), makeActivity(text, type)]);
  }, []);

  // Wait helper that respects pause/stop
  const waitOrPause = useCallback(async (ms: number) => {
    const step = 100;
    let elapsed = 0;
    while (elapsed < ms) {
      if (stoppedRef.current) return;
      while (pausedRef.current && !stoppedRef.current) {
        await new Promise(r => setTimeout(r, 200));
      }
      await new Promise(r => setTimeout(r, Math.min(step, ms - elapsed)));
      elapsed += step;
    }
  }, []);

  const handleStart = useCallback(async () => {
    if (!activeSessionId) return;

    stoppedRef.current = false;
    pausedRef.current = false;

    setContacts([]);
    setLogs([]);
    setActivity([]);
    setGroupsDone(0);
    setTotalMembers(0);
    setCurrentGroup('');
    setCurrentMember('');
    setStatus('running');

    const groupIds = [...selectedGroups];
    addLog('info', `Iniciando extração de ${groupIds.length} grupo(s)...`);
    addActivity(`Iniciando extração de ${groupIds.length} grupo(s)`);

    const seen = new Set<string>();
    let totalCollected = 0;
    let allTotal = 0;

    for (let gi = 0; gi < groupIds.length; gi++) {
      if (stoppedRef.current) break;

      const groupId = groupIds[gi];
      const groupName = groupSubjectsRef.current.get(groupId) ?? groupId;

      setCurrentGroup(groupName);
      setGroupsDone(gi);
      addLog('info', `Extraindo membros de "${groupName}"`);
      addActivity(`Entrando no grupo: ${groupName}`);

      let participants: { id: string; phone: string; admin: string | null }[] = [];

      try {
        // If this group was added via invite link, use cached participants
        const cached = linkGroupsRef.current.get(groupId);
        if (cached) {
          participants = cached.participants;
        } else {
          const res = await api.groups.participants(activeSessionId, groupId);
          participants = res.participants;
        }
        allTotal += participants.length;
        setTotalMembers(t => t + participants.length);
        addLog('info', `${participants.length} participantes encontrados em "${groupName}"`);
        addActivity(`Lendo ${participants.length} membros`, 'info');
      } catch (e) {
        addLog('error', `Erro ao buscar participantes de "${groupName}": ${(e as Error).message}`);
        continue;
      }

      for (const p of participants) {
        if (stoppedRef.current) break;

        // Respect pause
        while (pausedRef.current && !stoppedRef.current) {
          await new Promise(r => setTimeout(r, 200));
        }
        if (stoppedRef.current) break;

        const isAdmin = !!p.admin;

        if (config.participantFilter === 'admins' && !isAdmin) continue;
        if (config.participantFilter === 'members' && isAdmin) continue;

        const key = config.removeDuplicates ? p.phone : p.id;
        if (config.removeDuplicates && seen.has(key)) {
          addLog('warn', `Duplicata ignorada: ${p.phone}`);
          addActivity(`Duplicata ignorada: ${p.phone}`, 'warn');
          continue;
        }
        seen.add(key);

        const name = p.id.split('@')[0] ?? '';
        setCurrentMember(p.phone || name);
        addActivity(`Extraindo: ${p.phone || name}`, 'success');

        const contact: ExtractedContact = {
          id: crypto.randomUUID(),
          name: config.extractName ? name : '',
          phone: config.extractPhone ? p.phone : '',
          groupName,
          isAdmin,
        };

        setContacts(prev => [...prev, contact]);
        totalCollected++;

        if (config.extractPhone && p.phone) {
          addLog('success', `Telefone coletado: ${p.phone}`);
        }

        await waitOrPause(80);
      }
    }

    if (!stoppedRef.current) {
      setStatus('done');
      setCurrentGroup('');
      setCurrentMember('');
      setGroupsDone(groupIds.length);
      addLog('success', `Extração concluída. ${totalCollected} contatos coletados.`);
      addActivity(`Extração concluída: ${totalCollected} contatos`, 'success');
    }
  }, [activeSessionId, selectedGroups, config, addLog, addActivity, waitOrPause]);

  const handlePause = useCallback(() => {
    if (status === 'running') {
      pausedRef.current = true;
      setStatus('paused');
      addLog('warn', 'Extração pausada pelo usuário.');
    } else if (status === 'paused') {
      pausedRef.current = false;
      setStatus('running');
      addLog('info', 'Extração retomada.');
    }
  }, [status, addLog]);

  const handleStop = useCallback(() => {
    stoppedRef.current = true;
    pausedRef.current = false;
    setStatus('idle');
    setCurrentGroup('');
    setCurrentMember('');
    addLog('warn', `Extração interrompida. ${contacts.length} contatos coletados.`);
  }, [contacts.length, addLog]);

  // Expose group subjects to the ref when selection changes
  const handleSelectionChange = useCallback((ids: Set<string>) => {
    setSelectedGroups(ids);
  }, []);

  // Capture group subjects from GroupListPanel via a wrapper
  const storeSubjects = useCallback((groups: { id: string; subject: string }[]) => {
    groups.forEach(g => groupSubjectsRef.current.set(g.id, g.subject));
  }, []);

  const storeLinkParticipants = useCallback((groupId: string, participants: { id: string; phone: string; admin: string | null }[]) => {
    linkGroupsRef.current.set(groupId, { participants });
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col h-full gap-3 min-h-0"
    >
      {/* 3-column layout */}
      <div className="grid grid-cols-[300px_1fr_380px] gap-3 flex-1 min-h-0 overflow-hidden">
        {/* Left */}
        <div className="overflow-hidden min-h-0 flex flex-col">
          <GroupListPanel
            selectedGroups={selectedGroups}
            onSelectionChange={handleSelectionChange}
            config={config}
            onConfigChange={setConfig}
            status={status}
            onStart={handleStart}
            onPause={handlePause}
            onStop={handleStop}
            onGroupsLoaded={storeSubjects}
            onLinkParticipants={storeLinkParticipants}
          />
        </div>

        {/* Center */}
        <ExtractionViewer
          status={status}
          currentGroup={currentGroup}
          currentMember={currentMember}
          collected={contacts.length}
          totalMembers={totalMembers}
          groupsDone={groupsDone}
          totalGroups={selectedGroups.size}
          activity={activity}
        />

        {/* Right */}
        <div className="overflow-hidden min-h-0 flex flex-col">
          <ExtractedContactsTable
            contacts={contacts}
            onSendToBulk={onSendToBulk}
          />
        </div>
      </div>

      {/* Logs */}
      <div className="flex-shrink-0">
        <ExtractionLogs logs={logs} onClear={() => setLogs([])} />
      </div>
    </motion.div>
  );
}

