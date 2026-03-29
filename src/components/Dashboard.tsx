import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Send, BarChart3, Bot, Calendar, Terminal, Trash, WifiOff, LayoutGrid, MapPin, UserSearch, Telescope, Brain, CheckCircle2, XCircle, Clock, Zap, LogIn, Wifi, QrCode } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import { StatsCards } from './StatsCards';
import { DisparoForm } from './DisparoForm';
import { LogTerminal } from './LogTerminal';
import { AutoResponder } from './AutoResponder';
import { AgendamentoPanel } from './AgendamentoPanel';
import { ToolsGrid } from './ToolsLauncher';
import { GoogleMapsExtractor } from './maps/GoogleMapsExtractor';
import { WhatsAppGroupExtractor } from './groups/WhatsAppGroupExtractor';
import { GroupFinder } from './finder/GroupFinder';
import { GroupJoiner } from './joiner/GroupJoiner';
import { IAAtendimento } from './ia/IAAtendimento';
import { DashboardKPIs } from './DashboardKPIs';
import { FeaturedCTACard } from './FeaturedCTACard';
import { ModulesGrid } from './ModulesGrid';
import { useApp } from '@/context/AppContext';
import { formatDuration } from '@/lib/utils';
import { ScrollArea } from './ui/scroll-area';
import { useTheme } from '@/context/ThemeContext';
import { LogEntry } from '@/types';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

