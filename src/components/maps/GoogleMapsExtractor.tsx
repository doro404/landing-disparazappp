import { useState, useRef, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Download, Copy, RotateCcw, Send } from 'lucide-react';
import { ExtractorConfigPanel, ExtractorConfig } from './ExtractorConfigPanel';
import { AutomationViewer } from './AutomationViewer';
import { LeadsTable, Lead } from './LeadsTable';
import { ExtractorLogs, LogLine } from './ExtractorLogs';
import { ChromiumStatus } from './ChromiumStatus';
import { CompletionDialog } from '@/components/shared/CompletionDialog';

const SIDECAR = 'http://127.0.0.1:3001';

function makeLog(level: LogLine['level'], message: string): LogLine {
  return { id: crypto.randomUUID(), level, message, ts: Date.now() };
}

function exportLeadsCSV(leads: Lead[]) {
  const header = 'Nome,Telefone,Website,Endereço,Avaliação,Avaliações,Categoria,WhatsApp\n';
  const rows = leads.map(l =>
    [l.name, l.phone, l.website, l.address, l.rating, l.reviews, l.category ?? '', l.hasWhatsapp === true ? 'Sim' : l.hasWhatsapp === false ? 'Não' : '']
      .map(v => `"${(v ?? '').replace(/"/g, '""')}"`)
      .join(',')
  ).join('\n');
  const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'leads-maps.csv'; a.click();
  URL.revokeObjectURL(url);
}

function getPhoneNumbers(leads: Lead[]): string {
  return leads.map(l => l.phone.replace(/\D/g, '')).filter(p => p.length >= 10).join('\n');
}

