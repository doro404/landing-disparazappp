"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Wifi, CheckCircle2, XCircle, Loader2,
  Eye, EyeOff, RefreshCw, Check,
  CreditCard, Mail, Globe, BarChart3, Key,
  Upload, FileDown, X,
} from "lucide-react";
import { AdminGuard } from "../components/AdminGuard";
import { AdminSidebar } from "../components/AdminSidebar";
import { Card, Button, Input, Label } from "../components/ui";
import { adminApi } from "@/lib/adminApi";

type PingStatus = "idle" | "loading" | "ok" | "error";

// ─── Tab definitions ──────────────────────────────────────────────────────────
const TABS = [
  { id: "geral",    label: "Geral" },
  { id: "stripe",   label: "Stripe" },
  { id: "email",    label: "E-mail" },
  { id: "app",      label: "App" },
  { id: "tracking", label: "Tracking" },
] as const;
type TabId = typeof TABS[number]["id"];

// ─── Env var definitions per tab ─────────────────────────────────────────────
const TAB_SECTIONS: Record<TabId, {
  title: string;
  desc: string;
  icon: React.ReactNode;
  vars: { key: string; label: string; placeholder: string; secret: boolean; hint?: string }[];
}[]> = {
  geral: [
    {
      title: "License Manager API",
      desc: "Conexão com o servidor de licenças. A URL e a chave são usadas em todas as operações do painel.",
      icon: <Key className="w-4 h-4" />,
      vars: [
        { key: "NEXT_PUBLIC_LICENSE_API_URL", label: "URL da API",            placeholder: "https://license-manager.discloud.app", secret: false },
        { key: "ADMIN_API_KEY",               label: "API Key",               placeholder: "sua-api-key",                           secret: true  },
        { key: "ADMIN_PASSWORD",              label: "Senha do Painel Admin", placeholder: "admin123",                              secret: true, hint: "Usada para login no /admin/login" },
      ],
    },
  ],
  stripe: [
    {
      title: "Chaves de API",
      desc: "Credenciais da sua conta Stripe. Use chaves live para produção e test para desenvolvimento.",
      icon: <CreditCard className="w-4 h-4" />,
      vars: [
        { key: "STRIPE_SECRET_KEY",     label: "Secret Key",     placeholder: "sk_live_...", secret: true  },
        { key: "STRIPE_WEBHOOK_SECRET", label: "Webhook Secret", placeholder: "whsec_...",   secret: true, hint: "Gerado no dashboard Stripe → Webhooks" },
      ],
    },
    {
      title: "Price IDs",
      desc: "IDs dos produtos criados no Stripe. Cada plano precisa de um Price ID correspondente.",
      icon: <CreditCard className="w-4 h-4" />,
      vars: [
        { key: "STRIPE_PRICE_ID_LIFETIME", label: "Price ID — Vitalício", placeholder: "price_...", secret: false },
        { key: "STRIPE_PRICE_ID_ANNUAL",   label: "Price ID — Anual",     placeholder: "price_...", secret: false },
      ],
    },
  ],
  email: [
    {
      title: "Resend",
      desc: "Serviço de envio de e-mails transacionais. A chave de licença é enviada automaticamente após a compra.",
      icon: <Mail className="w-4 h-4" />,
      vars: [
        { key: "RESEND_API_KEY", label: "API Key",   placeholder: "re_...",                                secret: true  },
        { key: "RESEND_FROM",    label: "Remetente", placeholder: "DisparaZapp <noreply@seudominio.com>",  secret: false, hint: "Domínio precisa estar verificado no Resend" },
      ],
    },
  ],  app: [
    {
      title: "URLs",
      desc: "URL pública do app. Usada para gerar links de download e referências no e-mail de licença.",
      icon: <Globe className="w-4 h-4" />,
      vars: [
        { key: "NEXT_PUBLIC_APP_URL", label: "URL do App",      placeholder: "https://seudominio.com",  secret: false },
        { key: "DOWNLOAD_SECRET",     label: "Download Secret", placeholder: "string-aleatoria-segura", secret: true, hint: "Usado para assinar URLs de download" },
      ],
    },
  ],
  tracking: [
    {
      title: "Analytics",
      desc: "IDs opcionais para rastreamento de visitas e conversões. Deixe em branco para desativar.",
      icon: <BarChart3 className="w-4 h-4" />,
      vars: [
        { key: "NEXT_PUBLIC_GA_ID",         label: "Google Analytics ID", placeholder: "G-XXXXXXXXXX", secret: false },
        { key: "NEXT_PUBLIC_META_PIXEL_ID", label: "Meta Pixel ID",       placeholder: "123456789",    secret: false },
      ],
    },
  ],
};

