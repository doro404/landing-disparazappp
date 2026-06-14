"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Key, Package, CheckCircle2, XCircle, Clock,
  AlertTriangle, RefreshCw, Activity,
} from "lucide-react";
import { AdminGuard } from "../components/AdminGuard";
import { AdminSidebar } from "../components/AdminSidebar";
import { Card, CardHeader, CardTitle, CardValue, Badge, Button } from "../components/ui";
import { adminApi, type License, type Product } from "@/lib/adminApi";

function fadeUp(i: number) {
  return {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.4, delay: i * 0.07 },
  };
}

export default function DashboardPage() {
  const [licenses, setLicenses] = useState<License[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [l, p] = await Promise.all([
        adminApi.licenses.list(),
        adminApi.products.list(),
      ]);
      setLicenses(Array.isArray(l) ? l : []);
      setProducts(Array.isArray(p) ? p : []);
      setLastUpdated(new Date());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const total    = licenses.length;
  const active   = licenses.filter((l) => l.status === "active").length;
  const revoked  = licenses.filter((l) => l.status === "revoked").length;
  const expired  = licenses.filter((l) => l.status === "inactive").length;
  const expiringSoon = licenses.filter((l) => {
    if (!l.expiresAt || l.status !== "active") return false;
    const days = (new Date(l.expiresAt).getTime() - Date.now()) / 86_400_000;
    return days > 0 && days <= 30;
  }).length;

  const recent = [...licenses]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 10);

  const stats = [
    { label: "Total de Licenças", value: total,    icon: Key,           color: "text-white" },
    { label: "Ativas",            value: active,   icon: CheckCircle2,  color: "text-[#25D366]" },
    { label: "Revogadas",         value: revoked,  icon: XCircle,       color: "text-red-400" },
    { label: "Expiradas",         value: expired,  icon: AlertTriangle, color: "text-yellow-400" },
    { label: "Expirando em 30d",  value: expiringSoon, icon: Clock,     color: "text-orange-400" },
    { label: "Produtos",          value: products.length, icon: Package, color: "text-blue-400" },
  ];

  return (
    <AdminGuard>
      <div className="flex min-h-screen bg-[#050505] text-white">
        <AdminSidebar />
        <main className="ml-56 flex-1 p-8">

          {/* Header */}
          <motion.div {...fadeUp(0)} className="flex items-start justify-between mb-8">
            <div>
              <h1 className="text-2xl font-black text-white mb-1">Dashboard</h1>
              <p className="text-sm text-white/40">
                {lastUpdated
                  ? <>Atualizado às {lastUpdated.toLocaleTimeString("pt-BR")}</>
                  : "Carregando dados…"
                }
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          </motion.div>

          {error && (
            <motion.div {...fadeUp(1)} className="mb-6 px-4 py-3 rounded-xl bg-red-400/10 border border-red-400/20 text-sm text-red-400 flex items-center gap-2">
              <XCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </motion.div>
          )}

          {/* Stats grid */}
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
            {stats.map((s, i) => (
              <motion.div key={s.label} {...fadeUp(i + 1)}>
                <Card className="text-center">
                  <s.icon className={`w-5 h-5 ${s.color} mx-auto mb-2`} />
                  <CardValue className={`text-2xl ${s.color}`}>
                    {loading ? <span className="text-white/20">…</span> : s.value}
                  </CardValue>
                  <p className="text-[10px] text-white/30 mt-1 leading-tight">{s.label}</p>
                </Card>
              </motion.div>
            ))}
          </div>

          {/* Activity bar — active % */}
          {!loading && total > 0 && (
            <motion.div {...fadeUp(8)} className="mb-8">
              <Card>
                <div className="flex items-center gap-2 mb-3">
                  <Activity className="w-4 h-4 text-white/30" />
                  <CardTitle>Taxa de licenças ativas</CardTitle>
                  <span className="ml-auto text-sm font-bold text-[#25D366]">
                    {Math.round((active / total) * 100)}%
                  </span>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(active / total) * 100}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="h-full bg-gradient-to-r from-[#25D366] to-emerald-400 rounded-full"
                  />
                </div>
                <div className="flex justify-between text-[10px] text-white/20 mt-1.5">
                  <span>{active} ativas</span>
                  <span>{total - active} inativas/revogadas/expiradas</span>
                </div>
              </Card>
            </motion.div>
          )}

          {/* Recent licenses */}
          <motion.div {...fadeUp(9)}>
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-white/40" />
                    <CardTitle>Licenças Recentes</CardTitle>
                  </div>
                  <span className="text-xs text-white/20">últimas {recent.length}</span>
                </div>
              </CardHeader>

              {loading ? (
                <p className="text-sm text-white/30 py-6 text-center">Carregando…</p>
              ) : recent.length === 0 ? (
                <p className="text-sm text-white/30 py-6 text-center">Nenhuma licença encontrada</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/5 text-white/30 text-xs">
                        <th className="text-left pb-3 font-medium">Chave</th>
                        <th className="text-left pb-3 font-medium">Produto</th>
                        <th className="text-left pb-3 font-medium">Máquinas</th>
                        <th className="text-left pb-3 font-medium">Validade</th>
                        <th className="text-left pb-3 font-medium">Status</th>
                        <th className="text-left pb-3 font-medium">Criada em</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/[0.04]">
                      {recent.map((l, i) => {
                        const isExpiringSoon = l.expiresAt && l.status === "active" &&
                          (new Date(l.expiresAt).getTime() - Date.now()) / 86_400_000 <= 30;
                        return (
                          <motion.tr
                            key={l.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: i * 0.03 }}
                            className="hover:bg-white/[0.02] transition-colors"
                          >
                            <td className="py-3 font-mono text-xs text-white/70 truncate max-w-[160px]">{l.key}</td>
                            <td className="py-3 text-white/60 text-xs">{l.productSlug}</td>
                            <td className="py-3 text-white/60 text-xs text-center">{l.maxMachines}</td>
                            <td className="py-3 text-xs">
                              {l.expiresAt ? (
                                <span className={isExpiringSoon ? "text-orange-400" : "text-white/40"}>
                                  {new Date(l.expiresAt).toLocaleDateString("pt-BR")}
                                  {isExpiringSoon && " ⚠"}
                                </span>
                              ) : (
                                <span className="text-white/20">Vitalício</span>
                              )}
                            </td>
                            <td className="py-3">
                              <Badge variant={l.status as "active" | "inactive" | "revoked"}>
                                {l.status === "active" ? "ativa" : l.status === "revoked" ? "revogada" : "expirada"}
                              </Badge>
                            </td>
                            <td className="py-3 text-white/40 text-xs">
                              {new Date(l.createdAt).toLocaleDateString("pt-BR")}
                            </td>
                          </motion.tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </motion.div>

        </main>
      </div>
    </AdminGuard>
  );
}
