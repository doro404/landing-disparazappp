import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDropzone } from 'react-dropzone';
import {
  Bot, Plus, Trash2, Edit2, X, Users, User,
  MessageSquare, Zap, Save, Clock, BarChart2, ListOrdered,
  Image, Video, FileIcon, Music, ChevronDown, ChevronUp,
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Switch } from './ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { useApp } from '@/context/AppContext';
import { api } from '@/lib/api';
import { generateId, readFileAsBase64 } from '@/lib/utils';

export type MatchMode = 'contains' | 'exact' | 'startsWith' | 'regex';
export type TargetType = 'all' | 'private' | 'groups' | 'specific';
export type MediaType = 'none' | 'image' | 'video' | 'audio' | 'document';

export interface AutoRule {
  id: string;
  enabled: boolean;
  name: string;
  trigger: string;
  matchMode: MatchMode;
  caseSensitive: boolean;
  targetType: TargetType;
  targetNumbers: string[];
  response: string;
  // Mídia
  mediaType: MediaType;
  mediaBase64: string | null;
  mediaName: string;
  // Comportamento
  simulateTyping: boolean;
  typingDelay: number;
  cooldown: number;
  onlyOnce: boolean;
  respondedNumbers: string[];
  // Horário de funcionamento
  workingHours: { enabled: boolean; start: string; end: string };
}

const DEFAULT_RULE: Omit<AutoRule, 'id'> = {
  enabled: true,
  name: 'Nova Regra',
  trigger: '',
  matchMode: 'contains',
  caseSensitive: false,
  targetType: 'all',
  targetNumbers: [],
  response: '',
  mediaType: 'none',
  mediaBase64: null,
  mediaName: '',
  simulateTyping: true,
  typingDelay: 1500,
  cooldown: 30000,
  onlyOnce: false,
  respondedNumbers: [],
  workingHours: { enabled: false, start: '08:00', end: '18:00' },
};

const matchModeLabel: Record<MatchMode, string> = {
  contains: 'Contém', exact: 'Exato', startsWith: 'Começa com', regex: 'Regex',
};
const targetLabel: Record<TargetType, string> = {
  all: 'Todos', private: 'Apenas privado', groups: 'Apenas grupos', specific: 'Números específicos',
};
const mediaIcons: Record<MediaType, React.ReactNode> = {
  none: null,
  image: <Image className="w-3.5 h-3.5 text-blue-400" />,
  video: <Video className="w-3.5 h-3.5 text-purple-400" />,
  audio: <Music className="w-3.5 h-3.5 text-green-400" />,
  document: <FileIcon className="w-3.5 h-3.5 text-orange-400" />,
};