const ALL_KEYS = Object.values(TAB_SECTIONS).flatMap((sections) =>
  sections.flatMap((s) => s.vars.map((v) => v.key))
);

// ─── Field component ──────────────────────────────────────────────────────────
function EnvField({
  v, value, dirty, show, onChange, onToggleShow,
}: {
  v: { key: string; label: string; placeholder: string; secret: boolean; hint?: string };
  value: string;
  dirty: boolean;
  show: boolean;
  onChange: (val: string) => void;
  onToggleShow: () => void;
}) {
  return (
    <div>
      <Label htmlFor={v.key}>
        {v.label}
        {dirty && <span className="ml-2 text-[10px] text-yellow-400 font-normal">modificado</span>}
      </Label>
      <div className="relative">
        <Input
          id={v.key}
          type={v.secret && !show ? "password" : "text"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={v.placeholder}
          className={`${dirty ? "border-yellow-400/40 focus:border-yellow-400/60" : ""} ${v.secret ? "pr-9" : ""}`}
        />
        {v.secret && (
          <button
            type="button"
            onClick={onToggleShow}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
          >
            {show ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>
      <p className="text-[10px] text-white/20 mt-1 font-mono">{v.key}</p>
      {v.hint && <p className="text-[10px] text-white/30 mt-0.5">{v.hint}</p>}
    </div>
  );
}

// ─── Section row (left desc + right fields) ───────────────────────────────────
function SectionRow({
  section, values, dirty, show, onChange, onToggleShow,
}: {
  section: typeof TAB_SECTIONS["geral"][0];
  values: Record<string, string>;
  dirty: Record<string, boolean>;
  show: Record<string, boolean>;
  onChange: (key: string, val: string) => void;
  onToggleShow: (key: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8 py-8 border-b border-white/[0.06] last:border-0">
      {/* Left */}
      <div>
        <div className="flex items-center gap-2 text-white/60 mb-1">
          {section.icon}
          <h3 className="text-sm font-semibold text-white">{section.title}</h3>
        </div>
        <p className="text-xs text-white/40 leading-relaxed">{section.desc}</p>
      </div>

      {/* Right */}
      <div className="space-y-4">
        {section.vars.map((v) => (
          <EnvField
            key={v.key}
            v={v}
            value={values[v.key] ?? ""}
            dirty={!!dirty[v.key]}
            show={!!show[v.key]}
            onChange={(val) => onChange(v.key, val)}
            onToggleShow={() => onToggleShow(v.key)}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Test email card ──────────────────────────────────────────────────────────
function TestEmailCard({ apiKey }: { apiKey: string }) {
  const [to, setTo]         = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "ok" | "error">("idle");
  const [errMsg, setErrMsg] = useState("");

  async function send() {
    if (!to.includes("@")) return;
    setStatus("sending");
    setErrMsg("");
    try {
      const res = await fetch("/api/admin/test-email", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-key": apiKey },
        body: JSON.stringify({ to }),
      });
      const data = await res.json() as { success?: boolean; error?: string };
      if (!res.ok || !data.success) throw new Error(data.error ?? "Erro desconhecido");
      setStatus("ok");
      setTimeout(() => setStatus("idle"), 4000);
    } catch (e) {
      setErrMsg((e as Error).message);
      setStatus("error");
    }
  }

  return (
    <Card className="mt-6">
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8">
        <div>
          <div className="flex items-center gap-2 text-white/60 mb-1">
            <Mail className="w-4 h-4" />
            <h3 className="text-sm font-semibold text-white">Testar envio</h3>
          </div>
          <p className="text-xs text-white/40 leading-relaxed">
            Envia um e-mail de licença de teste com chave fictícia para verificar se o Resend está configurado corretamente.
          </p>
        </div>
        <div className="space-y-3">
          <div>
            <Label htmlFor="test-email-to">Destinatário</Label>
            <Input
              id="test-email-to"
              type="email"
              value={to}
              onChange={(e) => { setTo(e.target.value); setStatus("idle"); }}
              placeholder="seu@email.com"
              onKeyDown={(e) => e.key === "Enter" && send()}
            />
          </div>
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              onClick={send}
              disabled={status === "sending" || !to.includes("@")}
            >
              {status === "sending" ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Enviando…</>
              ) : (
                <><Mail className="w-3.5 h-3.5" /> Enviar teste</>
              )}
            </Button>
            {status === "ok" && (
              <span className="flex items-center gap-1.5 text-xs text-[#25D366]">
                <Check className="w-3.5 h-3.5" /> E-mail enviado com sucesso
              </span>
            )}
            {status === "error" && (
              <span className="text-xs text-red-400">{errMsg}</span>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

// ─── Exe upload card ──────────────────────────────────────────────────────────
function ExeUploadCard({ appUrl }: { appUrl: string }) {
  const [status, setStatus]     = useState<"idle" | "uploading" | "ok" | "error">("idle");
  const [progress, setProgress] = useState(0);
  const [errMsg, setErrMsg]     = useState("");
  const [fileInfo, setFileInfo] = useState<{ name: string; size: number; url: string } | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function formatBytes(b: number) {
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  }

  async function upload(file: File) {
    if (!file.name.endsWith(".exe")) {
      setErrMsg("Apenas arquivos .exe são permitidos.");
      setStatus("error");
      return;
    }
    setStatus("uploading");
    setProgress(0);
    setErrMsg("");

    const form = new FormData();
    form.append("file", file);

    // Use XHR for progress tracking
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/admin/upload-exe");
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        try {
          const data = JSON.parse(xhr.responseText) as { success?: boolean; url?: string; name?: string; size?: number; error?: string };
          if (xhr.status >= 200 && xhr.status < 300 && data.success) {
            setFileInfo({ name: data.name ?? file.name, size: data.size ?? file.size, url: data.url ?? "" });
            setStatus("ok");
            resolve();
          } else {
            reject(new Error(data.error ?? "Erro no upload"));
          }
        } catch {
          reject(new Error("Resposta inválida"));
        }
      };
      xhr.onerror = () => reject(new Error("Falha na conexão"));
      xhr.send(form);
    }).catch((e: Error) => {
      setErrMsg(e.message);
      setStatus("error");
    });
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) upload(file);
  }

  return (
    <Card className="mt-6">
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8">
        <div>
          <div className="flex items-center gap-2 text-white/60 mb-1">
            <FileDown className="w-4 h-4" />
            <h3 className="text-sm font-semibold text-white">Arquivo de instalação</h3>
          </div>
          <p className="text-xs text-white/40 leading-relaxed">
            Faça upload do instalador <code className="text-white/30">.exe</code> do DisparaZapp. O link de download será atualizado automaticamente no e-mail de licença.
          </p>
        </div>

        <div className="space-y-3">
          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => inputRef.current?.click()}
            className={`relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed cursor-pointer transition-colors py-8 px-4
              ${dragging ? "border-[#25D366]/60 bg-[#25D366]/5" : "border-white/10 hover:border-white/20 bg-white/[0.02]"}`}
          >
            <Upload className={`w-6 h-6 ${dragging ? "text-[#25D366]" : "text-white/30"}`} />
            <p className="text-sm text-white/50">
              {dragging ? "Solte o arquivo aqui" : "Arraste o .exe ou clique para selecionar"}
            </p>
            <input
              ref={inputRef}
              type="file"
              accept=".exe"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }}
            />
          </div>

          {/* Progress bar */}
          {status === "uploading" && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-white/40">
                <span>Enviando…</span>
                <span>{progress}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                <motion.div
                  className="h-full bg-[#25D366] rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ ease: "linear" }}
                />
              </div>
            </div>
          )}

          {/* Success state */}
          {status === "ok" && fileInfo && (
            <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-[#25D366]/10 border border-[#25D366]/20">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-[#25D366] shrink-0" />
                <div>
                  <p className="text-xs font-medium text-white">{fileInfo.name}</p>
                  <p className="text-[10px] text-white/40">{formatBytes(fileInfo.size)}</p>
                </div>
              </div>
              <a
                href={fileInfo.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-[#25D366] hover:underline"
              >
                Ver link
              </a>
            </div>
          )}

          {/* Error */}
          {status === "error" && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-400/10 border border-red-400/20">
              <X className="w-3.5 h-3.5 text-red-400 shrink-0" />
              <p className="text-xs text-red-400">{errMsg}</p>
            </div>
          )}

          {/* Current URL hint */}
          {appUrl && status === "idle" && (
            <p className="text-[10px] text-white/20">
              URL atual: <span className="text-white/30 font-mono">{appUrl}/downloads/DisparaZapp-Setup.exe</span>
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>("geral");
  const [values, setValues]       = useState<Record<string, string>>({});
  const [dirty, setDirty]         = useState<Record<string, boolean>>({});
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);
  const [loadError, setLoadError] = useState("");
  const [show, setShow]           = useState<Record<string, boolean>>({});
  const [pingStatus, setPingStatus] = useState<PingStatus>("idle");
  const [pingCode, setPingCode]     = useState<number | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch("/api/admin/env")
      .then((r) => r.json())
      .then((data: { values: Record<string, string> }) => {
        const filtered: Record<string, string> = {};
        for (const key of ALL_KEYS) filtered[key] = data.values[key] ?? "";
        setValues(filtered);
      })
      .catch(() => setLoadError("Não foi possível carregar as configurações."));
  }, []);

  const saveUpdates = useCallback(async (updates: Record<string, string>) => {
    setSaving(true);
    try {
      await fetch("/api/admin/env", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });
      setDirty({});
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // silently fail — user can see dirty indicators
    } finally {
      setSaving(false);
    }
  }, []);

  function handleChange(key: string, val: string) {
    const newValues = { ...values, [key]: val };
    const newDirty  = { ...dirty, [key]: true };
    setValues(newValues);
    setDirty(newDirty);
    setSaved(false);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const updates: Record<string, string> = {};
      for (const k of Object.keys(newDirty)) {
        if (newDirty[k]) updates[k] = newValues[k] ?? "";
      }
      saveUpdates(updates);
    }, 800);
  }

  function handleToggleShow(key: string) {
    setShow((s) => ({ ...s, [key]: !s[key] }));
  }

  const handlePing = async () => {
    setPingStatus("loading");
    try {
      const res = await adminApi.ping();
      setPingCode(res.status);
      setPingStatus(res.ok ? "ok" : "error");
    } catch {
      setPingStatus("error");
      setPingCode(null);
    }
  };

  const sections = TAB_SECTIONS[activeTab];

  return (
    <AdminGuard>
      <div className="flex min-h-screen bg-[#050505] text-white">
        <AdminSidebar />
        <main className="ml-56 flex-1 p-8">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>

            {/* Header */}
            <div className="flex items-start justify-between mb-6">
              <div>
                <h1 className="text-2xl font-black text-white mb-1">Configurações</h1>
                <p className="text-sm text-white/40">Gerencie as variáveis de ambiente e integrações.</p>
              </div>
              <div className="flex items-center gap-2 text-xs text-white/30 mt-1">
                {saving && <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Salvando…</>}
                {saved  && <><Check className="w-3.5 h-3.5 text-[#25D366]" /> <span className="text-[#25D366]">Salvo</span></>}
              </div>
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 mb-8 border-b border-white/[0.06]">
              {TABS.map((tab) => {
                const tabDirty = TAB_SECTIONS[tab.id].some((s) =>
                  s.vars.some((v) => dirty[v.key])
                );
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`relative px-4 py-2.5 text-sm font-medium transition-colors ${
                      activeTab === tab.id
                        ? "text-white"
                        : "text-white/40 hover:text-white/70"
                    }`}
                  >
                    {tab.label}
                    {tabDirty && (
                      <span className="absolute top-2 right-1.5 w-1.5 h-1.5 rounded-full bg-yellow-400" />
                    )}
                    {activeTab === tab.id && (
                      <motion.div
                        layoutId="tab-indicator"
                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#25D366] rounded-full"
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Alerts */}
            {loadError && (
              <div className="mb-5 px-4 py-3 rounded-xl bg-red-400/10 border border-red-400/20 text-sm text-red-400">
                {loadError}
              </div>
            )}
            {saved && (
              <div className="mb-5 px-4 py-3 rounded-xl bg-[#25D366]/10 border border-[#25D366]/20 text-sm text-[#25D366]">
                Salvo. Reinicie o servidor Next.js para aplicar as mudanças.
              </div>
            )}
            <div className="max-w-4xl space-y-6">
              {/* Connection status card — only on Geral tab */}
              {activeTab === "geral" && (
                <Card>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {pingStatus === "idle"    && <Wifi className="w-4 h-4 text-white/30" />}
                      {pingStatus === "loading" && <Loader2 className="w-4 h-4 text-white/50 animate-spin" />}
                      {pingStatus === "ok"      && <CheckCircle2 className="w-4 h-4 text-[#25D366]" />}
                      {pingStatus === "error"   && <XCircle className="w-4 h-4 text-red-400" />}
                      <div>
                        <p className="text-sm font-semibold text-white">Status da API</p>
                        <p className={`text-xs mt-0.5 ${
                          pingStatus === "ok" ? "text-[#25D366]"
                          : pingStatus === "error" ? "text-red-400"
                          : "text-white/40"
                        }`}>
                          {pingStatus === "idle"    && "Não testado"}
                          {pingStatus === "loading" && "Testando…"}
                          {pingStatus === "ok"      && `Conectado${pingCode ? ` (HTTP ${pingCode})` : ""}`}
                          {pingStatus === "error"   && `Falha na conexão${pingCode ? ` (HTTP ${pingCode})` : ""}`}
                        </p>
                      </div>
                    </div>
                    <Button size="sm" variant="outline" onClick={handlePing} disabled={pingStatus === "loading"}>
                      <RefreshCw className={`w-3.5 h-3.5 ${pingStatus === "loading" ? "animate-spin" : ""}`} />
                      Testar Conexão
                    </Button>
                  </div>
                </Card>
              )}

              {/* Sections */}
              <Card className="p-0 overflow-hidden">
                <div className="px-6">
                  {sections.map((section) => (
                    <SectionRow
                      key={section.title}
                      section={section}
                      values={values}
                      dirty={dirty}
                      show={show}
                      onChange={handleChange}
                      onToggleShow={handleToggleShow}
                    />
                  ))}
                </div>
              </Card>

              {activeTab === "email" && (
                <TestEmailCard apiKey={values["ADMIN_API_KEY"] ?? ""} />
              )}

              {activeTab === "app" && (
                <ExeUploadCard appUrl={values["NEXT_PUBLIC_APP_URL"] ?? ""} />
              )}

              <p className="text-xs text-white/20 text-center pb-4">
                Após salvar, reinicie o servidor com <code className="text-white/30">npm run dev</code> para aplicar as mudanças.
              </p>
            </div>
          </motion.div>
        </main>
      </div>
    </AdminGuard>
  );
}