export function GoogleMapsExtractor({ onSendToBulk }: { onSendToBulk?: (numbers: string) => void }) {
  const [config, setConfig] = useState<ExtractorConfig>({
    keyword: '', location: '', maxResults: 50,
    minRating: 0, categoryFilter: '',
    extractPhone: true, extractWebsite: true, extractEmail: false,
    extractAddress: true, extractRating: true, extractReviews: true,
  });

  const [chromiumReady, setChromiumReady] = useState(false);
  const [status, setStatus] = useState<'idle' | 'running' | 'paused' | 'done'>('idle');
  const [leads, setLeads] = useState<Lead[]>([]);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [currentBusiness, setCurrentBusiness] = useState('');
  const [showCompletion, setShowCompletion] = useState(false);
  const [checkingWhatsapp, setCheckingWhatsapp] = useState(false);

  const jobIdRef = useRef<string | null>(null);
  const esRef = useRef<EventSource | null>(null);
  const configRef = useRef(config);
  useEffect(() => { configRef.current = config; }, [config]);

  const addLog = useCallback((level: LogLine['level'], message: string) => {
    setLogs(prev => [...prev.slice(-199), makeLog(level, message)]);
  }, []);

  const stopStream = useCallback(() => {
    if (esRef.current) { esRef.current.close(); esRef.current = null; }
    if (jobIdRef.current) {
      fetch(`${SIDECAR}/maps/stop/${jobIdRef.current}`, { method: 'DELETE' }).catch(() => {});
      jobIdRef.current = null;
    }
  }, []);

  const checkWhatsapp = useCallback(async (collectedLeads: Lead[]) => {
    // Pega a primeira sessão conectada disponível
    try {
      const sessRes = await fetch(`${SIDECAR}/sessions`);
      const sessions: Array<{ id: string; status: string }> = await sessRes.json();
      const connected = sessions.find(s => s.status === 'connected');
      if (!connected) {
        addLog('warn', 'Nenhuma sessão WhatsApp conectada — verificação de WA ignorada.');
        return;
      }

      const phones = collectedLeads
        .map(l => l.phone.replace(/\D/g, ''))
        .filter(p => p.length >= 10);

      if (phones.length === 0) return;

      addLog('info', `Verificando WhatsApp para ${phones.length} números...`);
      setCheckingWhatsapp(true);

      const res = await fetch(`${SIDECAR}/sessions/${connected.id}/check-whatsapp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ numbers: phones }),
      });
      const { ok, results } = await res.json();
      if (!ok) throw new Error('Falha na verificação');

      // Monta mapa número → hasWhatsapp
      const waMap = new Map<string, boolean>();
      for (const r of results) {
        waMap.set(String(r.number).replace(/\D/g, ''), r.hasWhatsapp);
      }

      setLeads(prev => prev.map(l => {
        const clean = l.phone.replace(/\D/g, '');
        if (!clean || clean.length < 10) return l;
        const has = waMap.get(clean);
        return has !== undefined ? { ...l, hasWhatsapp: has } : l;
      }));

      const waCount = results.filter((r: { hasWhatsapp: boolean }) => r.hasWhatsapp).length;
      addLog('success', `WhatsApp verificado: ${waCount}/${phones.length} números ativos.`);
    } catch (err) {
      addLog('warn', `Verificação WA falhou: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setCheckingWhatsapp(false);
    }
  }, [addLog]);

  const leadsRef = useRef<Lead[]>([]);
  useEffect(() => { leadsRef.current = leads; }, [leads]);

  const handleStart = useCallback(async () => {
    stopStream();
    setLeads([]);
    setLogs([]);
    setCurrentBusiness('');
    setStatus('running');

    const cfg = configRef.current;
    addLog('info', `Iniciando extração: "${cfg.keyword}" em "${cfg.location}"`);
    addLog('info', 'Aguarde — abrindo navegador...');

    try {
      const res = await fetch(`${SIDECAR}/maps/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          keyword: cfg.keyword,
          location: cfg.location,
          maxResults: cfg.maxResults,
          minRating: cfg.minRating,
          categoryFilter: cfg.categoryFilter,
        }),
      });
      const { ok, jobId, error } = await res.json();
      if (!ok) throw new Error(error || 'Falha ao iniciar job');

      jobIdRef.current = jobId;
      const es = new EventSource(`${SIDECAR}/maps/stream/${jobId}`);
      esRef.current = es;

      es.addEventListener('lead', (e) => {
        const raw = JSON.parse(e.data);
        const lead: Lead = {
          id: crypto.randomUUID(),
          name: raw.name || '',
          phone: cfg.extractPhone ? (raw.phone || '') : '',
          website: cfg.extractWebsite ? (raw.website || '') : '',
          address: cfg.extractAddress ? (raw.address || '') : '',
          rating: cfg.extractRating ? (raw.rating || '') : '',
          reviews: cfg.extractReviews ? (raw.reviews || '') : '',
          category: raw.category || '',
        };
        setCurrentBusiness(lead.name);
        setLeads(prev => [...prev, lead]);
      });

      es.addEventListener('log', (e) => {
        const { msg, level } = JSON.parse(e.data);
        addLog((level as LogLine['level']) || 'info', msg);
      });

      es.addEventListener('done', () => {
        setStatus('done');
        setCurrentBusiness('');
        setShowCompletion(true);
        es.close();
        esRef.current = null;
        jobIdRef.current = null;
        // Verifica WhatsApp após extração
        checkWhatsapp(leadsRef.current).catch(() => {});
      });

      es.addEventListener('error', (e) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const msg = (e as any).data ? JSON.parse((e as any).data).message : 'Erro no scraping';
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
  }, [addLog, stopStream, checkWhatsapp]);

  const handleStop = useCallback(() => {
    stopStream();
    setStatus('idle');
    setCurrentBusiness('');
    addLog('warn', 'Extração interrompida pelo usuário.');
  }, [addLog, stopStream]);

  // Pausa: fecha o stream mas mantém os leads (não tem como pausar o browser remotamente)
  const handlePause = useCallback(() => {
    if (status === 'running') {
      stopStream();
      setStatus('paused');
      addLog('warn', 'Extração pausada. Os leads já coletados foram mantidos.');
    } else if (status === 'paused') {
      handleStart();
    }
  }, [status, stopStream, addLog, handleStart]);

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
          <ExtractorConfigPanel
            config={config}
            onChange={setConfig}
            status={status}
            onStart={handleStart}
            onPause={handlePause}
            onStop={handleStop}
            disabled={!chromiumReady}
          />
        </div>

        <AutomationViewer
          status={status}
          keyword={config.keyword}
          location={config.location}
          collected={leads.length}
          maxResults={config.maxResults}
          currentBusiness={currentBusiness}
        />

        <div className="overflow-hidden min-h-0 flex flex-col">
          <LeadsTable
            leads={leads}
            onSendToBulk={onSendToBulk}
            checkingWhatsapp={checkingWhatsapp}
            onCheckWhatsapp={() => checkWhatsapp(leadsRef.current)}
          />
        </div>
      </div>

      <div className="flex-shrink-0">
        <ExtractorLogs logs={logs} onClear={() => setLogs([])} />
      </div>

      <CompletionDialog
        open={showCompletion}
        onClose={() => setShowCompletion(false)}
        title="Extração concluída!"
        subtitle={`${leads.length} leads coletados do Google Maps`}
        accentColor="bg-wa-green"
        stats={[
          { label: 'Leads', value: leads.length },
          { label: 'Com telefone', value: leads.filter(l => l.phone).length },
          { label: 'Com website', value: leads.filter(l => l.website).length },
        ]}
        actions={[
          {
            label: 'Disparar agora',
            icon: <Send className="w-4 h-4" />,
            variant: 'primary' as const,
            onClick: () => {
              const numbers = getPhoneNumbers(leads);
              if (numbers && onSendToBulk) onSendToBulk(numbers);
              setShowCompletion(false);
            },
          },
          {
            label: 'Baixar CSV',
            icon: <Download className="w-4 h-4" />,
            onClick: () => { exportLeadsCSV(leads); setShowCompletion(false); },
          },
          {
            label: 'Copiar telefones',
            icon: <Copy className="w-4 h-4" />,
            onClick: () => {
              navigator.clipboard.writeText(leads.map(l => l.phone).filter(Boolean).join('\n'));
              setShowCompletion(false);
            },
          },
          {
            label: 'Nova extração',
            icon: <RotateCcw className="w-4 h-4" />,
            onClick: () => { setStatus('idle'); setLeads([]); setLogs([]); setShowCompletion(false); },
          },
        ]}
      />
    </motion.div>
  );
}

