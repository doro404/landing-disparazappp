"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mail, RefreshCw, CheckCircle2, XCircle, Clock,
  AlertCircle, ExternalLink, X, ChevronRight, Loader2,
} from "lucide-react";
import { AdminGuard } from "../components/AdminGuard";
import { AdminSidebar } from "../components/AdminSidebar";
import { Card, Button } from "../components/ui";

// ─── Types ────────────────────────────────────────────────────────────────────
interface ResendEmail {
  id: string;
  from: string;
  to: string[];
  subject: string;
  created_at: string;
  last_event: string;
}

interface ResendEmailDetail extends ResendEmail {
  html?: string;
  text?: string;
  cc?: string[];
  bcc?: string[];
  reply_to?: string[];
  headers?: Record<string, string>[];
}

// ─── Event badge ──────────────────────────────────────────────────────────────
const EVENT_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  delivered:        { label: "Entregue", color: "text-[#25D366] bg-[#25D366]/10 border-[#25D366]/20",   icon: <CheckCircle2 className="w-3 h-3" /> },
  sent:             { label: "Enviado",  color: "text-blue-400 bg-blue-400/10 border-blue-400/20",       icon: <Mail className="w-3 h-3" /> },
  opened:           { label: "Aberto",   color: "text-purple-400 bg-purple-400/10 border-purple-400/20", icon: <Mail className="w-3 h-3" /> },
  clicked:          { label: "Clicado",  color: "text-indigo-400 bg-indigo-400/10 border-indigo-400/20", icon: <ExternalLink className="w-3 h-3" /> },
  bounced:          { label: "Bounce",   color: "text-red-400 bg-red-400/10 border-red-400/20",          icon: <XCircle className="w-3 h-3" /> },
  complained:       { label: "Spam",     color: "text-orange-400 bg-orange-400/10 border-orange-400/20", icon: <AlertCircle className="w-3 h-3" /> },
  delivery_delayed: { label: "Atrasado", color: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20", icon: <Clock className="w-3 h-3" /> },
};

