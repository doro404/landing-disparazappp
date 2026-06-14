"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { RefreshCw, Trash2, FlaskConical, Wifi, WifiOff, Zap } from "lucide-react";
import { AdminGuard } from "../components/AdminGuard";
import { AdminSidebar } from "../components/AdminSidebar";
import { Badge } from "../components/ui";
import { adminApi, type Trial } from "@/lib/adminApi";

const SEND_LIMIT = 50;

function TrialStatusBadge({ t }: { t: Trial }) {
  if (t.exhausted) return <Badge variant="revoked">esgotado</Badge>;
  if (t.expired)   return <Badge variant="inactive">expirado</Badge>;
  return <Badge variant="active">ativo</Badge>;
}

export default function TrialsPage() {
  const [trials, setTrials]     = useState<Trial[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [search, setSearch]     = useState("");

  const load = async () => {
    setLoading(true); setError("");
    try {
      setTrials(await adminApi.trials.list());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Deletar este trial? O usuário poderá iniciar um novo.")) return;
    setDeletingId(id);
    try {
      await adminApi.trials.delete(id);
      setTrials((prev) => prev.filter((t) => t.id !== id));
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setDeletingId(null);
    }
  };

  const filtered = trials.filter((t) => {
    const q = search.toLowerCase();
    return t.fingerprint.toLowerCase().includes(q) || (t.ip ?? "").includes(q) || t.productSlug.includes(q);
  });

  const active    = trials.filter((t) => !t.expired && !t.exhausted).length;
  const expired   = trials.filter((t) => t.expired).length;
  const exhausted = trials.filter((t) => t.exhausted).length;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex">
      <AdminSidebar />
      <main className="flex-1 p-8 overflow-auto">
        <AdminGuard>
          <div className="max-w-6xl mx-auto space-y-6">

            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-semibold text-white flex items-center gap-2">
                  <FlaskConical className="w-5 h-5 text-white/40" /> Trials
                </h1>
                <p className="text-sm text-white/40 mt-0.5">{trials.length} trial{trials.length !== 1 ? "s" : ""} registrados</p>
              </div>
              <button onClick={load} className="text-white/30 hover:text-white/60 transition-colors" title="Recarregar">
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: "Ativos", value: active,    icon: Wifi,    color: "text-[#25D366]" },
                { label: "Expirados", value: expired, icon: WifiOff, color: "text-yellow-400" },
                { label: "Esgotados", value: exhausted, icon: Zap,  color: "text-red-400" },
              ].map((s) => (
                <div key={s.label} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 flex items-center gap-3">
                  <s.icon className={`w-5 h-5 ${s.color}`} />
                  <div>
                    <p className={`text-2xl font-bold ${s.color}`}>{loading ? "…" : s.value}</p>
                    <p className="text-xs text-white/30">{s.label}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Search */}
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por fingerprint ou IP…"
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[#25D366]/40 transition-colors"
            />

            {error && (
              <div className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-400">{error}</div>
            )}

            {/* Table */}
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
              {loading ? (
                <div className="flex items-center justify-center py-16 text-white/30 text-sm">
                  <RefreshCw className="w-4 h-4 animate-spin mr-2" /> Carregando…
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-white/20 text-sm gap-2">
                  <FlaskConical className="w-8 h-8 opacity-30" />
                  {search ? "Nenhum trial encontrado." : "Nenhum trial registrado ainda."}
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/[0.06] text-left">
                      <th className="px-4 py-3 text-xs text-white/30 font-medium">Fingerprint</th>
                      <th className="px-4 py-3 text-xs text-white/30 font-medium">Produto</th>
                      <th className="px-4 py-3 text-xs text-white/30 font-medium">Envios</th>
                      <th className="px-4 py-3 text-xs text-white/30 font-medium">Iniciado</th>
                      <th className="px-4 py-3 text-xs text-white/30 font-medium">Expira</th>
                      <th className="px-4 py-3 text-xs text-white/30 font-medium">IP</th>
                      <th className="px-4 py-3 text-xs text-white/30 font-medium">Status</th>
                      <th className="px-4 py-3 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {filtered.map((t) => (
                      <motion.tr
                        key={t.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="hover:bg-white/[0.02] transition-colors"
                      >
                        <td className="px-4 py-3">
                          <code className="font-mono text-xs text-white/50 truncate max-w-[160px] block">{t.fingerprint}</code>
                        </td>
                        <td className="px-4 py-3 text-xs text-white/50">{t.productSlug}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-20 h-1.5 bg-white/10 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${t.exhausted ? "bg-red-400" : "bg-[#25D366]"}`}
                                style={{ width: `${Math.min(100, (t.sends / SEND_LIMIT) * 100)}%` }}
                              />
                            </div>
                            <span className="text-xs text-white/40">{t.sends}/{SEND_LIMIT}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-white/40">{new Date(t.startedAt).toLocaleDateString("pt-BR")}</td>
                        <td className="px-4 py-3 text-xs text-white/40">{new Date(t.expiresAt).toLocaleDateString("pt-BR")}</td>
                        <td className="px-4 py-3 text-xs text-white/30 font-mono">{t.ip ?? "—"}</td>
                        <td className="px-4 py-3"><TrialStatusBadge t={t} /></td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => handleDelete(t.id)}
                            disabled={deletingId === t.id}
                            className="text-white/20 hover:text-red-400 transition-colors disabled:opacity-40"
                            title="Deletar trial (permite novo trial nesta máquina)"
                          >
                            {deletingId === t.id
                              ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              : <Trash2 className="w-3.5 h-3.5" />}
                          </button>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </AdminGuard>
      </main>
    </div>
  );
}
