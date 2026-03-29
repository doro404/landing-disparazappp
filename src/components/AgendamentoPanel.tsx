import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDropzone } from 'react-dropzone';
import {
  Calendar, Plus, Trash2, Edit2, Clock, Zap, Upload,
  Image, Video, FileIcon, X, RefreshCw, Save,
  ChevronDown, ChevronUp, Users, Search, Loader2, Check,
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Switch } from './ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import { useApp } from '@/context/AppContext';
import { campaignApi, Campaign, CampaignSchedule, api } from '@/lib/api';
import { parseNumberList, readFileAsBase64, readFileAsText } from '@/lib/utils';
import { Group } from '@/types';

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const DEFAULT_SCHEDULE: CampaignSchedule = {
  type: 'daily', dailyTime: '09:00',
  intervalValue: 4, intervalUnit: 'hours',
  weeklyDays: [1], weeklyTime: '09:00',
  monthlyDay: 1, monthlyTime: '09:00',
};

const DEFAULT_CAMPAIGN: Omit<Campaign, 'id'> = {
  name: '', enabled: true, sessionId: 'session-1',
  message: '', numbers: [],
  schedule: DEFAULT_SCHEDULE,
  delayMin: 10, delayMax: 30, limitPerDay: 150,
};

// ─── Seletor de destinatários ─────────────────────────────────────────────────
type DestMode = 'groups' | 'contacts' | 'manual';