function EventBadge({ event }: { event: string }) {
  const cfg = EVENT_CONFIG[event] ?? { label: event, color: "text-white/40 bg-white/5 border-white/10", icon: <Mail className="w-3 h-3" /> };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cfg.color}`}>
      {cfg.icon}{cfg.label}
    </span>
  );
}

// ─── Detail drawer ────────────────────────────────────────────────────────────
function EmailDrawer({ emailId, onClose }: { emailId: string; onClose: () => void }) {
  const [detail, setDetail]   = useState<ResendEmailDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]         = useState<"preview" | "text" | "meta">("preview");

  useEffect(() => {
    setLoading(true);
    setDetail(null);
    fetch(`/api/admin/emails/${emailId}`)
      .then((r) => r.json())
      .then((d: { success?: boolean; data?: ResendEmailDetail }) => {
        if (d.success && d.data) setDetail(d.data);
      })
      .finally(() => setLoading(false));
  }, [emailId]);

  // Close on Escape
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [onClose]);

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
      />

      {/* Drawer */}
      <motion.aside
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 280 }}
        className="fixed right-0 top-0 h-screen w-full max-w-2xl bg-[#0d0d0d] border-l border-white/8 z-50 flex flex-col"
      >
        {/* Drawer header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-white/[0.06] flex-shrink-0">
          <div className="flex-1 min-w-0 pr-4">
            {detail ? (
              <>
                <p className="text-sm font-semibold text-white truncate">{detail.subject}</p>
                <p className="text-xs text-white/40 mt-0.5 truncate">Para: {detail.to.join(", ")}</p>
              </>
            ) : (
              <div className="space-y-1.5">
                <div className="h-4 w-48 bg-white/5 rounded animate-pulse" />
                <div className="h-3 w-32 bg-white/5 rounded animate-pulse" />
              </div>
            )}
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white transition-colors flex-shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Meta strip */}
        {detail && (
          <div className="flex items-center gap-4 px-6 py-3 border-b border-white/[0.06] bg-white/[0.02] flex-shrink-0 flex-wrap">
            <EventBadge event={detail.last_event} />
            <span className="text-xs text-white/30">De: <span className="text-white/50">{detail.from}</span></span>
            <span className="text-xs text-white/30">
              {new Date(detail.created_at).toLocaleString("pt-BR", {
                day: "2-digit", month: "2-digit", year: "numeric",
                hour: "2-digit", minute: "2-digit",
              })}
            </span>
            <span className="text-[10px] text-white/20 font-mono ml-auto">{detail.id}</span>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 px-6 pt-4 border-b border-white/[0.06] flex-shrink-0">
          {(["preview", "text", "meta"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-2 text-xs font-medium transition-colors relative ${
                tab === t ? "text-white" : "text-white/40 hover:text-white/70"
              }`}
            >
              {{ preview: "Preview HTML", text: "Texto", meta: "Metadados" }[t]}
              {tab === t && (
                <motion.div layoutId="drawer-tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#25D366] rounded-full" />
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-full text-white/30 gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Carregando…
            </div>
          ) : !detail ? (
            <div className="flex items-center justify-center h-full text-white/20 text-sm">
              Não foi possível carregar o e-mail.
            </div>
          ) : (
            <>
              {tab === "preview" && (
                detail.html ? (
                  <iframe
                    srcDoc={detail.html}
                    className="w-full h-full border-0"
                    sandbox="allow-same-origin"
                    title="Email preview"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-white/20 text-sm">
                    Sem conteúdo HTML disponível.
                  </div>
                )
              )}

              {tab === "text" && (
                <div className="p-6">
                  {detail.text ? (
                    <pre className="text-xs text-white/60 whitespace-pre-wrap font-mono leading-relaxed">{detail.text}</pre>
                  ) : (
                    <p className="text-white/20 text-sm">Sem versão em texto.</p>
                  )}
                </div>
              )}

              {tab === "meta" && (
                <div className="p-6 space-y-4">
                  {[
                    { label: "ID",         value: detail.id },
                    { label: "De",         value: detail.from },
                    { label: "Para",       value: detail.to.join(", ") },
                    { label: "Assunto",    value: detail.subject },
                    { label: "Status",     value: detail.last_event },
                    { label: "Enviado em", value: new Date(detail.created_at).toLocaleString("pt-BR") },
                    ...(detail.cc?.length ? [{ label: "CC", value: detail.cc.join(", ") }] : []),
                    ...(detail.bcc?.length ? [{ label: "BCC", value: detail.bcc.join(", ") }] : []),
                    ...(detail.reply_to?.length ? [{ label: "Reply-To", value: detail.reply_to.join(", ") }] : []),
                  ].map(({ label, value }) => (
                    <div key={label} className="flex gap-4 py-3 border-b border-white/[0.05] last:border-0">
                      <span className="text-xs text-white/30 w-24 flex-shrink-0 pt-0.5">{label}</span>
                      <span className="text-xs text-white/70 font-mono break-all">{value}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </motion.aside>
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function EmailsPage() {
  const [emails, setEmails]       = useState<ResendEmail[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");
  const [search, setSearch]       = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/emails");
      const data = await res.json() as { success?: boolean; data?: ResendEmail[]; error?: string };
      if (!res.ok || !data.success) throw new Error(data.error ?? `HTTP ${res.status}`);
      setEmails(data.data ?? []);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = emails.filter((e) => {
    const q = search.toLowerCase();
    return (
      e.subject.toLowerCase().includes(q) ||
      e.to.join(",").toLowerCase().includes(q) ||
      e.from.toLowerCase().includes(q)
    );
  });

  const stats = {
    total:     emails.length,
    delivered: emails.filter((e) => ["delivered","opened","clicked"].includes(e.last_event)).length,
    opened:    emails.filter((e) => ["opened","clicked"].includes(e.last_event)).length,
    bounced:   emails.filter((e) => e.last_event === "bounced").length,
  };

  return (
    <AdminGuard>
      <div className="flex min-h-screen bg-[#050505] text-white">
        <AdminSidebar />
        <main className="ml-56 flex-1 p-8">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>

            {/* Header */}
            <div className="flex items-start justify-between mb-6">
              <div>
                <h1 className="text-2xl font-black text-white mb-1">E-mails Enviados</h1>
                <p className="text-sm text-white/40">Histórico via Resend API — últimos 50 envios</p>
              </div>
              <Button variant="outline" size="sm" onClick={load} disabled={loading}>
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                Atualizar
              </Button>
            </div>

            {/* Stats */}
            {!loading && emails.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                {[
                  { label: "Total",     value: stats.total,     color: "text-white" },
                  { label: "Entregues", value: stats.delivered, color: "text-[#25D366]" },
                  { label: "Abertos",   value: stats.opened,    color: "text-purple-400" },
                  { label: "Bounces",   value: stats.bounced,   color: "text-red-400" },
                ].map((s, i) => (
                  <motion.div key={s.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
                    <Card className="text-center py-4">
                      <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
                      <p className="text-[11px] text-white/30 mt-1">{s.label}</p>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}

            {/* Search */}
            <div className="mb-4">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por destinatário, assunto…"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[#25D366]/40 transition-colors"
              />
            </div>

            {/* Error */}
            {error === "restricted_api_key" ? (
              <div className="mb-4 px-5 py-4 rounded-xl bg-yellow-400/8 border border-yellow-400/20 text-sm">
                <p className="font-semibold text-yellow-400 mb-1">API Key com permissão restrita</p>
                <p className="text-white/50 text-xs leading-relaxed">
                  Sua chave atual só permite enviar emails. Para listar o histórico, crie uma nova API Key com permissão <strong className="text-white/70">Full access</strong> no painel do Resend e atualize a variável <code className="text-yellow-400/80 bg-yellow-400/10 px-1 rounded">RESEND_API_KEY</code> nas configurações.
                </p>
                <a href="https://resend.com/api-keys" target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 mt-3 text-xs font-semibold text-yellow-400 hover:text-yellow-300 transition-colors">
                  Abrir painel de API Keys do Resend <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            ) : error ? (
              <div className="mb-4 px-4 py-3 rounded-xl bg-red-400/10 border border-red-400/20 text-sm text-red-400 flex items-center gap-2">
                <XCircle className="w-4 h-4 flex-shrink-0" />{error}
              </div>
            ) : null}

            {/* Table */}
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
              {loading ? (
                <div className="flex items-center justify-center py-16 text-white/30 text-sm gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin" /> Carregando…
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-white/20 text-sm gap-2">
                  <Mail className="w-8 h-8 opacity-30" />
                  {search ? "Nenhum e-mail encontrado." : "Nenhum e-mail enviado ainda."}
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/[0.06] text-left">
                      <th className="px-4 py-3 text-xs text-white/30 font-medium">Destinatário</th>
                      <th className="px-4 py-3 text-xs text-white/30 font-medium">Assunto</th>
                      <th className="px-4 py-3 text-xs text-white/30 font-medium">Status</th>
                      <th className="px-4 py-3 text-xs text-white/30 font-medium">Enviado em</th>
                      <th className="px-4 py-3 w-8" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {filtered.map((email, i) => (
                      <motion.tr
                        key={email.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.02 }}
                        onClick={() => setSelectedId(email.id)}
                        className="hover:bg-white/[0.03] transition-colors cursor-pointer group"
                      >
                        <td className="px-4 py-3">
                          <p className="text-sm text-white/70">{email.to[0]}</p>
                          {email.to.length > 1 && <p className="text-xs text-white/30">+{email.to.length - 1} mais</p>}
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm text-white/60 truncate max-w-[260px]">{email.subject}</p>
                          <p className="text-xs text-white/25 truncate">{email.from}</p>
                        </td>
                        <td className="px-4 py-3">
                          <EventBadge event={email.last_event} />
                        </td>
                        <td className="px-4 py-3 text-xs text-white/40 whitespace-nowrap">
                          {new Date(email.created_at).toLocaleString("pt-BR", {
                            day: "2-digit", month: "2-digit", year: "numeric",
                            hour: "2-digit", minute: "2-digit",
                          })}
                        </td>
                        <td className="px-4 py-3">
                          <ChevronRight className="w-3.5 h-3.5 text-white/20 group-hover:text-white/50 transition-colors" />
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {!loading && filtered.length > 0 && (
              <p className="text-xs text-white/20 text-center mt-4">
                Mostrando {filtered.length} de {emails.length} e-mails • Clique em uma linha para ver detalhes
              </p>
            )}

          </motion.div>
        </main>
      </div>

      {/* Drawer */}
      <AnimatePresence>
        {selectedId && (
          <EmailDrawer emailId={selectedId} onClose={() => setSelectedId(null)} />
        )}
      </AnimatePresence>
    </AdminGuard>
  );
}
