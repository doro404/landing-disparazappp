import { useState, useRef, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Download, FileSpreadsheet, Copy, RotateCcw } from 'lucide-react';
import { FinderConfigPanel, FinderConfig, DEFAULT_FINDER_CONFIG } from './FinderConfigPanel';
import { SearchAutomationViewer } from './SearchAutomationViewer';
import { GroupsTable, FoundGroup } from './GroupsTable';
import { FinderLogs, FinderLogLine } from './FinderLogs';
import { ChromiumStatus } from '@/components/maps/ChromiumStatus';
import { CompletionDialog } from '@/components/shared/CompletionDialog';
import { useApp } from '@/context/AppContext';

const SIDECAR = 'http://127.0.0.1:3001';

function makeLog(level: FinderLogLine['level'], message: string): FinderLogLine {
  return { id: crypto.randomUUID(), level, message, ts: Date.now() };
}

function exportGroupsCSV(groups: FoundGroup[]) {
  const header = 'Nome,Link,Fonte,Status\n';
  const rows = groups.map(g =>
    [g.name, g.link, g.source, g.status]
      .map(v => `"${v.replace(/"/g, '""')}"`)
      .join(',')
  ).join('\n');
  const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'grupos-encontrados.csv'; a.click();
  URL.revokeObjectURL(url);
}

