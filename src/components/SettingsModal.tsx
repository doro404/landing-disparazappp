import { useState, useEffect } from 'react';
import type React from 'react';
import { Settings, Shield, Bot, Sliders, KeyRound, CheckCircle2, Clock, XCircle, BadgeCheck, Trash2, AlertTriangle, Power } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Switch } from './ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Textarea } from './ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import { useApp } from '@/context/AppContext';
import { useLicenseContext } from '@/context/LicenseContext';
import { api } from '@/lib/api';
import { AppSettings } from '@/types';
import { invoke } from '@tauri-apps/api/core';

// ─── License info panel ───────────────────────────────────────────────────────

function LicenseInfo({ info, onLogout }: { info: ReturnType<typeof useLicenseContext>['info']; onLogout: () => void }) {
  const statusMap: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    valid:        { label: 'Ativa',           color: 'text-green-400',  icon: <CheckCircle2 className="w-4 h-4" /> },
    grace_period: { label: 'Período de graça',color: 'text-yellow-400', icon: <Clock className="w-4 h-4" /> },
    offline_grace:{ label: 'Offline (cache)', color: 'text-wa-muted',  icon: <Clock className="w-4 h-4" /> },
    expired:      { label: 'Expirada',        color: 'text-orange-400', icon: <XCircle className="w-4 h-4" /> },
    revoked:      { label: 'Revogada',        color: 'text-red-400',    icon: <XCircle className="w-4 h-4" /> },
    invalid:      { label: 'Inválida',        color: 'text-red-400',    icon: <XCircle className="w-4 h-4" /> },
  };

  const s = statusMap[info.status] ?? statusMap.invalid;

  const expiryLabel = info.expiresAt
    ? new Date(info.expiresAt * 1000).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
    : 'Sem expiração';

  const daysLabel = info.daysUntilExpiry !== null
    ? info.daysUntilExpiry > 0
      ? `${info.daysUntilExpiry} dias restantes`
      : `Expirou há ${Math.abs(info.daysUntilExpiry)} dias`
    : null;

  const isPro = info.entitlements.includes('pro');

  return (
    <div className="space-y-3">
      {/* Status */}
      <div className="flex items-center justify-between p-3 bg-wa-border/20 rounded-xl">
        <span className="text-xs text-wa-text/70">Status</span>
        <span className={`flex items-center gap-1.5 text-sm font-medium ${s.color}`}>
          {s.icon}{s.label}
        </span>
      </div>

      {/* Plano */}
      <div className="flex items-center justify-between p-3 bg-wa-border/20 rounded-xl">
        <span className="text-xs text-wa-text/70">Plano</span>
        <span className={`flex items-center gap-1.5 text-sm font-medium ${isPro ? 'text-wa-green' : 'text-wa-muted'}`}>
          {isPro && <BadgeCheck className="w-4 h-4" />}
          {isPro ? 'PRO' : 'Básico'}
        </span>
      </div>

      {/* Chave */}
      {info.key && (
        <div className="flex items-center justify-between p-3 bg-wa-border/20 rounded-xl">
          <span className="text-xs text-wa-text/70">Chave</span>
          <span className="text-xs font-mono text-wa-text tracking-widest">{info.key}</span>
        </div>
      )}

      {/* Expiração */}
      <div className="flex items-center justify-between p-3 bg-wa-border/20 rounded-xl">
        <span className="text-xs text-wa-text/70">Expiração</span>
        <div className="text-right">
          <p className="text-sm text-wa-text">{expiryLabel}</p>
          {daysLabel && (
            <p className={`text-xs ${info.daysUntilExpiry !== null && info.daysUntilExpiry < 7 ? 'text-orange-400' : 'text-wa-muted'}`}>
              {daysLabel}
            </p>
          )}
        </div>
      </div>

      {/* Entitlements */}
      {info.entitlements.length > 0 && (
        <div className="p-3 bg-wa-border/20 rounded-xl space-y-2">
          <span className="text-xs text-wa-text/70">Recursos incluídos</span>
          <div className="flex flex-wrap gap-1.5 mt-1">
            {info.entitlements.map(e => (
              <span key={e} className="px-2 py-0.5 rounded-full bg-wa-green/15 text-wa-green text-xs font-medium border border-wa-green/20">
                {e}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Logout */}
      <button
        onClick={onLogout}
        className="w-full py-2.5 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 text-sm font-medium transition-all focus:outline-none focus:ring-2 focus:ring-red-500/20"
      >
        Desativar licença neste dispositivo
      </button>
    </div>
  );
}interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const { settings, setSettings, activeSessionId, addLog } = useApp();
  const { info, logout } = useLicenseContext();
  const [local, setLocal] = useState<AppSettings>({ ...settings });
  const [clearConfirm, setClearConfirm] = useState(false);
  const [clearing, setClearing] = useState(false);

  // Sincroniza estado real do autostart ao abrir
  useEffect(() => {
    if (open) {
      invoke<boolean>('get_autostart').then((enabled) => {
        setLocal((prev) => ({ ...prev, autostart: enabled }));
      }).catch(() => {});
    }
  }, [open]);

  const handleSave = async () => {
    setSettings(local);
    // Aplica autostart
    invoke('set_autostart', { enabled: local.autostart }).catch(() => {});
    // Aplica auto-reply se configurado
    if (activeSessionId && local.aiProvider !== 'none') {
      try {
        await api.autoReply(activeSessionId, {
          enabled: true,
          provider: local.aiProvider,
          apiKey: local.aiApiKey,
          model: local.aiModel,
          systemPrompt: local.aiSystemPrompt,
        });
        addLog('success', 'Configurações de IA aplicadas');
      } catch (e) {
        addLog('error', `Erro ao aplicar IA: ${(e as Error).message}`);
      }
    }
    onClose();
  };

  const handleClearData = async () => {
    if (!activeSessionId) return;
    setClearing(true);
    try {
      await api.sessions.clearData(activeSessionId);
      addLog('success', `Dados da sessão ${activeSessionId} limpos`);
      setClearConfirm(false);
      onClose();
    } catch (e) {
      addLog('error', `Erro ao limpar sessão: ${(e as Error).message}`);
    } finally {
      setClearing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-wa-green" />
            Configurações
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="disparo">
          <TabsList className="w-full">
            <TabsTrigger value="disparo" className="flex-1">
              <Sliders className="w-3.5 h-3.5 mr-1" />Disparo
            </TabsTrigger>
            <TabsTrigger value="antiban" className="flex-1">
              <Shield className="w-3.5 h-3.5 mr-1" />Anti-ban
            </TabsTrigger>
            <TabsTrigger value="licenca" className="flex-1">
              <KeyRound className="w-3.5 h-3.5 mr-1" />Licença
            </TabsTrigger>
            <TabsTrigger value="sessao" className="flex-1">
              <Trash2 className="w-3.5 h-3.5 mr-1" />Sessão
            </TabsTrigger>
          </TabsList>

          <TabsContent value="disparo" className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-wa-text/70">Delay mínimo (ms)</label>
                <Input
                  type="number"
                  value={local.delayMin}
                  onChange={(e) => setLocal({ ...local, delayMin: +e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-wa-text/70">Delay máximo (ms)</label>
                <Input
                  type="number"
                  value={local.delayMax}
                  onChange={(e) => setLocal({ ...local, delayMax: +e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-wa-text/70">Limite por hora</label>
                <Input
                  type="number"
                  value={local.limitPerHour}
                  onChange={(e) => setLocal({ ...local, limitPerHour: +e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-wa-text/70">Limite diário</label>
                <Input
                  type="number"
                  value={local.limitPerDay}
                  onChange={(e) => setLocal({ ...local, limitPerDay: +e.target.value })}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="antiban" className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-wa-border/20 rounded-xl">
              <div>
                <p className="text-sm text-wa-text flex items-center gap-2">
                  <Power className="w-3.5 h-3.5 text-wa-green" />
                  Iniciar com o Windows
                </p>
                <p className="text-xs text-wa-text/70">Inicia automaticamente em segundo plano ao ligar o PC</p>
              </div>
              <Switch
                checked={local.autostart}
                onCheckedChange={(v) => setLocal({ ...local, autostart: v })}
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-wa-border/20 rounded-xl">
              <div>
                <p className="text-sm text-wa-text">Proxy HTTP/SOCKS5</p>
                <p className="text-xs text-wa-text/70">Rotear tráfego via proxy</p>
              </div>
              <Switch
                checked={local.proxyEnabled}
                onCheckedChange={(v) => setLocal({ ...local, proxyEnabled: v })}
              />
            </div>
            {local.proxyEnabled && (
              <div className="space-y-1">
                <label className="text-xs text-wa-text/70">URL do Proxy</label>
                <Input
                  placeholder="socks5://user:pass@host:port"
                  value={local.proxyUrl}
                  onChange={(e) => setLocal({ ...local, proxyUrl: e.target.value })}
                />
              </div>
            )}
            <div className="p-3 bg-wa-green/10 border border-wa-green/20 rounded-xl text-xs text-wa-muted space-y-1">
              <p className="text-wa-green font-medium">Anti-ban PRO ativo:</p>
              <p>• Delay aleatório inteligente (1.2s–3.5s)</p>
              <p>• Limite por hora configurável</p>
              <p>• Simulação de digitação automática</p>
              <p>• Browser fingerprint realista</p>
            </div>
          </TabsContent>

          <TabsContent value="ia" className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs text-wa-text/70">Provedor de IA</label>
              <Select
                value={local.aiProvider}
                onValueChange={(v) => {
                  const provider = v as typeof local.aiProvider;
                  const defaultModels: Record<string, string> = {
                    openai: 'gpt-4o-mini',
                    anthropic: 'claude-3-5-haiku-20241022',
                    groq: 'llama-3.1-8b-instant',
                    grok: 'grok-beta',
                    ollama: 'llama3',
                    none: '',
                  };
                  setLocal({ ...local, aiProvider: provider, aiModel: defaultModels[provider] ?? local.aiModel });
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Desativado</SelectItem>
                  <SelectItem value="openai">OpenAI (GPT)</SelectItem>
                  <SelectItem value="anthropic">Anthropic (Claude)</SelectItem>
                  <SelectItem value="groq">Groq (Llama / Mixtral)</SelectItem>
                  <SelectItem value="ollama">Ollama (local)</SelectItem>
                  <SelectItem value="grok">Grok (xAI)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {local.aiProvider !== 'none' && (
              <>
                {local.aiProvider !== 'ollama' && (
                  <div className="space-y-1">
                    <label className="text-xs text-wa-text/70">
                      API Key
                      {local.aiProvider === 'openai' && <span className="text-wa-muted ml-1">— sk-...</span>}
                      {local.aiProvider === 'anthropic' && <span className="text-wa-muted ml-1">— sk-ant-...</span>}
                      {local.aiProvider === 'groq' && <span className="text-wa-muted ml-1">— gsk_...</span>}
                      {local.aiProvider === 'grok' && <span className="text-wa-muted ml-1">— xai-...</span>}
                    </label>
                    <Input
                      type="password"
                      placeholder="Cole sua chave de API aqui"
                      value={local.aiApiKey}
                      onChange={(e) => setLocal({ ...local, aiApiKey: e.target.value })}
                    />
                  </div>
                )}
                <div className="space-y-1">
                  <label className="text-xs text-wa-text/70">Modelo</label>
                  <Input
                    placeholder={
                      local.aiProvider === 'openai' ? 'gpt-4o-mini' :
                      local.aiProvider === 'anthropic' ? 'claude-3-5-sonnet-20241022' :
                      local.aiProvider === 'groq' ? 'llama-3.1-70b-versatile' :
                      local.aiProvider === 'grok' ? 'grok-beta' :
                      'llama3'
                    }
                    value={local.aiModel}
                    onChange={(e) => setLocal({ ...local, aiModel: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-wa-text/70">Prompt do sistema (Auto-Resposta)</label>
                  <Textarea
                    placeholder="Você é um assistente prestativo..."
                    value={local.aiSystemPrompt}
                    onChange={(e) => setLocal({ ...local, aiSystemPrompt: e.target.value })}
                    className="h-20"
                  />
                </div>
                <p className="text-[11px] text-wa-muted bg-wa-border/10 rounded-lg p-2.5">
                  O prompt e modelo do módulo <span className="text-violet-400">IA Atendimento</span> são configurados separadamente dentro do próprio módulo, na aba Configurações → Prompts.
                </p>
              </>
            )}
          </TabsContent>

          <TabsContent value="licenca" className="space-y-3">
            <LicenseInfo info={info} onLogout={async () => { await logout(); onClose(); }} />
          </TabsContent>

          <TabsContent value="sessao" className="space-y-4">
            <div className="p-3 bg-wa-border/20 rounded-xl space-y-1">
              <p className="text-sm text-wa-text">Sessão ativa</p>
              <p className="text-xs text-wa-muted font-mono">{activeSessionId ?? '—'}</p>
            </div>

            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm text-red-400 font-medium">Limpar dados de conexão</p>
                  <p className="text-xs text-wa-muted mt-0.5">
                    Remove todos os arquivos de sessão (chaves, credenciais). O WhatsApp precisará ser reconectado via QR code.
                  </p>
                </div>
              </div>

              {!clearConfirm ? (
                <button
                  onClick={() => setClearConfirm(true)}
                  disabled={!activeSessionId}
                  className="w-full py-2 rounded-lg border border-red-500/40 text-red-400 hover:bg-red-500/15 text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Limpar dados da sessão
                </button>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-red-300 text-center">Tem certeza? Esta ação não pode ser desfeita.</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setClearConfirm(false)}
                      className="flex-1 py-2 rounded-lg border border-wa-border text-wa-muted hover:bg-wa-border/20 text-sm transition-all"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={handleClearData}
                      disabled={clearing}
                      className="flex-1 py-2 rounded-lg bg-red-500/20 border border-red-500/40 text-red-400 hover:bg-red-500/30 text-sm font-medium transition-all disabled:opacity-60"
                    >
                      {clearing ? 'Limpando...' : 'Confirmar'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex gap-3 mt-2">
          <Button variant="outline" onClick={onClose} className="flex-1">Cancelar</Button>
          <Button onClick={handleSave} className="flex-1">Salvar Configurações</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
