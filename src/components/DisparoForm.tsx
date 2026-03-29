import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDropzone } from 'react-dropzone';
import { Send, Upload, FileText, Image, Video, FileIcon, Trash2, Play, Square, AlertCircle, Plus, GripVertical, Clock, Eye, Pause, ShieldOff, Phone } from 'lucide-react';
import { Button } from './ui/button';
import { Textarea } from './ui/textarea';
import { Input } from './ui/input';
import { Progress } from './ui/progress';
import { DisparoConfig, DisparoOptions, DEFAULT_DISPARO_OPTIONS } from './DisparoConfig';
import { DisparoPreview } from './DisparoPreview';
import { DisparoBlacklist } from './DisparoBlacklist';
import { useApp } from '@/context/AppContext';
import { useLicenseContext } from '@/context/LicenseContext';
import { setCachedSends, getCachedSends } from '@/lib/trial';
import { licenseApi } from '@/lib/licenseApi';
import { getFingerprint } from '@/lib/fingerprint';
import { Notify } from '@/lib/notify';
import { api } from '@/lib/api';
import { parseNumberList, readFileAsBase64, readFileAsText, estimateTime, exportCSV } from '@/lib/utils';

type MediaType = 'none' | 'image' | 'video' | 'document' | 'sticker';

export interface MessageItem {
  id: string;
  text: string;
  mediaBase64: string | null;
  mediaName: string;
  mediaType: MediaType;
  caption: string;
}

export interface ContactRow {
  number: string;
  vars: Record<string, string>;
}

function newMessage(): MessageItem {
  return { id: crypto.randomUUID(), text: '', mediaBase64: null, mediaName: '', mediaType: 'none', caption: '' };
}

/** Parse CSV or plain number list into ContactRow[]. */
function parseContacts(raw: string): ContactRow[] {
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return [];

  // Detect CSV: first line has comma/semicolon and at least one non-numeric token
  const sep = lines[0].includes(';') ? ';' : ',';
  const firstCols = lines[0].split(sep);
  const isCSV = firstCols.length > 1 && firstCols.some((c) => /[a-zA-Z]/.test(c));

  if (isCSV) {
    const headers = firstCols.map((h) => h.trim().toLowerCase());
    const numIdx = headers.findIndex((h) => h === 'numero' || h === 'number' || h === 'phone' || h === 'telefone');
    const nameIdx = headers.findIndex((h) => h === 'nome' || h === 'name');
    const dataLines = lines.slice(1);
    return dataLines.map((line) => {
      const cols = line.split(sep).map((c) => c.trim());
      const number = (numIdx >= 0 ? cols[numIdx] : cols[0]).replace(/\D/g, '');
      const vars: Record<string, string> = {};
      headers.forEach((h, i) => {
        if (i !== numIdx && cols[i] !== undefined) vars[h] = cols[i];
      });
      // Alias: nome/name
      if (nameIdx >= 0 && cols[nameIdx]) {
        vars['nome'] = cols[nameIdx];
        vars['name'] = cols[nameIdx];
      }
      return { number, vars };
    }).filter((c) => c.number.length >= 8);
  }

  // Plain list
  return parseNumberList(raw).map((n) => ({ number: n, vars: {} }));
}

interface MessageEditorProps {
  item: MessageItem;
  index: number;
  total: number;
  onChange: (patch: Partial<MessageItem>) => void;
  onRemove: () => void;
}