export function GroupFinder({ onJoinGroups }: { onJoinGroups?: (links: string[]) => void }) {
  const { sessions } = useApp();
  const connectedSession = sessions.find(s => s.status === 'connected');
  const connectedSessionRef = useRef(connectedSession);
  useEffect(() => { connectedSessionRef.current = connectedSession; }, [connectedSession]);
  const [config, setConfig] = useState<FinderConfig>(DEFAULT_FINDER_CONFIG);
  const [chromiumReady, setChromiumReady] = useState(false);
  const [status, setStatus] = useState<'idle' | 'running' | 'paused' | 'done'>('idle');
  const [groups, setGroups] = useState<FoundGroup[]>([]);
  const [logs, setLogs] = useState<FinderLogLine[]>([]);
  const [pagesScanned, setPagesScanned] = useState(0);
  const [currentUrl, setCurrentUrl] = useState('');
  const [showCompletion, setShowCompletion] = useState(false);
  const [validating, setValidating] = useState(false);

  const groupsRef = useRef<FoundGroup[]>([]);
  useEffect(() => { groupsRef.current = groups; }, [groups]);
  const jobIdRef = useRef<string | null>(null);
  const esRef = useRef<EventSource | null>(null);
  const configRef = useRef(config);
  const validatingLinksRef = useRef<Set<string>>(new Set());
  useEffect(() => { configRef.current = config; }, [config]);

  const addLog = useCallback((level: FinderLogLine['level'], msg: string) =>
    setLogs(prev => [...prev.slice(-299), makeLog(level, msg)]), []);

  const stopStream = useCallback(() => {
    if (esRef.current) { esRef.current.close(); esRef.current = null; }
    if (jobIdRef.current) {
      fetch(`${SIDECAR}/groups/stop/${jobIdRef.current}`, { method: 'DELETE' }).catch(() => {});
      jobIdRef.current = null;
    }
  }, []);

  const handleStart = useCallback(async () => {
    stopStream();
    setGroups([]);
    setLogs([]);
    setPagesScanned(0);
    setCurrentUrl('');
    setStatus('running');
    validatingLinksRef.current = new Set();

    const cfg = configRef.current;
    addLog('info', `Iniciando busca: "${cfg.keyword}"${cfg.location ? ` em "${cfg.location}"` : ''}`);
    addLog('info', 'Aguarde — abrindo navegador...');

    try {
      const res = await fetch(`${SIDECAR}/groups/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: cfg.keyword, location: cfg.location, maxResults: cfg.maxResults }),
      });
      const { ok, jobId, error } = await res.json();
      if (!ok) throw new Error(error || 'Falha ao iniciar job');

      jobIdRef.current = jobId;
      const es = new EventSource(`${SIDECAR}/groups/stream/${jobId}`);
      esRef.current = es;

      // Acumula grupos localmente para ter lista completa no evento done
      const collectedLinks = new Set<string>();

      es.addEventListener('group', (e) => {
        const raw = JSON.parse(e.data);
        const group: FoundGroup = {
          id: raw.id || crypto.randomUUID(),
          name: raw.name || raw.link,
          link: raw.link,
          source: raw.source || 'Google',
          category: raw.category,
          status: raw.status || 'unknown',
        };
        const isDup = configRef.current.removeDuplicates && collectedLinks.has(group.link);
        if (!isDup) {
          collectedLinks.add(group.link);
          setGroups(prev => [...prev, group]);
        }
        setPagesScanned(p => p + 1);
        setCurrentUrl(raw.link);
      });

      es.addEventListener('log', (e) => {
        const { msg, level } = JSON.parse(e.data);
        addLog((level as FinderLogLine['level']) || 'info', msg);
        // Extrai URL atual dos logs de "Buscando:"
        if (msg.startsWith('Buscando no Google') || msg.startsWith('Buscando:')) {
          const urlMatch = msg.match(/https?:\/\/[^\s]+/);
          if (urlMatch) setCurrentUrl(urlMatch[0]);
        }
      });

      es.addEventListener('done', () => {
        setStatus('done');
        setCurrentUrl('');
        es.close();
        esRef.current = null;
        jobIdRef.current = null;

        // Valida automaticamente se a opção estiver ativa
        if (configRef.current.validateLinks && connectedSessionRef.current) {
          const waLinks = [...collectedLinks].filter(l => l.includes('chat.whatsapp.com'));

          if (waLinks.length > 0) {
            const sid = connectedSessionRef.current.id;
            addLog('info', `Validando ${waLinks.length} links via Baileys...`);
            setValidating(true);

            const BATCH = 20;
            const batches: string[][] = [];
            for (let i = 0; i < waLinks.length; i += BATCH) {
              batches.push(waLinks.slice(i, i + BATCH));
            }

            (async () => {
              const allResults: { link: string; status: FoundGroup['status']; name?: string; members?: number | null }[] = [];
              addLog('info', `Enviando ${waLinks.length} links em ${batches.length} lote(s)...`);
              for (let bi = 0; bi < batches.length; bi++) {
                const batch = batches[bi];
                try {
                  addLog('info', `Lote ${bi + 1}/${batches.length}: ${batch.length} links...`);
                  const r = await fetch(`${SIDECAR}/groups/validate`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ links: batch, sessionId: sid }),
                    signal: AbortSignal.timeout(120000),
                  });
                  const { ok, results } = await r.json();
                  if (ok && results) {
                    allResults.push(...results);
                    const bValid = results.filter((r: { status: string }) => r.status === 'valid').length;
                    const bExpired = results.filter((r: { status: string }) => r.status === 'expired').length;
                    addLog('info', `Lote ${bi + 1}: ${bValid} válidos, ${bExpired} expirados, ${results.length - bValid - bExpired} desconhecidos`);
                  }
                } catch (e) {
                  addLog('warn', `Lote ${bi + 1} falhou: ${e instanceof Error ? e.message : String(e)}`);
                }
              }

              const statusMap = new Map(allResults.map(r => [r.link, r]));
              setGroups(prev => prev.map(g => {
                const r = statusMap.get(g.link);
                if (!r) return g;
                return { ...g, status: r.status, name: r.name || g.name, members: r.members ?? g.members };
              }));

              const valid = allResults.filter(r => r.status === 'valid').length;
              const expired = allResults.filter(r => r.status === 'expired').length;
              addLog('success', `Validação concluída: ${valid} válidos, ${expired} expirados.`);
              setValidating(false);
              setShowCompletion(true);
            })();
          } else {
            setShowCompletion(true);
          }
        } else {
          setShowCompletion(true);
        }
      });

      es.addEventListener('error', (e) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const msg = (e as any).data ? JSON.parse((e as any).data).message : 'Erro na busca';
        addLog('error', msg);
        setStatus('done');
        es.close();
        esRef.current = null;
      });

      es.onerror = () => {
        if (es.readyState === EventSource.CLOSED) {
          setStatus(prev => prev === 'running' ? 'done' : prev);
        }
      };
    } catch (err) {
      addLog('error', `Erro: ${err instanceof Error ? err.message : String(err)}`);
      addLog('warn', 'Verifique se o sidecar está rodando e se o Chromium está instalado.');
      setStatus('idle');
    }
  }, [addLog, stopStream]);

  const handlePause = useCallback(() => {
    if (status === 'running') {
      stopStream();
      setStatus('paused');
      addLog('warn', 'Busca pausada. Os grupos já coletados foram mantidos.');
    } else if (status === 'paused') {
      handleStart();
    }
  }, [status, stopStream, addLog, handleStart]);

  const handleStop = useCallback(() => {
    stopStream();
    setStatus('idle');
    setCurrentUrl('');
    addLog('warn', `Busca interrompida. ${groups.length} grupos coletados.`);
  }, [groups.length, addLog, stopStream]);

  const validateGroups = useCallback(async () => {
    const waGroups = groupsRef.current.filter(g => g.link.includes('chat.whatsapp.com'));
    if (waGroups.length === 0) return;

    if (!connectedSession) {
      addLog('warn', 'Nenhuma sessão WhatsApp conectada. Conecte uma sessão para validar links.');
      return;
    }

    setValidating(true);
    addLog('info', `Validando ${waGroups.length} links...`);

    try {
      const res = await fetch(`${SIDECAR}/groups/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ links: waGroups.map(g => g.link), sessionId: connectedSession.id }),
        signal: AbortSignal.timeout(120000),
      });
      const { ok, results } = await res.json();
      if (!ok) throw new Error('Falha na validação');

      const statusMap = new Map<string, { status: FoundGroup['status']; name?: string; members?: number | null }>(
        results.map((r: { link: string; status: FoundGroup['status']; name?: string; members?: number | null }) => [r.link, r])
      );

      setGroups(prev => prev.map(g => {
        const r = statusMap.get(g.link);
        if (!r) return g;
        return { ...g, status: r.status, name: r.name || g.name, members: r.members ?? g.members };
      }));

      const valid = results.filter((r: { status: string }) => r.status === 'valid').length;
      const expired = results.filter((r: { status: string }) => r.status === 'expired').length;
      addLog('success', `Validação concluída: ${valid} válidos, ${expired} expirados.`);
    } catch (err) {
      addLog('error', `Erro na validação: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setValidating(false);
    }
  }, [addLog, connectedSession]);

  useEffect(() => () => stopStream(), [stopStream]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col h-full gap-3 min-h-0"
    >
      <ChromiumStatus onStatusChange={setChromiumReady} />

      <div className="grid grid-cols-[300px_1fr_380px] gap-3 flex-1 min-h-0 overflow-hidden">
        <div className="overflow-y-auto min-h-0">
          <FinderConfigPanel
            config={config}
            onChange={setConfig}
            status={status}
            onStart={handleStart}
            onPause={handlePause}
            onStop={handleStop}
            disabled={!chromiumReady}
          />
        </div>

        <SearchAutomationViewer
          status={status}
          keyword={config.keyword}
          currentUrl={currentUrl}
          pagesScanned={pagesScanned}
          groupsFound={groups.length}
          maxResults={config.maxResults}
          activity={[]}
        />

        <div className="overflow-hidden min-h-0 flex flex-col">
          <GroupsTable groups={groups} onValidate={validateGroups} validating={validating} onlyValid={config.validateLinks} onJoinGroups={onJoinGroups} />
        </div>
      </div>

      <div className="flex-shrink-0">
        <FinderLogs logs={logs} onClear={() => setLogs([])} />
      </div>

      <CompletionDialog
        open={showCompletion}
        onClose={() => setShowCompletion(false)}
        title="Busca concluída!"
        subtitle={`${groups.length} grupos encontrados`}
        accentColor="bg-violet-500"
        stats={[
          { label: 'Grupos', value: groups.length },
          { label: 'Únicos', value: new Set(groups.map(g => g.link)).size },
          { label: 'Páginas', value: pagesScanned },
        ]}
        actions={[
          {
            label: 'Baixar CSV',
            icon: <Download className="w-4 h-4" />,
            variant: 'primary',
            onClick: () => {
              const toExport = config.validateLinks ? groups.filter(g => g.status === 'valid') : groups;
              exportGroupsCSV(toExport);
              setShowCompletion(false);
            },
          },
          {
            label: 'Exportar Excel',
            icon: <FileSpreadsheet className="w-4 h-4" />,
            onClick: () => {
              const toExport = config.validateLinks ? groups.filter(g => g.status === 'valid') : groups;
              exportGroupsCSV(toExport);
              setShowCompletion(false);
            },
          },
          {
            label: 'Copiar links',
            icon: <Copy className="w-4 h-4" />,
            onClick: () => {
              const toExport = config.validateLinks ? groups.filter(g => g.status === 'valid') : groups;
              navigator.clipboard.writeText(toExport.map(g => g.link).join('\n'));
              setShowCompletion(false);
            },
          },
          {
            label: 'Nova busca',
            icon: <RotateCcw className="w-4 h-4" />,
            onClick: () => { setStatus('idle'); setGroups([]); setLogs([]); setPagesScanned(0); setShowCompletion(false); },
          },
        ]}
      />
    </motion.div>
  );
}