function BulkStatsCards() {
  const { activeSessionId, bulkProgress: bulkProgressMap, isBulkRunning: isBulkRunningMap } = useApp();
  const { currentTheme } = useTheme();
  const bulkProgress = (activeSessionId && bulkProgressMap[activeSessionId]) || null;
  const isBulkRunning = !!(activeSessionId && isBulkRunningMap[activeSessionId]);
  const stats = bulkProgress?.stats;
  const elapsed = stats?.startTime ? Date.now() - stats.startTime : 0;
  const deliveryRate = stats && (stats.sent + stats.failed) > 0
    ? Math.round((stats.sent / (stats.sent + stats.failed)) * 100)
    : 0;

  const cards = [
    { icon: Send,         label: 'Enviadas',  value: stats?.sent ?? 0,                              color: 'text-accent-success',    bg: 'bg-accent-success/10 border-accent-success/20' },
    { icon: CheckCircle2, label: 'Entrega',   value: `${deliveryRate}%`,                            color: 'text-accent-success', bg: 'bg-accent-success/10 border-accent-success/20' },
    { icon: XCircle,      label: 'Falhas',    value: stats?.failed ?? 0,                            color: 'text-accent-error',     bg: 'bg-accent-error/10 border-accent-error/20' },
    { icon: Clock,        label: 'Tempo',     value: elapsed > 0 ? formatDuration(elapsed) : '—',  color: 'text-accent-warning',  bg: 'bg-accent-warning/10 border-accent-warning/20' },
    { icon: Zap,          label: 'Disparo',   value: isBulkRunning ? 'Ativo' : 'Parado',           color: isBulkRunning ? 'text-accent-success' : 'text-text-secondary', bg: isBulkRunning ? 'bg-accent-success/10 border-accent-success/20' : 'bg-border-color/30 border-border-color' },
  ];

  return (
    <div className="grid grid-cols-5 gap-2">
      {cards.map((card) => (
        <div key={card.label} className={`card-wa border ${card.bg} flex items-center gap-2 px-3 py-2`}>
          <card.icon className={`w-4 h-4 flex-shrink-0 ${card.color}`} />
          <div className="min-w-0">
            <p className={`text-sm font-bold leading-none ${card.color}`}>{card.value}</p>
            <p className="text-[10px] text-wa-muted mt-0.5 truncate">{card.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// Dados mock para o gráfico de atividade
const mockChartData = Array.from({ length: 12 }, (_, i) => ({
  hora: `${i * 2}h`,
  enviados: Math.floor(Math.random() * 80),
  falhas: Math.floor(Math.random() * 10),
}));

// Wrapper que bloqueia visualmente o conteúdo quando não há sessão conectada
function SessionGate({ connected, children }: { connected: boolean; children: React.ReactNode }) {
  return (
    <div className="relative">
      {children}
      {!connected && (
        <div className="absolute inset-0 rounded-xl bg-navy-900/70 backdrop-blur-[1px] flex flex-col items-center justify-center gap-2 pointer-events-auto z-10 cursor-not-allowed">
          <WifiOff className="w-6 h-6 text-wa-muted/60" />
          <p className="text-sm text-wa-muted/80 font-medium">Sessão não conectada</p>
          <p className="text-xs text-wa-muted/50">Conecte uma sessão WhatsApp na barra lateral</p>
        </div>
      )}
    </div>
  );
}

interface TerminalBoxProps {
  title: string;
  logs: LogEntry[];
  onClear: () => void;
  emptyText: string;
  levelColor: Record<string, string>;
  levelLabel: Record<string, string>;
  bottomRef: React.RefObject<HTMLDivElement | null> | undefined;
  active: boolean;
}

function TerminalBox({ title, logs, onClear, emptyText, levelColor, levelLabel, bottomRef, active }: TerminalBoxProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active) return;
    const root = scrollRef.current;
    if (!root) return;
    const viewport = root.querySelector('[data-radix-scroll-area-viewport]') as HTMLElement | null;
    if (viewport) viewport.scrollTop = viewport.scrollHeight;
  }, [logs, active]);

  return (
    <div className="rounded-xl border border-wa-border bg-wa-bgDeep flex flex-col overflow-hidden flex-shrink-0" style={{ height: '11rem' }}>
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-wa-border flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500/60" />
            <span className="w-2 h-2 rounded-full bg-yellow-500/60" />
            <span className="w-2 h-2 rounded-full bg-emerald-500/60" />
          </div>
          <Terminal className="w-3.5 h-3.5 text-wa-green ml-1" />
          <span className="text-xs font-mono text-wa-green/70">{title}</span>
          <span className="text-xs font-mono text-wa-muted">— {logs.length} entradas</span>
        </div>
        <button onClick={onClear} className="text-wa-muted hover:text-red-400 transition-colors" title="Limpar">
          <Trash className="w-3.5 h-3.5" />
        </button>
      </div>
      <ScrollArea ref={scrollRef} className="flex-1 p-3">
        <div className="space-y-0.5 font-mono text-xs">
          {logs.length === 0 ? (
            <p className="text-wa-muted/50 italic">
              <span className="text-wa-green/50">$</span> {emptyText}
            </p>
          ) : (
            logs.map((log) => (
              <motion.div key={log.id} initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }}
                className="flex gap-2 leading-5">
                <span className="text-wa-muted/50 flex-shrink-0 select-none">
                  {new Date(log.ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
                <span className={`flex-shrink-0 font-semibold ${levelColor[log.level]}`}>
                  {levelLabel[log.level]}
                </span>
                <span className="text-wa-text/80 break-all">{log.message}</span>
              </motion.div>
            ))
          )}
          {bottomRef && <div ref={bottomRef} />}
        </div>
      </ScrollArea>
    </div>
  );
}

export function Dashboard() {
  const { activeSessionId, sessions, logs, clearLogs, bulkLogs, clearBulkLogs, campaignLogs, clearCampaignLogs, autoReplyLogs, clearAutoReplyLogs } = useApp();
  const { currentTheme } = useTheme();
  const activeSession = sessions.find((s) => s.id === activeSessionId);
  const isConnected = activeSession?.status === 'connected';
  const anyConnected = sessions.some((s) => s.status === 'connected');
  const [activeTab, setActiveTab] = useState('disparo');
  const [pendingNumbers, setPendingNumbers] = useState('');
  const [joinerLinks, setJoinerLinks] = useState<string[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll do terminal de campanhas
  useEffect(() => {
    if (activeTab === 'agendamento') {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [campaignLogs, activeTab]);

  const handleSendToBulk = (numbers: string) => {
    setPendingNumbers(numbers);
    setActiveTab('disparo');
  };

  const levelColor: Record<string, string> = {
    info: 'text-sky-400', success: 'text-emerald-400',
    error: 'text-red-400', warn: 'text-yellow-400',
  };
  const levelLabel: Record<string, string> = {
    info: '[INFO   ]', success: '[SUCESSO]',
    error: '[ERRO   ]', warn: '[AVISO  ]',
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex-1 flex flex-col overflow-hidden p-5 gap-4 bg-wa-bg"
    >
      {/* 🎯 KPIs no topo */}
      {activeTab === 'tools' && anyConnected && <DashboardKPIs />}

      {/* ⚠️ Estado vazio — nenhuma sessão conectada */}
      {!anyConnected && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex-shrink-0 flex items-center gap-3 px-4 py-3 rounded-xl border border-wa-border bg-wa-card shadow-sm"
        >
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center flex-shrink-0">
            <QrCode className="w-4 h-4 text-amber-500" strokeWidth={1.5} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-wa-text">Nenhuma sessão conectada</p>
            <p className="text-xs text-wa-muted mt-0.5">Clique no <span className="text-wa-green font-medium">+</span> na barra lateral para conectar via QR Code.</p>
          </div>
          <Wifi className="w-4 h-4 text-wa-muted flex-shrink-0" strokeWidth={1.5} />
        </motion.div>
      )}

      {/* 📊 Featured CTA Card no Tools tab */}
      {activeTab === 'tools' && isConnected && (
        <FeaturedCTACard onCreateClick={() => setActiveTab('disparo')} campaignCount={0} />
      )}
      {/* Área superior: cards normais OU terminal por tab ativa */}
      {activeTab === 'agendamento' ? (
        <TerminalBox
          title="log de campanhas"
          logs={campaignLogs}
          onClear={clearCampaignLogs}
          emptyText="aguardando disparos periódicos..."
          levelColor={levelColor}
          levelLabel={levelLabel}
          bottomRef={bottomRef}
          active={activeTab === 'agendamento'}
        />
      ) : activeTab === 'autoresposta' ? (
        <TerminalBox
          title="log de auto-resposta"
          logs={autoReplyLogs}
          onClear={clearAutoReplyLogs}
          emptyText="aguardando mensagens recebidas..."
          levelColor={levelColor}
          levelLabel={levelLabel}
          bottomRef={undefined}
          active={activeTab === 'autoresposta'}
        />
      ) : activeTab === 'disparo' ? (
        <TerminalBox
          title="log de disparo em massa"
          logs={bulkLogs}
          onClear={clearBulkLogs}
          emptyText="aguardando início do disparo..."
          levelColor={levelColor}
          levelLabel={levelLabel}
          bottomRef={undefined}
          active={activeTab === 'disparo'}
        />
      ) : (
        <div />
      )}

      {/* Tabs principais */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden min-h-0 gap-0">
        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="flex-shrink-0">
          <TabsList className="flex-shrink-0 w-full justify-start overflow-x-auto">
            <TabsTrigger value="tools">
              <LayoutGrid className="w-4 h-4 mr-2" />Início
            </TabsTrigger>
            <TabsTrigger value="disparo">
              <Send className="w-4 h-4 mr-2" />Disparo
            </TabsTrigger>
            <TabsTrigger value="autoresposta">
              <Bot className="w-4 h-4 mr-2" />Auto-Resposta
            </TabsTrigger>
            <TabsTrigger value="agendamento">
              <Calendar className="w-4 h-4 mr-2" />Agendamentos
            </TabsTrigger>
            <TabsTrigger value="stats">
              <BarChart3 className="w-4 h-4 mr-2" />Estatísticas
            </TabsTrigger>
            <TabsTrigger value="maps">
              <MapPin className="w-4 h-4 mr-2" />Maps
            </TabsTrigger>
            <TabsTrigger value="group-extractor">
              <UserSearch className="w-4 h-4 mr-2" />Extrator
            </TabsTrigger>
            <TabsTrigger value="group-finder">
              <Telescope className="w-4 h-4 mr-2" />Finder
            </TabsTrigger>
            <TabsTrigger value="group-joiner">
              <LogIn className="w-4 h-4 mr-2" />Joiner
            </TabsTrigger>
            <TabsTrigger value="ia-atendimento">
              <Brain className="w-4 h-4 mr-2" />IA
            </TabsTrigger>
          </TabsList>
        </motion.div>

        <TabsContent value="tools" className="flex-1 overflow-y-auto min-h-0 mt-0">
          <ModulesGrid onTabChange={setActiveTab} />
        </TabsContent>

        <TabsContent value="disparo" className="flex-1 overflow-y-auto min-h-0 mt-0">
          <SessionGate connected={isConnected}>
            <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-wa-border bg-wa-card shadow-sm p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <Send className="w-4 h-4 text-emerald-500" strokeWidth={1.5} />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-wa-text">Disparo em Massa</h2>
                  {activeSession && (
                    <p className="text-xs text-wa-muted mt-0.5">
                      Sessão: <span className="text-wa-green font-medium">{activeSession.user?.name || activeSessionId}</span>
                    </p>
                  )}
                </div>
              </div>
              <DisparoForm initialNumbers={pendingNumbers} />
            </motion.div>
          </SessionGate>
        </TabsContent>

        <TabsContent value="autoresposta" className="flex-1 overflow-y-auto min-h-0 mt-0">
          <SessionGate connected={isConnected}>
            <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-wa-border bg-wa-card shadow-sm p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-9 h-9 rounded-xl bg-violet-500/10 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-violet-400" strokeWidth={1.5} />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-wa-text">Auto-Resposta Inteligente</h2>
                  <p className="text-xs text-wa-muted mt-0.5">Respostas automáticas com IA</p>
                </div>
              </div>
              <AutoResponder />
            </motion.div>
          </SessionGate>
        </TabsContent>

        <TabsContent value="agendamento" forceMount className={`flex-1 overflow-y-auto min-h-0 mt-0 ${activeTab !== 'agendamento' ? 'hidden' : ''}`}>
          <div className="rounded-xl border border-wa-border bg-wa-card shadow-sm p-6">
            <AgendamentoPanel />
          </div>
        </TabsContent>

        <TabsContent value="stats" className="flex-1 overflow-y-auto min-h-0 mt-0">
          <div className="space-y-4">
            <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}>
              <BulkStatsCards />
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}
              className="rounded-xl border border-wa-border bg-wa-card shadow-sm p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/10 flex items-center justify-center">
                  <BarChart3 className="w-4 h-4 text-cyan-400" strokeWidth={1.5} />
                </div>
                <h2 className="text-base font-semibold text-wa-text">Atividade de Envio</h2>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={mockChartData}>
                  <defs>
                    <linearGradient id="colorEnviados" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-accentSuccess)" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="var(--color-accentSuccess)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorFalhas" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-accentError)" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="var(--color-accentError)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="hora" stroke="var(--color-textSecondary)" tick={{ fontSize: 11, fill: 'var(--color-textSecondary)' }} axisLine={false} tickLine={false} />
                  <YAxis stroke="var(--color-textSecondary)" tick={{ fontSize: 11, fill: 'var(--color-textSecondary)' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: 'var(--color-bgSecondary)', border: '1px solid var(--color-borderColor)', borderRadius: 8, color: 'var(--color-textPrimary)' }} labelStyle={{ color: 'var(--color-textPrimary)' }} />
                  <Area type="monotone" dataKey="enviados" stroke="var(--color-accentSuccess)" fill="url(#colorEnviados)" strokeWidth={2} name="Enviados" />
                  <Area type="monotone" dataKey="falhas" stroke="var(--color-accentError)" fill="url(#colorFalhas)" strokeWidth={2} name="Falhas" />
                </AreaChart>
              </ResponsiveContainer>
            </motion.div>
          </div>
        </TabsContent>

        <TabsContent value="maps" forceMount className={`flex-1 overflow-hidden min-h-0 mt-4 ${activeTab !== 'maps' ? 'hidden' : ''}`}>
          <GoogleMapsExtractor onSendToBulk={handleSendToBulk} />
        </TabsContent>

        <TabsContent value="group-extractor" forceMount className={`flex-1 overflow-hidden min-h-0 mt-4 ${activeTab !== 'group-extractor' ? 'hidden' : ''}`}>
          <WhatsAppGroupExtractor onSendToBulk={handleSendToBulk} />
        </TabsContent>

        <TabsContent value="group-finder" forceMount className={`flex-1 overflow-hidden min-h-0 mt-4 ${activeTab !== 'group-finder' ? 'hidden' : ''}`}>
          <GroupFinder onJoinGroups={(links) => { setJoinerLinks(links); setActiveTab('group-joiner'); }} />
        </TabsContent>

        <TabsContent value="group-joiner" forceMount className={`flex-1 overflow-hidden min-h-0 mt-4 ${activeTab !== 'group-joiner' ? 'hidden' : ''}`}>
          <GroupJoiner initialLinks={joinerLinks} onLinksConsumed={() => setJoinerLinks([])} />
        </TabsContent>

        <TabsContent value="ia-atendimento" forceMount className={`flex-1 overflow-hidden min-h-0 mt-4 ${activeTab !== 'ia-atendimento' ? 'hidden' : ''}`}>
          <IAAtendimento />
        </TabsContent>
      </Tabs>

      {/* Terminal de logs — fixo no rodapé, nunca empurra o layout */}
      <div className="flex-shrink-0">
        <LogTerminal />
      </div>
    </motion.div>
  );
}
