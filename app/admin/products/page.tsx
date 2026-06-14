"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Package, RefreshCw, Plus, X } from "lucide-react";
import { AdminGuard } from "../components/AdminGuard";
import { AdminSidebar } from "../components/AdminSidebar";
import { Card, Button, Badge, Input, Label } from "../components/ui";
import { adminApi, type Product } from "@/lib/adminApi";

function CreateProductModal({ onCreated, onClose }: { onCreated: (p: Product) => void; onClose: () => void }) {
  const [name, setName]                   = useState("");
  const [slug, setSlug]                   = useState("");
  const [maxMachines, setMaxMachines]     = useState("1");
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState("");

  // auto-generate slug from name
  function handleName(v: string) {
    setName(v);
    setSlug(v.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !slug) { setError("Nome e slug são obrigatórios."); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/admin/proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: "/api/v1/products",
          method: "POST",
          body: { name, slug, defaultMaxMachines: parseInt(maxMachines) || 1 },
        }),
      });
      const json = await res.json() as { success?: boolean; data?: Product; error?: string };
      if (!res.ok || json.success === false) throw new Error(json.error ?? `HTTP ${res.status}`);
      onCreated(json.data as Product);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="relative w-full max-w-md bg-[#0d0d0d] border border-white/10 rounded-2xl p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-white">Novo produto</h2>
          <button onClick={onClose} className="text-white/30 hover:text-white/60 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="p-name">Nome</Label>
            <Input id="p-name" value={name} onChange={(e) => handleName(e.target.value)} placeholder="DisparaZapp" />
          </div>
          <div>
            <Label htmlFor="p-slug">Slug</Label>
            <Input
              id="p-slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
              placeholder="dispara-zapp"
              className="font-mono"
            />
            <p className="text-[10px] text-white/20 mt-1">Apenas letras minúsculas, números e hífens</p>
          </div>
          <div>
            <Label htmlFor="p-machines">Máquinas padrão</Label>
            <Input
              id="p-machines"
              type="number"
              min="1"
              value={maxMachines}
              onChange={(e) => setMaxMachines(e.target.value)}
            />
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex gap-2 pt-1">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancelar</Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? "Criando…" : "Criar produto"}
            </Button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const load = () => {
    setLoading(true);
    adminApi.products.list()
      .then((r) => setProducts(Array.isArray(r) ? r : []))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  return (
    <AdminGuard>
      <div className="flex min-h-screen bg-[#050505] text-white">
        <AdminSidebar />
        <main className="ml-56 flex-1 p-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-2xl font-black text-white mb-1">Produtos</h1>
                <p className="text-sm text-white/40">{products.length} produto{products.length !== 1 ? "s" : ""} cadastrado{products.length !== 1 ? "s" : ""}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={load} disabled={loading}>
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                  Atualizar
                </Button>
                <Button size="sm" onClick={() => setShowCreate(true)}>
                  <Plus className="w-3.5 h-3.5" />
                  Novo produto
                </Button>
              </div>
            </div>

            {loading ? (
              <p className="text-sm text-white/30 text-center py-20">Carregando…</p>
            ) : products.length === 0 ? (
              <div className="text-center py-20">
                <Package className="w-12 h-12 text-white/10 mx-auto mb-3" />
                <p className="text-sm text-white/30 mb-4">Nenhum produto encontrado</p>
                <Button size="sm" onClick={() => setShowCreate(true)}>
                  <Plus className="w-3.5 h-3.5" />
                  Criar primeiro produto
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {products.map((p, i) => (
                  <motion.div
                    key={p.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.08 }}
                  >
                    <Card className="hover:border-white/15 transition-colors">
                      <div className="flex items-start justify-between mb-4">
                        <div className="w-10 h-10 rounded-xl bg-[#25D366]/15 flex items-center justify-center">
                          <Package className="w-5 h-5 text-[#25D366]" />
                        </div>
                        <Badge variant="active">ativo</Badge>
                      </div>
                      <h3 className="text-base font-bold text-white mb-1">{p.name}</h3>
                      <p className="text-xs text-white/30 font-mono mb-4">{p.slug}</p>
                      <div className="flex items-center justify-between text-xs text-white/40 border-t border-white/5 pt-3 mt-3">
                        <span>Máquinas padrão</span>
                        <span className="text-white font-semibold">{p.defaultMaxMachines}</span>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        </main>
      </div>

      <AnimatePresence>
        {showCreate && (
          <CreateProductModal
            onCreated={(p) => { setProducts((prev) => [p, ...prev]); setShowCreate(false); }}
            onClose={() => setShowCreate(false)}
          />
        )}
      </AnimatePresence>
    </AdminGuard>
  );
}
