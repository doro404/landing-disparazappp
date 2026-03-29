import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { LayoutDashboard, Settings2, MessageSquare, Sparkles, BarChart3, FlaskConical, History } from 'lucide-react';
import { IAConfig, Conversation } from './types';
import { DEFAULT_IA_CONFIG } from './iaData';
import { IAHeader } from './IAHeader';
import { IAConfigPanel } from './IAConfigPanel';
import { IAConversationList } from './IAConversationList';
import { IAConversationDetail } from './IAConversationDetail';
import { IAMetricsPanel } from './IAMetricsPanel';
import { IAPromptEditor } from './IAPromptEditor';
import { IATester } from './IATester';
import { IAHistoryPanel } from './IAHistoryPanel';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useApp } from '@/context/AppContext';
import { api } from '@/lib/api';

type TabId = 'overview' | 'conversations' | 'config' | 'prompts' | 'metrics' | 'tester' | 'history';

export function IAAtendimento() {
  const { activeSessionId, settings } = useApp();
  const [config, setConfig] = useState<IAConfig>(DEFAULT_IA_CONFIG);
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);

  // Envia config pro sidecar sempre que mudar
  const pushConfig = useCallback((cfg: IAConfig) => {
    if (!activeSessionId) return;
    api.ia.setConfig(activeSessionId, {
      enabled: cfg.enabled,
      provider: cfg.provider || settings.aiProvider,
      apiKey: cfg.apiKey || settings.aiApiKey,
      model: cfg.model || settings.aiModel,
      basePrompt: cfg.basePrompt,
      chatScope: cfg.chatScope,
      responseDelayMin: cfg.responseDelayMin,
      responseDelayMax: cfg.responseDelayMax,
      workingHoursEnabled: cfg.workingHoursEnabled,
      workingHoursStart: cfg.workingHoursStart,
      workingHoursEnd: cfg.workingHoursEnd,
      forbiddenWords: cfg.forbiddenWords,
      sensitiveWords: cfg.sensitiveWords,
      fallbackMessage: cfg.fallbackMessage,
      transferWebhook: cfg.transferWebhook,
    }).catch(console.error);
  }, [activeSessionId, settings]);

  // Re-envia quando sessão ativa muda
  useEffect(() => { pushConfig(config); }, [activeSessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleConfigChange = (cfg: IAConfig) => {
    setConfig(cfg);
    pushConfig(cfg);
  };

  const toggleIA = () => {
    const next = { ...config, enabled: !config.enabled };
    setConfig(next);
    pushConfig(next);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col h-full gap-3 min-h-0"
    >
      {/* Header */}
      <IAHeader config={config} onToggle={toggleIA} />

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={v => setActiveTab(v as TabId)} className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <TabsList className="flex-shrink-0">
          <TabsTrigger value="overview">
            <LayoutDashboard className="w-3.5 h-3.5 mr-1.5" />Visão Geral
          </TabsTrigger>
          <TabsTrigger value="conversations">
            <MessageSquare className="w-3.5 h-3.5 mr-1.5" />Conversas
          </TabsTrigger>
          <TabsTrigger value="config">
            <Settings2 className="w-3.5 h-3.5 mr-1.5" />Configurações
          </TabsTrigger>
          <TabsTrigger value="prompts">
            <Sparkles className="w-3.5 h-3.5 mr-1.5" />Prompts
          </TabsTrigger>
          <TabsTrigger value="metrics">
            <BarChart3 className="w-3.5 h-3.5 mr-1.5" />Métricas
          </TabsTrigger>
          <TabsTrigger value="tester">
            <FlaskConical className="w-3.5 h-3.5 mr-1.5" />Testador
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="w-3.5 h-3.5 mr-1.5" />Histórico
          </TabsTrigger>
        </TabsList>

        {/* Overview */}
        <TabsContent value="overview" forceMount className={`flex-1 overflow-hidden min-h-0 mt-4 ${activeTab !== 'overview' ? 'hidden' : ''}`}>
          <div className="grid grid-cols-[1fr_380px] gap-3 h-full overflow-hidden">
            <div className="overflow-y-auto min-h-0">
              <IAMetricsPanel />
            </div>
            <div className="overflow-hidden min-h-0 flex flex-col gap-3">
              <IAConversationList onSelect={setSelectedConversation} selected={selectedConversation} chatScope={config.chatScope} />
            </div>
          </div>
        </TabsContent>

        {/* Conversations */}
        <TabsContent value="conversations" forceMount className={`flex-1 overflow-hidden min-h-0 mt-4 ${activeTab !== 'conversations' ? 'hidden' : ''}`}>
          <div className="grid grid-cols-[320px_1fr] gap-3 h-full overflow-hidden">
            <IAConversationList onSelect={setSelectedConversation} selected={selectedConversation} chatScope={config.chatScope} />
            <IAConversationDetail conversation={selectedConversation} onClose={() => setSelectedConversation(null)} />
          </div>
        </TabsContent>

        {/* Config */}
        <TabsContent value="config" forceMount className={`flex-1 overflow-hidden min-h-0 mt-4 ${activeTab !== 'config' ? 'hidden' : ''}`}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full overflow-hidden">
            <div className="overflow-y-auto min-h-0">
              <IAConfigPanel config={config} onChange={handleConfigChange} />
            </div>
            <div className="overflow-y-auto min-h-0">
              <IATester config={config} />
            </div>
          </div>
        </TabsContent>

        {/* Prompts */}
        <TabsContent value="prompts" forceMount className={`flex-1 overflow-hidden min-h-0 mt-4 ${activeTab !== 'prompts' ? 'hidden' : ''}`}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full overflow-hidden">
            <div className="overflow-y-auto min-h-0">
              <IAPromptEditor config={config} onChange={handleConfigChange} />
            </div>
            <div className="overflow-y-auto min-h-0">
              <IATester config={config} />
            </div>
          </div>
        </TabsContent>

        {/* Metrics */}
        <TabsContent value="metrics" forceMount className={`flex-1 overflow-hidden min-h-0 mt-4 ${activeTab !== 'metrics' ? 'hidden' : ''}`}>
          <div className="overflow-y-auto h-full min-h-0">
            <IAMetricsPanel />
          </div>
        </TabsContent>

        {/* Tester */}
        <TabsContent value="tester" forceMount className={`flex-1 overflow-hidden min-h-0 mt-4 ${activeTab !== 'tester' ? 'hidden' : ''}`}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full overflow-hidden">
            <div className="overflow-y-auto min-h-0">
              <IATester config={config} />
            </div>
            <div className="overflow-y-auto min-h-0">
              <IAConfigPanel config={config} onChange={handleConfigChange} />
            </div>
          </div>
        </TabsContent>

        {/* History */}
        <TabsContent value="history" forceMount className={`flex-1 overflow-hidden min-h-0 mt-4 ${activeTab !== 'history' ? 'hidden' : ''}`}>
          <IAHistoryPanel />
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}