function MessageEditor({ item, index, total, onChange, onRemove }: MessageEditorProps) {
  const onDropMedia = useCallback(async (files: File[]) => {
    const file = files[0]; if (!file) return;
    const b64 = await readFileAsBase64(file);
    let mt: MediaType = 'document';
    if (file.type.startsWith('image/')) mt = 'image';
    else if (file.type.startsWith('video/')) mt = 'video';
    onChange({ mediaBase64: b64, mediaName: file.name, mediaType: mt });
  }, [onChange]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: onDropMedia,
    accept: { 'image/*': ['.jpg','.jpeg','.png','.gif','.webp'], 'video/*': ['.mp4','.mov'], 'application/pdf': ['.pdf'] },
    multiple: false,
  });

  const mediaIcons: Record<MediaType, React.ReactNode> = {
    none: null,
    image: <Image className="w-4 h-4 text-blue-400" />,
    video: <Video className="w-4 h-4 text-purple-400" />,
    document: <FileIcon className="w-4 h-4 text-orange-400" />,
    sticker: <FileIcon className="w-4 h-4 text-pink-400" />,
  };

  return (
    <div className="rounded-[14px] border border-wa-border bg-wa-card/50 overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 py-2.5 bg-wa-border/20 border-b border-wa-border">
        <GripVertical className="w-3.5 h-3.5 text-wa-text/45" />
        <span className="text-xs font-semibold text-wa-muted">Mensagem {index + 1}</span>
        <div className="flex-1" />
        {total > 1 && (
          <button onClick={onRemove} className="text-wa-muted hover:text-red-400 transition-colors p-0.5">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="p-4 space-y-3">
        <Textarea
          placeholder={`Mensagem ${index + 1}... Use {nome}, {empresa} etc.`}
          value={item.text}
          onChange={(e) => onChange({ text: e.target.value })}
          className="h-20 text-sm"
        />

        {item.mediaBase64 ? (
          <div className="flex items-center gap-2 p-2 bg-wa-bg/50 rounded-lg border border-wa-border">
            {mediaIcons[item.mediaType]}
            <span className="text-xs text-wa-text flex-1 truncate">{item.mediaName}</span>
            <button onClick={() => onChange({ mediaBase64: null, mediaName: '', mediaType: 'none', caption: '' })}
              className="text-wa-muted hover:text-red-400 transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div {...getRootProps()} className={`border border-dashed rounded-lg p-2.5 text-center cursor-pointer transition-colors ${isDragActive ? 'border-wa-green bg-wa-green/10' : 'border-wa-border hover:border-wa-medium'}`}>
            <input {...getInputProps()} />
            <p className="text-[11px] text-wa-muted">Arraste mídia ou clique (imagem, vídeo, PDF)</p>
          </div>
        )}

        {item.mediaBase64 && (
          <Input placeholder="Legenda (opcional)" value={item.caption}
            onChange={(e) => onChange({ caption: e.target.value })} className="text-sm" />
        )}
      </div>
    </div>
  );
}

interface DisparoFormProps {
  initialNumbers?: string;
}

export function DisparoForm({ initialNumbers }: DisparoFormProps = {}) {
  const { activeSessionId, sessions, isBulkRunning: isBulkRunningMap, bulkProgress: bulkProgressMap, addBulkLog: addLog } = useApp();
  const { info: licenseInfo, recheck: recheckLicense } = useLicenseContext();
  const isBulkRunning = !!(activeSessionId && isBulkRunningMap[activeSessionId]);
  const fpRef = useRef<string>('');

  // Carrega fingerprint quando em trial (para reportar sends ao servidor)
  useEffect(() => {
    if (licenseInfo.isTrial && !fpRef.current) {
      getFingerprint().then(fp => { fpRef.current = fp; }).catch(() => {});
    }
  }, [licenseInfo.isTrial]);
  const bulkProgress = (activeSessionId && bulkProgressMap[activeSessionId]) || null;

  const [rawInput, setRawInput] = useState(initialNumbers ?? '');
  const [messages, setMessages] = useState<MessageItem[]>([newMessage()]);
  const [options, setOptions] = useState<DisparoOptions>(DEFAULT_DISPARO_OPTIONS);
  const [paused, setPaused] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showBlacklist, setShowBlacklist] = useState(false);
  const [countryCode, setCountryCode] = useState('55');
  const [showCCInput, setShowCCInput] = useState(false);

  const applyCountryCode = useCallback((code: string) => {
    const clean = code.replace(/\D/g, '');
    if (!clean) return;
    setRawInput((prev) => {
      const lines = prev.split(/\r?\n/);
      const updated = lines.map((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(clean)) return line;
        // Só aplica em linhas que parecem números (sem cabeçalho CSV)
        if (/^[\d\s\-\(\)]+$/.test(trimmed)) {
          return clean + trimmed.replace(/\D/g, '');
        }
        return line;
      });
      return updated.join('\n');
    });
    setShowCCInput(false);
  }, []);

  const activeSession = sessions.find((s) => s.id === activeSessionId);
  const isConnected = activeSession?.status === 'connected';

  const contacts = useCallback((): ContactRow[] => {
    let list = parseContacts(rawInput);
    if (options.skipDuplicates) {
      const seen = new Set<string>();
      list = list.filter((c) => { if (seen.has(c.number)) return false; seen.add(c.number); return true; });
    }
    if (options.randomizeOrder) list = list.sort(() => Math.random() - 0.5);
    return list;
  }, [rawInput, options.skipDuplicates, options.randomizeOrder]);

  const contactList = contacts();
  const firstContact = contactList[0];

  const onDropNumbers = useCallback(async (files: File[]) => {
    const file = files[0]; if (!file) return;
    const text = await readFileAsText(file);
    setRawInput(text);
    const parsed = parseContacts(text);
    const hasVars = parsed.some((c) => Object.keys(c.vars).length > 0);
    addLog('info', `Arquivo carregado: ${file.name} (${parsed.length} contatos${hasVars ? ', com variáveis' : ''})`);
  }, [addLog]);

  const { getRootProps: getNumRootProps, getInputProps: getNumInputProps, isDragActive: isNumDrag } = useDropzone({
    onDrop: onDropNumbers, accept: { 'text/plain': ['.txt'], 'text/csv': ['.csv'] }, multiple: false,
  });

  const updateMessage = (id: string, patch: Partial<MessageItem>) =>
    setMessages((prev) => prev.map((m) => m.id === id ? { ...m, ...patch } : m));

  const removeMessage = (id: string) =>
    setMessages((prev) => prev.filter((m) => m.id !== id));

  const handleStartBulk = async () => {
    if (!activeSessionId || !isConnected || contactList.length === 0) return;
    const hasContent = messages.some((m) => m.text.trim() || m.mediaBase64);
    if (!hasContent) { addLog('error', 'Informe ao menos uma mensagem ou mídia'); return; }

    // Trial: verifica limite de envios
    if (licenseInfo.isTrial) {
      const sendsLeft = licenseInfo.trialSendsLeft;
      if (sendsLeft <= 0) {
        addLog('error', 'Limite do trial atingido (50 envios). Ative uma licença para continuar.');
        Notify.trialEsgotado();
        return;
      }
      const toSend = Math.min(contactList.length, sendsLeft);
      if (toSend < contactList.length) {
        addLog('warn', `Trial: apenas ${toSend} de ${contactList.length} contatos serão enviados (limite restante).`);
      }
      if (sendsLeft <= 10) {
        Notify.trialQuaseEsgotado(sendsLeft);
      }
    }

    setPaused(false);
    addLog('info', `Iniciando disparo para ${contactList.length} contatos (${messages.length} msg(s) por contato)...`);

    try {
      const numbersToSend = licenseInfo.isTrial
        ? contactList.slice(0, licenseInfo.trialSendsLeft)
        : contactList;

      await api.bulkSend(activeSessionId, {
        numbers: numbersToSend,
        messages: messages.map(({ text, mediaBase64, mediaType, caption }) => ({
          text: text || undefined,
          media: mediaBase64 || undefined,
          mediaType: mediaType !== 'none' ? mediaType : undefined,
          caption: caption || undefined,
        })),
        options,
      });

      // Reporta sends ao servidor (fonte da verdade do trial)
      if (licenseInfo.isTrial && fpRef.current) {
        const newTotal = getCachedSends() + numbersToSend.length;
        setCachedSends(newTotal);
        licenseApi.trial.heartbeat(fpRef.current, numbersToSend.length)
          .then(() => recheckLicense()) // atualiza token com sendsUsed atualizado
          .catch(() => {}); // silencioso se offline
      }
    } catch (e) {
      addLog('error', `Erro: ${(e as Error).message}`);
    }
  };

  const handlePauseResume = async () => {
    if (!activeSessionId) return;
    if (paused) {
      await api.bulkResume(activeSessionId);
      setPaused(false);
      addLog('info', 'Disparo retomado');
    } else {
      await api.bulkPause(activeSessionId);
      setPaused(true);
      addLog('warn', 'Disparo pausado');
      Notify.disparoPausado();
    }
  };

  const handleExportReport = async () => {
    if (!activeSessionId) return;
    try {
      const { report } = await api.bulkReport(activeSessionId);
      if (!report.length) {
        // fallback to summary
        if (bulkProgress) {
          exportCSV([{
            enviados: bulkProgress.stats.sent,
            falhas: bulkProgress.stats.failed,
            total: bulkProgress.stats.total,
            data: new Date().toLocaleString('pt-BR'),
          }], `relatorio-${Date.now()}.csv`);
        }
        return;
      }
      exportCSV(report.map((r) => ({
        numero: r.number,
        status: r.status,
        erro: r.error || '',
        timestamp: r.ts,
      })), `relatorio-${Date.now()}.csv`);
    } catch {
      addLog('error', 'Erro ao exportar relatório');
    }
  };

  const progress = bulkProgress ? Math.round((bulkProgress.index / bulkProgress.total) * 100) : 0;
  const hasVars = contactList.some((c) => Object.keys(c.vars).length > 0);

  return (
    <div className="space-y-6">
      <DisparoPreview
        open={showPreview}
        onClose={() => setShowPreview(false)}
        messages={messages}
        contact={firstContact}
      />
      <DisparoBlacklist open={showBlacklist} onClose={() => setShowBlacklist(false)} />

      {!isConnected && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl text-yellow-400 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          Conecte uma sessão WhatsApp para disparar mensagens
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Números / CSV */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold" style={{ color: 'var(--color-textPrimary)' }}>Lista de Contatos</label>
            <div className="flex items-center gap-2">
              {showCCInput ? (
                <div className="flex items-center gap-1">
                  <span className="text-xs text-wa-text/70">+</span>
                  <input
                    type="text"
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value.replace(/\D/g, ''))}
                    onKeyDown={(e) => { if (e.key === 'Enter') applyCountryCode(countryCode); if (e.key === 'Escape') setShowCCInput(false); }}
                    className="w-14 text-xs bg-wa-border/30 border border-wa-border rounded-lg px-2 py-1 text-wa-text focus:outline-none focus:border-wa-green/50"
                    placeholder="55"
                    autoFocus
                    maxLength={4}
                  />
                  <button
                    onClick={() => applyCountryCode(countryCode)}
                    className="text-xs bg-wa-green/20 hover:bg-wa-green/30 text-wa-green px-2 py-1 rounded-lg transition-colors"
                  >
                    Aplicar
                  </button>
                  <button onClick={() => setShowCCInput(false)} className="text-xs text-wa-muted hover:text-wa-text transition-colors">✕</button>
                </div>
              ) : (
                <button
                  onClick={() => setShowCCInput(true)}
                  className="flex items-center gap-1 text-xs text-wa-muted hover:text-wa-green transition-colors"
                  title="Adicionar código de país aos números"
                >
                  <Phone className="w-3.5 h-3.5" />+DDI
                </button>
              )}
              <span className="text-xs text-wa-text/70">
                {contactList.length} contatos{hasVars ? ' · CSV com variáveis' : ''}
                {options.skipDuplicates ? ' (sem duplicatas)' : ''}
              </span>
            </div>
          </div>
          <div {...getNumRootProps()} className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${isNumDrag ? 'border-wa-green bg-wa-green/10' : 'border-wa-border hover:border-wa-medium'}`}>
            <input {...getNumInputProps()} />
            <Upload className="w-5 h-5 text-wa-muted mx-auto mb-1" />
            <p className="text-xs text-wa-text/70">Arraste TXT/CSV ou clique</p>
            <p className="text-[10px] text-wa-text/50 mt-0.5">CSV: colunas numero, nome, + variáveis extras</p>
          </div>
          <Textarea placeholder={"5511999999999\n5521888888888\n\nou CSV:\nnumero,nome,empresa\n5511999999999,João,Acme"} value={rawInput}
            onChange={(e) => setRawInput(e.target.value)} className="h-36 font-mono text-xs" />
          <button onClick={() => setRawInput('')} className="text-xs text-wa-muted hover:text-red-400 flex items-center gap-1 transition-colors">
            <Trash2 className="w-3 h-3" />Limpar lista
          </button>
        </div>

        {/* Sequência de mensagens */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold" style={{ color: 'var(--color-textPrimary)' }}>
              Sequência de Mensagens
              <span className="ml-2 text-xs text-wa-muted font-normal">({messages.length} msg{messages.length > 1 ? 's' : ''})</span>
            </label>
            <div className="flex items-center gap-2">
              {messages.length > 1 && (
                <div className="flex items-center gap-1 text-xs text-wa-muted">
                  <Clock className="w-3 h-3" />
                  <span>{options.interMessageDelay}ms</span>
                </div>
              )}
              <button
                onClick={() => setShowPreview(true)}
                className="flex items-center gap-1 text-xs text-wa-muted hover:text-wa-green transition-colors"
              >
                <Eye className="w-3.5 h-3.5" />Preview
              </button>
            </div>
          </div>

          <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
            <AnimatePresence initial={false}>
              {messages.map((msg, idx) => (
                <motion.div key={msg.id}
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                  transition={{ duration: 0.15 }}>
                  <MessageEditor
                    item={msg}
                    index={idx}
                    total={messages.length}
                    onChange={(patch) => updateMessage(msg.id, patch)}
                    onRemove={() => removeMessage(msg.id)}
                  />
                  {idx < messages.length - 1 && (
                    <div className="flex items-center gap-2 py-1 px-3">
                      <div className="flex-1 border-t border-dashed border-wa-border/50" />
                      <span className="text-[10px] text-wa-text/50 flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" />{options.interMessageDelay}ms
                      </span>
                      <div className="flex-1 border-t border-dashed border-wa-border/50" />
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          <Button variant="outline" size="sm" onClick={() => setMessages((p) => [...p, newMessage()])} className="w-full border-dashed">
            <Plus className="w-3.5 h-3.5" />Adicionar mensagem à sequência
          </Button>

          {contactList.length > 0 && (
            <p className="text-xs text-wa-text/70">
              Estimativa: ~{estimateTime(contactList.length, options.delayMin, options.delayMax)}
              {options.batchSize > 0 && ` • lotes de ${options.batchSize}`}
              {messages.length > 1 && ` • ${messages.length} msgs/contato`}
            </p>
          )}
        </div>
      </div>

      {/* Config avançada */}
      <DisparoConfig options={options} onChange={setOptions} />

      {/* Progresso */}
      <AnimatePresence>
        {(isBulkRunning || bulkProgress) && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-wa-text">
                {paused ? 'Pausado' : isBulkRunning ? 'Disparando...' : 'Concluído'}
                {bulkProgress && ` — ${bulkProgress.index}/${bulkProgress.total}`}
              </span>
              <span className="text-wa-green font-mono">{progress}%</span>
            </div>
            <Progress value={progress} />
            {bulkProgress && (
              <div className="flex gap-4 text-xs text-wa-muted">
                <span className="text-wa-green">✓ {bulkProgress.stats.sent} enviados</span>
                <span className="text-red-400">✗ {bulkProgress.stats.failed} falhas</span>
                <span className="truncate">Último: {bulkProgress.number}</span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Ações */}
      <div className="flex gap-2 flex-wrap">
        <Button onClick={handleStartBulk} disabled={!isConnected || isBulkRunning || contactList.length === 0} className="flex-1" size="lg">
          {isBulkRunning
            ? <><Square className="w-4 h-4" />Disparando...</>
            : <><Play className="w-4 h-4" />Iniciar Disparo ({contactList.length})</>}
        </Button>

        {isBulkRunning && (
          <Button variant="outline" size="lg" onClick={handlePauseResume}>
            <Pause className="w-4 h-4" />{paused ? 'Retomar' : 'Pausar'}
          </Button>
        )}

        <Button variant="outline" size="lg" onClick={() => setShowBlacklist(true)} title="Blacklist">
          <ShieldOff className="w-4 h-4" />
        </Button>

        <Button variant="outline" size="lg" onClick={handleExportReport} disabled={!bulkProgress && !activeSessionId} title="Exportar relatório CSV">
          <FileText className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