function SelectedGroupsTags({ selectedGroups, groups, onRemove }: {
  selectedGroups: Set<string>;
  groups: Group[];
  onRemove: (g: Group) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const ids = [...selectedGroups];
  const visible = expanded ? ids : ids.slice(0, 3);
  const hidden = ids.length - 3;

  return (
    <div className="flex flex-wrap gap-1 items-center">
      {visible.map((id) => {
        const g = groups.find((x) => x.id === id);
        return g ? (
          <span key={id} className="flex items-center gap-1 text-[10px] bg-wa-medium/20 text-wa-teal border border-wa-medium/30 rounded-full px-2 py-0.5">
            {g.subject || id}
            <button onClick={() => onRemove(g)} className="hover:text-red-400"><X className="w-2.5 h-2.5" /></button>
          </span>
        ) : null;
      })}
      {!expanded && hidden > 0 && (
        <button onClick={() => setExpanded(true)} className="text-[10px] text-wa-green hover:text-wa-teal font-medium px-2 py-0.5 rounded-full border border-wa-green/30 bg-wa-green/10">
          +{hidden} mais
        </button>
      )}
      {expanded && ids.length > 3 && (
        <button onClick={() => setExpanded(false)} className="text-[10px] text-wa-muted hover:text-wa-text font-medium px-2 py-0.5 rounded-full border border-wa-border bg-wa-border/20">
          ocultar
        </button>
      )}
    </div>
  );
}

function DestinatariosSelector({ sessionId, value, onChange }: {
  sessionId: string;
  value: string[];
  onChange: (numbers: string[]) => void;
}) {
  const { groupsUpdatedAt } = useApp();
  const [mode, setMode] = useState<DestMode>('groups');
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [contactsText, setContactsText] = useState('');
  const [manualText, setManualText] = useState(value.join('\n'));

  // Carrega grupos da sessão (do cache — não bloqueia)
  const loadGroups = useCallback(async (forceRefresh = false) => {
    if (!sessionId) return;
    if (forceRefresh) setRefreshing(true);
    else setLoadingGroups(true);
    try {
      const res = await api.groups.list(sessionId, forceRefresh);
      setGroups(res.groups as Group[]);
      if (res.loading || res.refreshing) setRefreshing(true);
      else setRefreshing(false);
    } catch {}
    finally { setLoadingGroups(false); }
  }, [sessionId]);

  // Quando backend termina de atualizar cache, recarrega
  useEffect(() => {
    if (!groupsUpdatedAt[sessionId]) return;
    api.groups.list(sessionId).then((res) => {
      setGroups(res.groups as Group[]);
      setRefreshing(false);
    }).catch(() => {});
  }, [groupsUpdatedAt[sessionId]]);

  // Sincroniza seleção de grupos → numbers (JIDs de grupo)
  const toggleGroup = (g: Group) => {
    const next = new Set(selectedGroups);
    if (next.has(g.id)) next.delete(g.id);
    else next.add(g.id);
    setSelectedGroups(next);
    onChange([...next]);
  };

  // Sincroniza contatos CSV → numbers
  const onDropContacts = useCallback(async (files: File[]) => {
    const text = await readFileAsText(files[0]);
    setContactsText(text);
    onChange(parseNumberList(text));
  }, [onChange]);

  const { getRootProps, getInputProps } = useDropzone({
    onDrop: onDropContacts,
    accept: { 'text/plain': ['.txt'], 'text/csv': ['.csv'] },
    multiple: false,
  });

  const filteredGroups = groups.filter((g) =>
    (g.subject || '').toLowerCase().includes(search.toLowerCase())
  );

  const totalSelected = mode === 'groups'
    ? selectedGroups.size
    : mode === 'contacts'
    ? parseNumberList(contactsText).length
    : parseNumberList(manualText).length;

  return (
    <div className="space-y-3">
      {/* Tabs de modo */}
      <div className="flex items-center justify-between">
        <label className="text-[13px] font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: 'var(--color-textSecondary)' }}>
          <Users className="w-3.5 h-3.5" />Destinatários
        </label>
        <span className="text-xs text-wa-green font-medium">{totalSelected} selecionado{totalSelected !== 1 ? 's' : ''}</span>
      </div>

      <div className="flex gap-1 p-1.5 rounded-xl" style={{ backgroundColor: 'var(--color-bgTertiary)' }}>
        {([['groups', 'Grupos'], ['contacts', 'Contatos CSV'], ['manual', 'Manual']] as [DestMode, string][]).map(([m, label]) => (
          <button key={m} onClick={() => setMode(m)}
            className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all duration-200 ${mode === m
              ? 'text-white shadow-sm'
              : 'hover:text-wa-text'
            }`}
            style={{
              backgroundColor: mode === m ? 'var(--color-accentPrimary)' : 'transparent',
              color: mode === m ? '#fff' : 'var(--color-textSecondary)',
            }}>
            {label}
          </button>
        ))}
      </div>

      {/* Modo Grupos */}
      {mode === 'groups' && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-wa-muted" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar grupo..." className="pl-8 h-8 text-xs" />
            </div>
            <Button size="sm" variant="outline" onClick={() => loadGroups(true)} disabled={loadingGroups || refreshing} className="h-8 px-2">
              {(loadingGroups || refreshing) ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            </Button>
          </div>

          {groups.length === 0 ? (
            <div className="text-center py-6 text-wa-muted text-xs border border-dashed border-wa-border rounded-xl">
              {(loadingGroups || refreshing) ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : (
                <><Users className="w-6 h-6 mx-auto mb-1 opacity-30" /><p>Clique em atualizar para carregar grupos</p></>
              )}
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between px-1">
                <span className="text-[10px] text-wa-text/60">{filteredGroups.length} grupo{filteredGroups.length !== 1 ? 's' : ''}</span>
                <button
                  onClick={() => {
                    const allSelected = filteredGroups.every((g) => selectedGroups.has(g.id));
                    const next = new Set(selectedGroups);
                    if (allSelected) {
                      filteredGroups.forEach((g) => next.delete(g.id));
                    } else {
                      filteredGroups.forEach((g) => next.add(g.id));
                    }
                    setSelectedGroups(next);
                    onChange([...next]);
                  }}
                  className="text-[10px] text-wa-green hover:text-wa-teal transition-colors font-medium"
                >
                  {filteredGroups.every((g) => selectedGroups.has(g.id)) ? 'Desmarcar todos' : 'Selecionar todos'}
                </button>
              </div>
            <ScrollArea className="h-44 border border-wa-border rounded-xl">
              <div className="p-1.5 space-y-0.5">
                {filteredGroups.map((g) => {
                  const sel = selectedGroups.has(g.id);

                  // Determina tipo do grupo
                  const isAnnounce = g.announce;
                  const isCommunity = g.isCommunity || g.isCommunityAnnounce;
                  const isLinked = !!g.linkedParent;
                  const needsApproval = g.joinApprovalMode;

                  return (
                    <button key={g.id} onClick={() => toggleGroup(g)}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-colors ${sel ? 'bg-wa-medium/20 border border-wa-medium/40' : 'hover:bg-wa-border/30 border border-transparent'}`}>
                      <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border transition-colors ${sel ? 'bg-wa-medium border-wa-medium' : 'border-wa-border'}`}>
                        {sel && <Check className="w-3 h-3 text-white" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-wa-text truncate">{g.subject}</p>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <span className="text-[10px] text-wa-text/60">{g.participantCount} membros</span>
                          {isCommunity && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30">Comunidade</span>
                          )}
                          {isLinked && !isCommunity && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">Sub-grupo</span>
                          )}
                          {isAnnounce ? (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30">Só admins</span>
                          ) : (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-wa-green/20 text-wa-green border border-wa-green/30">Aberto</span>
                          )}
                          {needsApproval && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">Aprovação</span>
                          )}
                          {g.desc && (
                            <span className="text-[9px] text-wa-text/50 truncate max-w-[120px]" title={g.desc}>{g.desc}</span>
                          )}
                        </div>
                      </div>
                      {sel && <Badge variant="connected" className="text-[9px] px-1.5 flex-shrink-0">✓</Badge>}
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
            </>
          )}

          {selectedGroups.size > 0 && (
            <SelectedGroupsTags
              selectedGroups={selectedGroups}
              groups={groups}
              onRemove={toggleGroup}
            />
          )}
        </div>
      )}

      {/* Modo Contatos CSV */}
      {mode === 'contacts' && (
        <div className="space-y-2">
          <div {...getRootProps()} className="border-2 border-dashed border-wa-border hover:border-wa-medium rounded-xl p-4 text-center cursor-pointer transition-colors">
            <input {...getInputProps()} />
            <Upload className="w-5 h-5 text-wa-muted mx-auto mb-1" />
            <p className="text-xs text-wa-text/70">Arraste TXT ou CSV com números</p>
            <p className="text-[10px] text-wa-text/50 mt-0.5">Um número por linha ou separado por vírgula</p>
          </div>
          {contactsText && (
            <ScrollArea className="h-32 border border-wa-border rounded-xl p-2">
              <div className="flex flex-wrap gap-1">
                {parseNumberList(contactsText).map((n) => (
                  <span key={n} className="text-[10px] font-mono bg-wa-border/40 text-wa-text rounded px-1.5 py-0.5">{n}</span>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      )}

      {/* Modo Manual */}
      {mode === 'manual' && (
        <div className="space-y-1">
          <Textarea value={manualText}
            onChange={(e) => { setManualText(e.target.value); onChange(parseNumberList(e.target.value)); }}
            placeholder={"5511999999999\n5521888888888\n5531777777777"}
            className="h-36 font-mono text-xs" />
          <p className="text-[10px] text-wa-text/50">Um número por linha, com ou sem código do país</p>
        </div>
      )}
    </div>
  );
}

// ─── Formulário de campanha ───────────────────────────────────────────────────
function CampaignForm({ initial, onSave, onCancel }: {
  initial: Partial<Campaign>;
  onSave: (c: Partial<Campaign>) => void;
  onCancel: () => void;
}) {
  const { sessions } = useApp();
  const [form, setForm] = useState<Partial<Campaign>>({ ...DEFAULT_CAMPAIGN, ...initial });
  const [mediaName, setMediaName] = useState('');
  const set = (p: Partial<Campaign>) => setForm((f) => ({ ...f, ...p }));
  const setSched = (p: Partial<CampaignSchedule>) => set({ schedule: { ...form.schedule!, ...p } });

  const onDropMedia = useCallback(async (files: File[]) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    try {
      const b64 = await readFileAsBase64(file);
      setMediaName(file.name);
      let mt = 'document';
      if (file.type.startsWith('image/')) mt = 'image';
      else if (file.type.startsWith('video/')) mt = 'video';
      set({ media: b64, mediaType: mt });
    } catch (e) {
      console.error('Erro ao ler arquivo:', e);
    }
  }, []);

  const { getRootProps: mediaProps, getInputProps: mediaInput } = useDropzone({
    onDrop: onDropMedia,
    multiple: false,
    accept: { 'image/*': [], 'video/*': [], 'application/pdf': ['.pdf'] },
  });

  const sched = form.schedule!;
  const handleSave = () => onSave({ ...form });

  return (
    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
      className="border rounded-[14px] p-6" style={{ borderColor: 'color-mix(in srgb, var(--color-accentPrimary) 25%, var(--color-borderColor))', backgroundColor: 'color-mix(in srgb, var(--color-accentPrimary) 3%, var(--color-bgSecondary))' }}>

      {/* Layout 2 colunas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── Coluna esquerda: configurações ── */}
        <div className="space-y-5">

          {/* Nome + Sessão */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[13px] font-medium text-wa-text">Nome da campanha</label>
              <Input value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="Ex: Promoção Semanal" />
            </div>
            <div className="space-y-1">
              <label className="text-[13px] font-medium text-wa-text">Sessão WhatsApp</label>
              <Select value={form.sessionId} onValueChange={(v) => set({ sessionId: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {sessions.map((s, i) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.user?.name || `Conta ${i + 1}`} {s.status === 'connected' ? '✓' : '✗'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Mensagem */}
          <div className="space-y-1">
            <label className="text-xs text-wa-text/70">Mensagem</label>
            <Textarea value={form.message} onChange={(e) => set({ message: e.target.value })}
              placeholder={"Olá {nome}! 👋\nMensagem automática às {hora} de {data}.\nCampanha: {campanha}"}
              className="h-28" />
            <p className="text-[10px] text-wa-text/50">
              Variáveis: <span className="text-wa-green">{'{nome}'} {'{numero}'} {'{hora}'} {'{data}'} {'{campanha}'}</span>
            </p>
          </div>

          {/* Mídia */}
          <div className="space-y-1">
            <label className="text-xs text-wa-text/70">Mídia (opcional)</label>
            {form.media ? (
              <div className="flex items-center gap-2 p-2.5 bg-wa-border/30 rounded-lg border border-wa-border">
                {form.mediaType === 'image' ? <Image className="w-4 h-4 text-blue-400" /> :
                 form.mediaType === 'video' ? <Video className="w-4 h-4 text-purple-400" /> :
                 <FileIcon className="w-4 h-4 text-orange-400" />}
                <span className="text-sm text-wa-text flex-1 truncate">{mediaName || 'Mídia salva'}</span>
                <button onClick={() => set({ media: null, mediaType: undefined })} className="text-wa-muted hover:text-red-400">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (form as any).hasMedia ? (
              <div className="flex items-center gap-2 p-2.5 bg-wa-border/30 rounded-lg border border-wa-border">
                <FileIcon className="w-4 h-4 text-orange-400" />
                <span className="text-sm text-wa-text flex-1">Mídia salva (não recarregada)</span>
                <button onClick={() => set({ media: null, mediaType: undefined })} className="text-wa-muted hover:text-red-400" title="Remover mídia">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div {...mediaProps()} className="border-2 border-dashed border-wa-border hover:border-wa-medium rounded-xl p-3 text-center cursor-pointer transition-colors">
                <input {...mediaInput()} />
                <Upload className="w-5 h-5 text-wa-muted mx-auto mb-1" />
                <p className="text-xs text-wa-text/70">Imagem, Vídeo ou PDF</p>
              </div>
            )}
          </div>

          {/* Anti-ban */}
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <label className="text-[13px] font-medium text-wa-text">Delay mín (s)</label>
              <Input type="number" min={5} value={form.delayMin} onChange={(e) => set({ delayMin: +e.target.value })} />
            </div>
            <div className="space-y-1">
              <label className="text-[13px] font-medium text-wa-text">Delay máx (s)</label>
              <Input type="number" min={5} value={form.delayMax} onChange={(e) => set({ delayMax: +e.target.value })} />
            </div>
            <div className="space-y-1">
              <label className="text-[13px] font-medium text-wa-text">Limite/dia</label>
              <Input type="number" min={1} value={form.limitPerDay} onChange={(e) => set({ limitPerDay: +e.target.value })} />
            </div>
          </div>
        </div>

        {/* ── Coluna direita: periodicidade + destinatários ── */}
        <div className="space-y-5">

          {/* Periodicidade */}
          <div className="space-y-3">
            <label className="text-[13px] font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: 'var(--color-textSecondary)' }}>
              <Clock className="w-3.5 h-3.5" />Periodicidade
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {(['interval', 'daily', 'weekly', 'monthly'] as const).map((t) => (
                <button key={t} onClick={() => setSched({ type: t })}
                  className={`py-2 rounded-lg text-xs font-medium transition-colors ${sched.type === t ? 'bg-wa-medium text-white' : 'bg-wa-border/40 text-wa-muted hover:text-wa-text'}`}>
                  {t === 'interval' ? 'Intervalo' : t === 'daily' ? 'Diário' : t === 'weekly' ? 'Semanal' : 'Mensal'}
                </button>
              ))}
            </div>

            {sched.type === 'interval' && (
              <div className="flex gap-2">
                <Input type="number" min={1} value={sched.intervalValue} onChange={(e) => setSched({ intervalValue: +e.target.value })} className="w-24" />
                <Select value={sched.intervalUnit} onValueChange={(v) => setSched({ intervalUnit: v as CampaignSchedule['intervalUnit'] })}>
                  <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="minutes">Minutos</SelectItem>
                    <SelectItem value="hours">Horas</SelectItem>
                    <SelectItem value="days">Dias</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {sched.type === 'daily' && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-wa-muted">Todo dia às</span>
                <Input type="time" value={sched.dailyTime} onChange={(e) => setSched({ dailyTime: e.target.value })} className="w-32" />
              </div>
            )}
            {sched.type === 'weekly' && (
              <div className="space-y-2">
                <div className="flex gap-1.5 flex-wrap">
                  {WEEKDAYS.map((d, i) => (
                    <button key={i} onClick={() => {
                      const days = sched.weeklyDays || [];
                      setSched({ weeklyDays: days.includes(i) ? days.filter((x) => x !== i) : [...days, i] });
                    }}
                      className={`w-10 h-10 rounded-lg text-xs font-medium transition-colors ${(sched.weeklyDays || []).includes(i) ? 'bg-wa-medium text-white' : 'bg-wa-border/40 text-wa-muted hover:text-wa-text'}`}>
                      {d}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-wa-muted">às</span>
                  <Input type="time" value={sched.weeklyTime} onChange={(e) => setSched({ weeklyTime: e.target.value })} className="w-32" />
                </div>
              </div>
            )}
            {sched.type === 'monthly' && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-wa-muted">Todo dia</span>
                <Input type="number" min={1} max={31} value={sched.monthlyDay} onChange={(e) => setSched({ monthlyDay: +e.target.value })} className="w-20" />
                <span className="text-sm text-wa-muted">às</span>
                <Input type="time" value={sched.monthlyTime} onChange={(e) => setSched({ monthlyTime: e.target.value })} className="w-32" />
              </div>
            )}
          </div>

          {/* Destinatários */}
          <DestinatariosSelector
            sessionId={form.sessionId || 'session-1'}
            value={form.numbers || []}
            onChange={(numbers) => set({ numbers })}
          />
        </div>
      </div>

      {/* Ações */}
      <div className="flex gap-2 pt-4 mt-1 border-t border-wa-border/30">
        <Button onClick={handleSave} className="flex-1" disabled={!form.name || !form.message}>
          <Save className="w-4 h-4 mr-1" />Salvar Campanha
        </Button>
        <Button variant="outline" onClick={onCancel}>
          <X className="w-4 h-4 mr-1" />Cancelar
        </Button>
      </div>
    </motion.div>
  );
}

// ─── Card de campanha ─────────────────────────────────────────────────────────
function CampaignCard({ campaign, onEdit, onDelete, onToggle, onRunNow }: {
  campaign: Campaign;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: (v: boolean) => void;
  onRunNow: () => void;
}) {
  const scheduleLabel = (s: CampaignSchedule) => {
    if (s.type === 'interval') return `A cada ${s.intervalValue} ${s.intervalUnit === 'minutes' ? 'min' : s.intervalUnit === 'hours' ? 'h' : 'dias'}`;
    if (s.type === 'daily') return `Todo dia às ${s.dailyTime}`;
    if (s.type === 'weekly') return `Semanal às ${s.weeklyTime}`;
    if (s.type === 'monthly') return `Dia ${s.monthlyDay} às ${s.monthlyTime}`;
    return '';
  };

  const isRunning = campaign.status === 'running';

  return (
    <motion.div layout initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}
      className={`p-5 rounded-[14px] border transition-all duration-200`}
      style={{
        borderColor: campaign.enabled ? 'var(--color-borderColor)' : 'color-mix(in srgb, var(--color-borderColor) 50%, transparent)',
        backgroundColor: campaign.enabled ? 'var(--color-bgSecondary)' : 'var(--color-bgTertiary)',
        opacity: campaign.enabled ? 1 : 0.65,
        boxShadow: campaign.enabled ? 'var(--shadow-card)' : 'none',
      }}>
      <div className="flex items-start gap-3">
        <Switch checked={campaign.enabled} onCheckedChange={onToggle} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-sm font-semibold text-wa-text">{campaign.name}</span>
            <Badge variant={isRunning ? 'connected' : 'outline'} className="text-[10px]">
              {isRunning ? (
                <><span className="w-1.5 h-1.5 rounded-full bg-wa-green animate-pulse inline-block mr-1" />Rodando</>
              ) : campaign.enabled ? 'Agendado' : 'Pausado'}
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              <Clock className="w-2.5 h-2.5 mr-1" />{scheduleLabel(campaign.schedule)}
            </Badge>
          </div>

          <p className="text-xs text-wa-muted truncate mb-2">
            {(campaign as any).hasMedia && <span className="inline-flex items-center gap-1 mr-1.5 text-[10px] bg-blue-500/20 text-blue-400 border border-blue-500/30 rounded px-1.5 py-0.5">📎 mídia</span>}
            "{campaign.message?.slice(0, 70)}{(campaign.message?.length || 0) > 70 ? '…' : ''}"
          </p>

          <div className="flex items-center gap-4 text-xs text-wa-muted flex-wrap">
            <span>{campaign.numbers?.length || 0} destinatários</span>
            <span>Delay: {campaign.delayMin}–{campaign.delayMax}s</span>
            <span>Limite: {campaign.limitPerDay}/dia</span>
            <span>Sessão: {campaign.sessionId}</span>
            {campaign.lastRun && (
              <span>Último: {new Date(campaign.lastRun).toLocaleString('pt-BR')}</span>
            )}
          </div>

          {campaign.lastStats && (
            <div className="flex gap-3 mt-1.5 text-xs">
              <span className="text-wa-green">✓ {campaign.lastStats.sent} enviados</span>
              <span className="text-red-400">✗ {campaign.lastStats.failed} falhas</span>
            </div>
          )}
        </div>

        <div className="flex gap-1 flex-shrink-0">
          <button onClick={onRunNow} title="Disparar agora"
            className="p-1.5 rounded-lg hover:bg-wa-green/20 text-wa-muted hover:text-wa-green transition-colors">
            <Zap className="w-3.5 h-3.5" />
          </button>
          <button onClick={onEdit}
            className="p-1.5 rounded-lg hover:bg-wa-medium/20 text-wa-muted hover:text-wa-text transition-colors">
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={onDelete}
            className="p-1.5 rounded-lg hover:bg-red-500/20 text-wa-muted hover:text-red-400 transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Painel principal ─────────────────────────────────────────────────────────
export function AgendamentoPanel() {
  const { addLog } = useApp();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [globalEnabled, setGlobalEnabled] = useState(true);
  const [listExpanded, setListExpanded] = useState(true);

  const load = useCallback(async () => {
    try { setCampaigns(await campaignApi.list()); } catch {}
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (data: Partial<Campaign>) => {
    try {
      if (editingId) {
        await campaignApi.update(editingId, data);
        addLog('success', `Campanha "${data.name}" atualizada`);
      } else {
        await campaignApi.create(data);
        addLog('success', `Campanha "${data.name}" criada`);
      }
      setEditingId(null);
      setCreating(false);
      await load();
    } catch (e) {
      addLog('error', `Erro: ${(e as Error).message}`);
    }
  };

  const handleDelete = async (id: string) => {
    await campaignApi.delete(id);
    addLog('warn', 'Campanha removida');
    await load();
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    // Optimistic update imediato
    setCampaigns((prev) => prev.map((c) => c.id === id ? { ...c, enabled } : c));
    try {
      await campaignApi.toggle(id, enabled);
      await load();
    } catch {
      await load(); // reverte em caso de erro
    }
  };

  const handleRunNow = async (id: string, name: string) => {
    await campaignApi.runNow(id);
    addLog('info', `Disparo manual iniciado: "${name}"`);
  };

  const handleGlobalToggle = async (enabled: boolean) => {
    setGlobalEnabled(enabled);
    // Ativa/pausa todas as campanhas
    await Promise.all(campaigns.map((c) => campaignApi.toggle(c.id, enabled)));
    await load();
  };

  const activeCampaigns = campaigns.filter((c) => c.enabled).length;

  return (
    <div className="space-y-5">

      {/* ── Header com toggle global + botão nova campanha ── */}
      <div className="flex items-center justify-between p-5 rounded-[14px] border" style={{ borderColor: 'var(--color-borderColor)', backgroundColor: 'var(--color-bgSecondary)', boxShadow: 'var(--shadow-card)' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-wa-teal/20 border border-wa-teal/30 flex items-center justify-center">
            <Calendar className="w-5 h-5 text-wa-teal" />
          </div>
          <div>
            <p className="text-sm font-bold" style={{ color: 'var(--color-textPrimary)' }}>Disparos Periódicos</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-textSecondary)' }}>
              {activeCampaigns} campanha{activeCampaigns !== 1 ? 's' : ''} ativa{activeCampaigns !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-wa-text/70">Disparos ativos</span>
            <Switch checked={globalEnabled} onCheckedChange={handleGlobalToggle} />
          </div>
          <Button size="sm" variant="outline" onClick={load}>
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
          <Button size="sm" onClick={() => { setCreating(true); setEditingId(null); }}>
            <Plus className="w-3.5 h-3.5 mr-1" />Nova Campanha
          </Button>
        </div>
      </div>

      {/* ── Formulário de criação ── */}
      <AnimatePresence>
        {creating && (
          <CampaignForm
            initial={{}}
            onSave={handleSave}
            onCancel={() => setCreating(false)}
          />
        )}
      </AnimatePresence>

      {/* ── Lista de campanhas ── */}
      <div className="space-y-2">
        <button
          onClick={() => setListExpanded((v) => !v)}
          className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-wa-card border border-wa-border hover:border-wa-medium/50 transition-colors"
        >
          <span className="text-xs font-semibold text-wa-muted uppercase tracking-wider">
            Campanhas ({campaigns.length})
          </span>
          {listExpanded ? <ChevronUp className="w-4 h-4 text-wa-muted" /> : <ChevronDown className="w-4 h-4 text-wa-muted" />}
        </button>

        <AnimatePresence>
          {listExpanded && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              className="space-y-2 overflow-hidden">

              {campaigns.length === 0 && !creating && (
                <div className="text-center py-10 text-wa-muted">
                  <Calendar className="w-10 h-10 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">Nenhuma campanha agendada</p>
                  <p className="text-xs mt-1">Clique em "Nova Campanha" para começar</p>
                </div>
              )}

              {campaigns.map((c) => (
                <div key={c.id}>
                  {editingId === c.id ? (
                    <CampaignForm
                      initial={c}
                      onSave={handleSave}
                      onCancel={() => setEditingId(null)}
                    />
                  ) : (
                    <CampaignCard
                      campaign={c}
                      onEdit={() => { setEditingId(c.id); setCreating(false); }}
                      onDelete={() => handleDelete(c.id)}
                      onToggle={(v) => handleToggle(c.id, v)}
                      onRunNow={() => handleRunNow(c.id, c.name)}
                    />
                  )}
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Dicas anti-ban ── */}
      {campaigns.length > 0 && (
        <div className="p-3 rounded-xl bg-wa-green/5 border border-wa-green/20 text-xs text-wa-muted space-y-1">
          <p className="text-wa-green font-medium flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5" />Dicas Anti-ban
          </p>
          <p>• Delay mínimo recomendado: 10s entre mensagens</p>
          <p>• Limite seguro: 150 mensagens/dia por número</p>
          <p>• Prefira horários comerciais (8h–20h)</p>
          <p>• Rotacione sessões para listas grandes</p>
        </div>
      )}
    </div>
  );
}