// ─── RuleEditor ───────────────────────────────────────────────────────────────
function RuleEditor({ rule, onSave, onCancel, stats }: {
  rule: AutoRule;
  onSave: (r: AutoRule) => void;
  onCancel: () => void;
  stats?: { hitCount: number; lastHit: string | null };
}) {
  const [local, setLocal] = useState<AutoRule>({ ...DEFAULT_RULE, ...rule, workingHours: { ...DEFAULT_RULE.workingHours, ...rule.workingHours } });
  const [targetsInput, setTargetsInput] = useState(rule.targetNumbers.join('\n'));
  const set = (p: Partial<AutoRule>) => setLocal((r) => ({ ...r, ...p }));
  const setWH = (p: Partial<AutoRule['workingHours']>) =>
    setLocal((r) => ({ ...r, workingHours: { ...r.workingHours, ...p } }));

  const onDropMedia = useCallback(async (files: File[]) => {
    const file = files[0]; if (!file) return;
    const b64 = await readFileAsBase64(file);
    let mt: MediaType = 'document';
    if (file.type.startsWith('image/')) mt = 'image';
    else if (file.type.startsWith('video/')) mt = 'video';
    else if (file.type.startsWith('audio/')) mt = 'audio';
    set({ mediaBase64: b64, mediaName: file.name, mediaType: mt });
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: onDropMedia,
    accept: { 'image/*': [], 'video/*': [], 'audio/*': [], 'application/pdf': ['.pdf'] },
    multiple: false,
  });

  const handleSave = () => {
    const targets = targetsInput.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
    onSave({ ...local, targetNumbers: targets });
  };

  return (
    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
      className="border border-wa-medium/40 rounded-xl p-4 space-y-4 bg-wa-medium/5">

      {/* Stats badge */}
      {stats && stats.hitCount > 0 && (
        <div className="flex items-center gap-2 text-xs text-wa-muted">
          <BarChart2 className="w-3.5 h-3.5 text-wa-green" />
          <span>{stats.hitCount} disparos</span>
          {stats.lastHit && <span>· último: {new Date(stats.lastHit).toLocaleString('pt-BR')}</span>}
        </div>
      )}

      <div className="space-y-1">
        <label className="text-xs text-wa-text/70">Nome da regra</label>
        <Input value={local.name} onChange={(e) => set({ name: e.target.value })} placeholder="Ex: Saudação inicial" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs text-wa-text/70">Palavra/frase gatilho</label>
          <Input value={local.trigger} onChange={(e) => set({ trigger: e.target.value })}
            placeholder={local.matchMode === 'regex' ? '^(oi|olá)' : 'oi, olá'} />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-wa-text/70">Modo de correspondência</label>
          <Select value={local.matchMode} onValueChange={(v) => set({ matchMode: v as MatchMode })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(matchModeLabel) as MatchMode[]).map((m) => (
                <SelectItem key={m} value={m}>{matchModeLabel[m]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-wa-text/70">Aplicar para</label>
          <Select value={local.targetType} onValueChange={(v) => set({ targetType: v as TargetType })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(targetLabel) as TargetType[]).map((t) => (
                <SelectItem key={t} value={t}>{targetLabel[t]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-wa-text/70">Cooldown (ms)</label>
          <Input type="number" min={0} value={local.cooldown} onChange={(e) => set({ cooldown: +e.target.value })} />
        </div>
      </div>

      {local.targetType === 'specific' && (
        <div className="space-y-1">
          <label className="text-xs text-wa-text/70">Números/grupos (um por linha)</label>
          <Textarea value={targetsInput} onChange={(e) => setTargetsInput(e.target.value)}
            placeholder="5511999999999&#10;120363xxxxxx@g.us" className="h-20 font-mono text-xs" />
        </div>
      )}

      {/* Resposta texto */}
      <div className="space-y-1">
        <label className="text-xs text-wa-text/70">Resposta automática (texto)</label>
        <Textarea value={local.response} onChange={(e) => set({ response: e.target.value })}
          placeholder={"Olá {nome}! 👋\n\nVariáveis: {nome} {numero} {hora} {data} {grupo} {mensagem}"}
          className="h-24" />
        <p className="text-[10px] text-wa-text/50">Variáveis: {'{nome}'} {'{numero}'} {'{hora}'} {'{data}'} {'{grupo}'} {'{mensagem}'}</p>
      </div>

      {/* Mídia */}
      <div className="space-y-2">
        <label className="text-xs text-wa-text/70">Mídia anexada (opcional)</label>
        {local.mediaBase64 ? (
          <div className="flex items-center gap-2 p-2 bg-wa-bg/50 rounded-lg border border-wa-border">
            {mediaIcons[local.mediaType]}
            <span className="text-xs text-wa-text flex-1 truncate">{local.mediaName}</span>
            <button onClick={() => set({ mediaBase64: null, mediaName: '', mediaType: 'none' })}
              className="text-wa-muted hover:text-red-400 transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div {...getRootProps()} className={`border border-dashed rounded-lg p-2.5 text-center cursor-pointer transition-colors ${isDragActive ? 'border-wa-green bg-wa-green/10' : 'border-wa-border hover:border-wa-medium'}`}>
            <input {...getInputProps()} />
            <p className="text-[11px] text-wa-muted">Arraste imagem, vídeo, áudio ou PDF</p>
          </div>
        )}
      </div>

      {/* Horário de funcionamento */}
      <div className="rounded-lg border border-wa-border/50 overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 bg-wa-bg/30">
          <div className="flex items-center gap-2 text-xs text-wa-text">
            <Clock className="w-3.5 h-3.5 text-wa-green" />
            Horário de funcionamento
          </div>
          <Switch checked={local.workingHours.enabled} onCheckedChange={(v) => setWH({ enabled: v })} />
        </div>
        {local.workingHours.enabled && (
          <div className="flex gap-3 px-3 py-2 border-t border-wa-border/50">
            <div className="space-y-1 flex-1">
              <label className="text-[10px] text-wa-text/60">Início</label>
              <Input type="time" value={local.workingHours.start} onChange={(e) => setWH({ start: e.target.value })} className="text-xs" />
            </div>
            <div className="space-y-1 flex-1">
              <label className="text-[10px] text-wa-text/60">Fim</label>
              <Input type="time" value={local.workingHours.end} onChange={(e) => setWH({ end: e.target.value })} className="text-xs" />
            </div>
          </div>
        )}
      </div>

      {/* Toggles */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { key: 'caseSensitive', label: 'Case sensitive', hint: 'Diferencia maiúsculas' },
          { key: 'simulateTyping', label: 'Simular digitação', hint: 'Mostra "digitando..."' },
          { key: 'onlyOnce', label: 'Responder só uma vez', hint: 'Por número/grupo' },
        ].map(({ key, label, hint }) => (
          <div key={key} className="flex items-center justify-between p-2 rounded-lg bg-wa-bg/50 border border-wa-border/40">
            <div>
              <p className="text-xs text-wa-text">{label}</p>
              <p className="text-[10px] text-wa-text/50">{hint}</p>
            </div>
            <Switch checked={local[key as keyof AutoRule] as boolean}
              onCheckedChange={(v) => set({ [key]: v })} />
          </div>
        ))}
        {local.simulateTyping && (
          <div className="space-y-1">
            <label className="text-xs text-wa-text/70">Delay digitação (ms)</label>
            <Input type="number" min={500} max={10000} value={local.typingDelay}
              onChange={(e) => set({ typingDelay: +e.target.value })} />
          </div>
        )}
      </div>

      <div className="flex gap-2 pt-1">
        <Button onClick={handleSave} className="flex-1" size="sm">
          <Save className="w-3.5 h-3.5" />Salvar Regra
        </Button>
        <Button variant="outline" onClick={onCancel} size="sm">
          <X className="w-3.5 h-3.5" />Cancelar
        </Button>
      </div>
    </motion.div>
  );
}

// ─── RuleCard ─────────────────────────────────────────────────────────────────
function RuleCard({ rule, onEdit, onDelete, onToggle, stats }: {
  rule: AutoRule;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
  stats?: { hitCount: number; lastHit: string | null };
}) {
  return (
    <motion.div layout initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}
      className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
        rule.enabled ? 'border-wa-border bg-wa-card' : 'border-wa-border/40 bg-wa-bg/30 opacity-60'
      }`}>
      <Switch checked={rule.enabled} onCheckedChange={onToggle} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-wa-text truncate">{rule.name}</span>
          <Badge variant={rule.enabled ? 'connected' : 'outline'} className="text-[10px] px-1.5 py-0">
            {rule.enabled ? 'Ativa' : 'Inativa'}
          </Badge>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">{matchModeLabel[rule.matchMode]}</Badge>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 flex items-center gap-1">
            {rule.targetType === 'groups' ? <Users className="w-2.5 h-2.5" /> : <User className="w-2.5 h-2.5" />}
            {targetLabel[rule.targetType]}
          </Badge>
          {rule.mediaType !== 'none' && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 flex items-center gap-1">
              {mediaIcons[rule.mediaType]}{rule.mediaType}
            </Badge>
          )}
          {rule.workingHours?.enabled && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 flex items-center gap-1">
              <Clock className="w-2.5 h-2.5" />{rule.workingHours.start}–{rule.workingHours.end}
            </Badge>
          )}
          {stats && stats.hitCount > 0 && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 flex items-center gap-1 text-wa-green border-wa-green/30">
              <BarChart2 className="w-2.5 h-2.5" />{stats.hitCount}×
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          <span className="text-xs text-wa-muted truncate">
            <span className="text-wa-teal">gatilho:</span> "{rule.trigger || '(qualquer)'}"
          </span>
          <span className="text-xs text-wa-muted truncate">
            <span className="text-wa-green">→</span> "{rule.response.slice(0, 40)}{rule.response.length > 40 ? '…' : ''}"
          </span>
        </div>
      </div>
      <div className="flex gap-1 flex-shrink-0">
        <button onClick={onEdit} className="p-1.5 rounded-lg hover:bg-wa-medium/20 text-wa-muted hover:text-wa-text transition-colors">
          <Edit2 className="w-3.5 h-3.5" />
        </button>
        <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-red-500/20 text-wa-muted hover:text-red-400 transition-colors">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </motion.div>
  );
}

// ─── ReplyQueuePanel ──────────────────────────────────────────────────────────
function ReplyQueuePanel({ sessionId }: { sessionId: string }) {
  const { autoReplyQueue } = useApp();
  const queue = autoReplyQueue[sessionId] || [];

  const handleClear = async () => {
    await api.autoReplyClearQueue(sessionId).catch(() => {});
  };

  const statusColor: Record<string, string> = {
    pending: 'text-yellow-400',
    sent: 'text-wa-green',
    failed: 'text-red-400',
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-wa-text">
          <ListOrdered className="w-4 h-4 text-wa-green" />
          Fila de Respostas
          <Badge variant="outline" className="text-[10px]">{queue.length}</Badge>
        </div>
        {queue.length > 0 && (
          <button onClick={handleClear} className="text-xs text-wa-muted hover:text-red-400 transition-colors flex items-center gap-1">
            <Trash2 className="w-3 h-3" />Limpar
          </button>
        )}
      </div>

      <div className="max-h-48 overflow-y-auto space-y-1">
        {queue.length === 0 && (
          <p className="text-xs text-wa-muted text-center py-4">Nenhuma resposta na fila</p>
        )}
        {[...queue].reverse().map((entry) => (
          <div key={entry.id} className="flex items-start gap-2 px-3 py-2 rounded-lg bg-wa-bg/50 border border-wa-border/50 text-xs">
            <span className={`font-semibold flex-shrink-0 ${statusColor[entry.status] || 'text-wa-muted'}`}>
              {entry.status === 'pending' ? '⏳' : entry.status === 'sent' ? '✓' : '✗'}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-wa-text font-medium truncate">{entry.senderNumber}</span>
                <span className="text-wa-muted">→ {entry.ruleName}</span>
              </div>
              <p className="text-wa-text/50 truncate">"{entry.msgText}"</p>
            </div>
            <span className="text-wa-text/45 flex-shrink-0">
              {new Date(entry.ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── AutoResponder (main) ─────────────────────────────────────────────────────
export function AutoResponder() {
  const { activeSessionId, sessions, addLog } = useApp();
  const [rules, setRules] = useState<AutoRule[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [globalEnabled, setGlobalEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [ruleStats, setRuleStats] = useState<Record<string, { hitCount: number; lastHit: string | null }>>({});
  const [showQueue, setShowQueue] = useState(false);

  const isConnected = sessions.find((s) => s.id === activeSessionId)?.status === 'connected';

  // Carrega regras e stats
  useEffect(() => {
    if (!activeSessionId) return;
    const saved = localStorage.getItem(`auto-rules-${activeSessionId}`);
    const enabled = localStorage.getItem(`auto-enabled-${activeSessionId}`) === 'true';
    let loadedRules: AutoRule[] = [];
    if (saved) { try { loadedRules = JSON.parse(saved); } catch {} }
    setRules(loadedRules);
    setGlobalEnabled(enabled);
    if (loadedRules.length > 0) {
      api.autoReply(activeSessionId, {
        enabled, provider: 'rules', apiKey: '', model: '',
        systemPrompt: JSON.stringify(loadedRules),
      }).catch(() => {});
    }
    // Carregar stats
    api.autoReplyStats(activeSessionId).then((r) => setRuleStats(r.stats)).catch(() => {});
  }, [activeSessionId]);

  // Polling de stats a cada 10s
  useEffect(() => {
    if (!activeSessionId || !isConnected) return;
    const t = setInterval(() => {
      api.autoReplyStats(activeSessionId).then((r) => setRuleStats(r.stats)).catch(() => {});
    }, 10000);
    return () => clearInterval(t);
  }, [activeSessionId, isConnected]);

  const saveRules = (newRules: AutoRule[], enabled = globalEnabled) => {
    if (!activeSessionId) return;
    localStorage.setItem(`auto-rules-${activeSessionId}`, JSON.stringify(newRules));
    localStorage.setItem(`auto-enabled-${activeSessionId}`, String(enabled));
    setRules(newRules);
    api.autoReply(activeSessionId, {
      enabled, provider: 'rules', apiKey: '', model: '',
      systemPrompt: JSON.stringify(newRules),
    }).catch(console.error);
  };

  const handleApply = async () => {
    if (!activeSessionId) return;
    setSaving(true);
    try {
      await api.autoReply(activeSessionId, {
        enabled: globalEnabled, provider: 'rules', apiKey: '', model: '',
        systemPrompt: JSON.stringify(rules),
      });
      addLog('success', `Auto-resposta ${globalEnabled ? 'ativada' : 'desativada'} com ${rules.length} regras`);
    } catch (e) {
      addLog('error', `Erro ao aplicar regras: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleGlobal = (v: boolean) => { setGlobalEnabled(v); saveRules(rules, v); };
  const handleAddRule = () => {
    const newRule: AutoRule = { ...DEFAULT_RULE, id: generateId(), name: `Regra ${rules.length + 1}` };
    const updated = [...rules, newRule];
    saveRules(updated);
    setEditingId(newRule.id);
  };
  const handleSaveRule = (updated: AutoRule) => { saveRules(rules.map((r) => r.id === updated.id ? updated : r)); setEditingId(null); };
  const handleDeleteRule = (id: string) => { saveRules(rules.filter((r) => r.id !== id)); if (editingId === id) setEditingId(null); };
  const handleToggleRule = (id: string) => saveRules(rules.map((r) => r.id === id ? { ...r, enabled: !r.enabled } : r));

  const activeCount = rules.filter((r) => r.enabled).length;
  const totalHits = Object.values(ruleStats).reduce((s, v) => s + v.hitCount, 0);

  return (
    <div className="space-y-4">
      {/* Header global */}
      <div className="flex items-center justify-between p-4 rounded-xl border border-wa-border bg-wa-card">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${globalEnabled ? 'bg-wa-green/20 border border-wa-green/30' : 'bg-wa-border/30 border border-wa-border'}`}>
            <Bot className={`w-5 h-5 ${globalEnabled ? 'text-wa-green' : 'text-wa-muted'}`} />
          </div>
          <div>
            <p className="text-sm font-semibold text-wa-text">Auto-Resposta</p>
            <p className="text-xs text-wa-text/70">
              {activeCount} regra{activeCount !== 1 ? 's' : ''} ativa{activeCount !== 1 ? 's' : ''}
              {globalEnabled ? ' · Rodando' : ' · Pausado'}
              {totalHits > 0 && ` · ${totalHits} disparos`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowQueue((v) => !v)}
            className="flex items-center gap-1 text-xs text-wa-muted hover:text-wa-text transition-colors px-2 py-1 rounded-lg hover:bg-wa-border/30">
            <ListOrdered className="w-3.5 h-3.5" />Fila
            {showQueue ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          <Switch checked={globalEnabled} onCheckedChange={handleToggleGlobal} />
          <Button size="sm" onClick={handleApply} disabled={!isConnected || saving}>
            <Zap className="w-3.5 h-3.5" />{saving ? 'Aplicando...' : 'Aplicar'}
          </Button>
        </div>
      </div>

      {/* Fila de respostas */}
      <AnimatePresence>
        {showQueue && activeSessionId && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden rounded-xl border border-wa-border bg-wa-card p-4">
            <ReplyQueuePanel sessionId={activeSessionId} />
          </motion.div>
        )}
      </AnimatePresence>

      {!isConnected && (
        <p className="text-xs text-yellow-400 text-center py-2">Conecte uma sessão para ativar o auto-resposta</p>
      )}

      {/* Lista de regras */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-wa-text flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-wa-green" />
            Regras configuradas
          </h3>
          <Button size="sm" variant="outline" onClick={handleAddRule}>
            <Plus className="w-3.5 h-3.5" />Nova Regra
          </Button>
        </div>

        <div className="space-y-2">
          <AnimatePresence>
            {rules.length === 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="text-center py-10 text-wa-muted">
                <Bot className="w-10 h-10 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Nenhuma regra configurada</p>
                <p className="text-xs mt-1">Clique em "Nova Regra" para começar</p>
              </motion.div>
            )}
            {rules.map((rule) => (
              <div key={rule.id}>
                {editingId === rule.id ? (
                  <RuleEditor rule={rule} onSave={handleSaveRule} onCancel={() => setEditingId(null)}
                    stats={ruleStats[rule.id]} />
                ) : (
                  <RuleCard rule={rule} onEdit={() => setEditingId(rule.id)}
                    onDelete={() => handleDeleteRule(rule.id)}
                    onToggle={() => handleToggleRule(rule.id)}
                    stats={ruleStats[rule.id]} />
                )}
              </div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Dica de variáveis */}
      {rules.length > 0 && (
        <div className="p-3 rounded-xl bg-wa-teal/5 border border-wa-teal/20 text-xs text-wa-muted space-y-1">
          <p className="text-wa-teal font-medium">Variáveis disponíveis nas respostas:</p>
          <div className="grid grid-cols-2 gap-1">
            {[
              ['{nome}', 'Nome do contato'], ['{numero}', 'Número do remetente'],
              ['{hora}', 'Hora atual (HH:MM)'], ['{data}', 'Data atual (DD/MM/YYYY)'],
              ['{grupo}', 'Nome do grupo'], ['{mensagem}', 'Mensagem recebida'],
            ].map(([v, d]) => (
              <span key={v}><span className="text-wa-green font-mono">{v}</span> — {d}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
