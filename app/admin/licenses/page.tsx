"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Plus, Key, Copy, Check, RefreshCw, Trash2, User, Mail, ShoppingBag, ChevronDown, ChevronUp } from "lucide-react";
import { AdminGuard } from "../components/AdminGuard";
import { AdminSidebar } from "../components/AdminSidebar";
import { ConfirmDialog } from "../components/ConfirmDialog";
import {
  Card, Button, Input, Label, Badge,
  Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "../components/ui";
import { adminApi, type License, type Product } from "@/lib/adminApi";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy} className="text-white/20 hover:text-[#25D366] transition-colors ml-1">
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function CreateLicenseModal({ products, onCreated }: { products: Product[]; onCreated: (l: License) => void }) {
  const [open, setOpen]               = useState(false);
  const [productSlug, setProductSlug] = useState("");
  const [maxMachines, setMaxMachines] = useState("1");
  const [entitlements, setEntitlements] = useState("");
  const [expiryType, setExpiryType]   = useState<"never" | "days" | "date">("never");
  const [expiresInDays, setExpiresInDays] = useState("");
  const [expiresAt, setExpiresAt]     = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerName, setCustomerName]   = useState("");
  const [orderId, setOrderId]             = useState("");
  const [notes, setNotes]                 = useState("");
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState("");
  const [created, setCreated]         = useState<License | null>(null);

  const reset = () => {
    setProductSlug(""); setMaxMachines("1"); setEntitlements("");
    setExpiryType("never"); setExpiresInDays(""); setExpiresAt("");
    setCustomerEmail(""); setCustomerName(""); setOrderId(""); setNotes("");
    setError(""); setCreated(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productSlug) { setError("Selecione um produto."); return; }
    setLoading(true); setError("");
    try {
      const ents = entitlements.split(",").map((s) => s.trim()).filter(Boolean);
      const res = await adminApi.licenses.create({
        productSlug,
        maxMachines: parseInt(maxMachines) || 1,
        entitlements: ents.length ? ents : undefined,
        expiresInDays: expiryType === "days" && expiresInDays ? parseInt(expiresInDays) : undefined,
        expiresAt: expiryType === "date" && expiresAt ? new Date(expiresAt).toISOString() : undefined,
        customerEmail: customerEmail || undefined,
        customerName: customerName || undefined,
        orderId: orderId || undefined,
        notes: notes || undefined,
      });
      setCreated(res);
      onCreated(res);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="w-3.5 h-3.5" />Criar Licença</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Criar Nova Licença</DialogTitle>
          <DialogDescription>Preencha os dados para gerar uma nova chave de licença.</DialogDescription>
        </DialogHeader>

        {created ? (
          <div className="space-y-4">
            <div className="rounded-xl bg-[#25D366]/10 border border-[#25D366]/20 p-4">
              <p className="text-xs text-[#25D366] font-semibold mb-2">Licença criada com sucesso!</p>
              <div className="flex items-center gap-2">
                <code className="text-xs font-mono text-white break-all flex-1">{created.key}</code>
                <CopyButton text={created.key} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-white/50">
              <div><span className="text-white/30">Produto:</span> {created.productSlug}</div>
              <div><span className="text-white/30">Máquinas:</span> {created.maxMachines}</div>
              {created.customerEmail && <div className="col-span-2"><span className="text-white/30">Email:</span> {created.customerEmail}</div>}
              {created.customerName && <div className="col-span-2"><span className="text-white/30">Nome:</span> {created.customerName}</div>}
              {created.orderId && <div className="col-span-2"><span className="text-white/30">Pedido:</span> {created.orderId}</div>}
              {created.expiresAt && (
                <div className="col-span-2"><span className="text-white/30">Expira:</span> {new Date(created.expiresAt).toLocaleDateString("pt-BR")}</div>
              )}
            </div>
            <Button className="w-full" variant="outline" onClick={() => { reset(); setOpen(false); }}>Fechar</Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            {/* Produto */}
            <div>
              <Label>Produto</Label>
              <select
                value={productSlug}
                onChange={(e) => setProductSlug(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:border-[#25D366]/50 transition-colors"
              >
                <option value="" className="bg-[#0d0d0d]">Selecionar produto…</option>
                {products.map((p) => (
                  <option key={p.slug} value={p.slug} className="bg-[#0d0d0d]">{p.name} ({p.slug})</option>
                ))}
                {products.length === 0 && (
                  <option value="dispara-zapp" className="bg-[#0d0d0d]">dispara-zapp</option>
                )}
              </select>
            </div>

            {/* Dados do cliente */}
            <div className="rounded-xl border border-white/10 p-3 space-y-3">
              <p className="text-xs text-white/40 font-medium flex items-center gap-1.5"><User className="w-3.5 h-3.5" />Dados do cliente</p>
              <div>
                <Label>Email</Label>
                <Input type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} placeholder="cliente@email.com" />
              </div>
              <div>
                <Label>Nome</Label>
                <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Nome completo" />
              </div>
              <div>
                <Label>ID do Pedido</Label>
                <Input value={orderId} onChange={(e) => setOrderId(e.target.value)} placeholder="cs_live_... ou outro ID" />
              </div>
            </div>

            {/* Configurações */}
            <div>
              <Label>Máximo de máquinas</Label>
              <Input type="number" min="1" max="99" value={maxMachines} onChange={(e) => setMaxMachines(e.target.value)} />
            </div>

            <div>
              <Label>Validade</Label>
              <div className="flex gap-2 mb-2">
                {(["never", "days", "date"] as const).map((t) => (
                  <button key={t} type="button" onClick={() => setExpiryType(t)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                      expiryType === t ? "bg-[#25D366]/15 border-[#25D366]/40 text-[#25D366]" : "border-white/10 text-white/40 hover:text-white/60"
                    }`}>
                    {t === "never" ? "Vitalício" : t === "days" ? "Em dias" : "Data fixa"}
                  </button>
                ))}
              </div>
              {expiryType === "days" && <Input type="number" min="1" value={expiresInDays} onChange={(e) => setExpiresInDays(e.target.value)} placeholder="Ex: 365" />}
              {expiryType === "date" && <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />}
            </div>

            <div>
              <Label>Entitlements <span className="text-white/20 font-normal">(separados por vírgula)</span></Label>
              <Input value={entitlements} onChange={(e) => setEntitlements(e.target.value)} placeholder="pro, unlimited, annual" />
            </div>

            <div>
              <Label>Notas internas</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observações sobre esta licença…" />
            </div>

            {error && <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-xl px-3 py-2">{error}</p>}

            <div className="flex gap-2 pt-1">
              <Button type="submit" className="flex-1" disabled={loading}>{loading ? "Criando…" : "Criar Licença"}</Button>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function LicenseRow({ l, onDelete, deleting }: { l: License; onDelete: (id: string) => void; deleting: boolean }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <>
      <motion.tr
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        className="hover:bg-white/[0.02] transition-colors cursor-pointer"
        onClick={() => setExpanded(v => !v)}
      >
        <td className="py-3">
          <div className="flex items-center gap-1">
            <code className="font-mono text-xs text-white/70 truncate max-w-[180px]">{l.key}</code>
            <CopyButton text={l.key} />
          </div>
        </td>
        <td className="py-3">
          <div className="text-white/70 text-xs">{l.customerName || <span className="text-white/20">—</span>}</div>
          {l.customerEmail && <div className="text-white/30 text-[11px]">{l.customerEmail}</div>}
        </td>
        <td className="py-3 text-white/60 text-xs">{l.productSlug}</td>
        <td className="py-3">
          <Badge variant={l.status as "active" | "inactive" | "revoked"}>{l.status}</Badge>
        </td>
        <td className="py-3 text-white/40 text-xs">{new Date(l.createdAt).toLocaleDateString("pt-BR")}</td>
        <td className="py-3">
          <div className="flex items-center gap-2">
            <button onClick={(e) => { e.stopPropagation(); onDelete(l.id); }} disabled={deleting}
              className="text-white/20 hover:text-red-400 transition-colors disabled:opacity-40" title="Deletar">
              {deleting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            </button>
            {expanded ? <ChevronUp className="w-3.5 h-3.5 text-white/20" /> : <ChevronDown className="w-3.5 h-3.5 text-white/20" />}
          </div>
        </td>
      </motion.tr>
      {expanded && (
        <tr className="bg-white/[0.015]">
          <td colSpan={6} className="px-4 py-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div>
                <p className="text-white/30 mb-0.5 flex items-center gap-1"><Mail className="w-3 h-3" />Email</p>
                <p className="text-white/60">{l.customerEmail || "—"}</p>
              </div>
              <div>
                <p className="text-white/30 mb-0.5 flex items-center gap-1"><ShoppingBag className="w-3 h-3" />Pedido</p>
                <p className="text-white/60 font-mono truncate">{l.orderId || "—"}</p>
              </div>
              <div>
                <p className="text-white/30 mb-0.5">Máquinas</p>
                <p className="text-white/60">{l.maxMachines}</p>
              </div>
              <div>
                <p className="text-white/30 mb-0.5">Expira em</p>
                <p className="text-white/60">{l.expiresAt ? new Date(l.expiresAt).toLocaleDateString("pt-BR") : "Vitalício"}</p>
              </div>
              {l.notes && (
                <div className="col-span-2 md:col-span-4">
                  <p className="text-white/30 mb-0.5">Notas</p>
                  <p className="text-white/60">{l.notes}</p>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function LicensesPage() {
  const [licenses, setLicenses] = useState<License[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 25;

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [lics, prods] = await Promise.all([
        adminApi.licenses.list(),
        adminApi.products.list().catch(() => [] as Product[]),
      ]);
      setLicenses(lics);
      setProducts(prods);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id: string) => {
    setConfirmDeleteId(id);
  };

  const confirmDelete = async () => {
    if (!confirmDeleteId) return;
    const id = confirmDeleteId;
    setConfirmDeleteId(null);
    setDeletingId(id);
    try {
      await adminApi.licenses.delete(id);
      setLicenses((prev) => prev.filter((l) => l.id !== id));
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setDeletingId(null);
    }
  };

  const filtered = licenses.filter((l) => {
    const q = search.toLowerCase();
    return (
      l.key.toLowerCase().includes(q) ||
      (l.customerName ?? "").toLowerCase().includes(q) ||
      (l.customerEmail ?? "").toLowerCase().includes(q) ||
      (l.orderId ?? "").toLowerCase().includes(q) ||
      l.productSlug.toLowerCase().includes(q)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex">
      <AdminSidebar />
      <main className="flex-1 p-8 overflow-auto">
        <AdminGuard>
          <div className="max-w-6xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-semibold text-white">Licenças</h1>
                <p className="text-sm text-white/40 mt-0.5">{licenses.length} licença{licenses.length !== 1 ? "s" : ""} no total</p>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={load} className="text-white/30 hover:text-white/60 transition-colors" title="Recarregar">
                  <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                </button>
                <CreateLicenseModal products={products} onCreated={(l) => setLicenses((prev) => [l, ...prev])} />
              </div>
            </div>

            {/* Search */}
            <div className="relative">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por chave, cliente, pedido…"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[#25D366]/40 transition-colors"
              />
            </div>

            {/* Error */}
            {error && (
              <div className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            {/* Table */}
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
              {loading ? (
                <div className="flex items-center justify-center py-16 text-white/30 text-sm">
                  <RefreshCw className="w-4 h-4 animate-spin mr-2" /> Carregando…
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-white/20 text-sm gap-2">
                  <Key className="w-8 h-8 opacity-30" />
                  {search ? "Nenhuma licença encontrada." : "Nenhuma licença criada ainda."}
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-white/[0.06] text-left">
                      <th className="px-4 py-3 text-xs text-white/30 font-medium">Chave</th>
                      <th className="px-4 py-3 text-xs text-white/30 font-medium">Cliente</th>
                      <th className="px-4 py-3 text-xs text-white/30 font-medium">Produto</th>
                      <th className="px-4 py-3 text-xs text-white/30 font-medium">Status</th>
                      <th className="px-4 py-3 text-xs text-white/30 font-medium">Criada em</th>
                      <th className="px-4 py-3 text-xs text-white/30 font-medium w-16"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04] px-4">
                    {paginated.map((l) => (
                      <LicenseRow
                        key={l.id}
                        l={l}
                        onDelete={handleDelete}
                        deleting={deletingId === l.id}
                      />
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Paginação */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between text-xs text-white/40">
                <span>{filtered.length} licenças · página {page} de {totalPages}</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/20 disabled:opacity-30 transition-colors"
                  >
                    ←
                  </button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const p = Math.max(1, Math.min(totalPages - 4, page - 2)) + i;
                    return (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        className={`px-3 py-1.5 rounded-lg border transition-colors ${
                          p === page
                            ? "border-[#25D366]/40 bg-[#25D366]/10 text-[#25D366]"
                            : "border-white/10 hover:border-white/20"
                        }`}
                      >
                        {p}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/20 disabled:opacity-30 transition-colors"
                  >
                    →
                  </button>
                </div>
              </div>
            )}
          </div>
        </AdminGuard>
      </main>
      <ConfirmDialog
        open={!!confirmDeleteId}
        title="Deletar licença"
        description="Esta ação é permanente e não pode ser desfeita. A licença será removida e o usuário perderá o acesso."
        confirmLabel="Deletar"
        onConfirm={confirmDelete}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  );
}