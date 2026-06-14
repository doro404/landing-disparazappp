"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Upload, Trash2, RefreshCw, Download, AlertTriangle, CheckCircle2, Package, ShieldCheck } from "lucide-react";
import { AdminGuard } from "../components/AdminGuard";
import { AdminSidebar } from "../components/AdminSidebar";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { adminApi, type AppUpdate } from "@/lib/adminApi";

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export default function UpdatesPage() {
  const [updates, setUpdates] = useState<AppUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [version, setVersion] = useState("");
  const [target, setTarget] = useState("windows");
  const [arch, setArch] = useState("x86_64");
  const [changelog, setChangelog] = useState("");
  const [force, setForce] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState("");
  const [uploadSuccess, setUploadSuccess] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const signatureFileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await adminApi.updates.list();
      setUpdates(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !signatureFile || !version.trim()) {
      setUploadError("Selecione o instalador, o arquivo .sig e informe a versao.");
      return;
    }

    setUploading(true);
    setUploadError("");
    setUploadSuccess("");
    setUploadProgress(0);

    const interval = window.setInterval(() => {
      setUploadProgress((p) => Math.min(p + 5, 90));
    }, 300);

    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("signatureFile", signatureFile);
      fd.append("product", "dispara-zapp");
      fd.append("version", version.trim());
      fd.append("target", target);
      fd.append("arch", arch);
      fd.append("changelog", changelog);
      fd.append("force", String(force));

      await adminApi.updates.upload(fd);
      window.clearInterval(interval);
      setUploadProgress(100);
      setUploadSuccess(`Versao ${version} publicada com sucesso.`);
      setFile(null);
      setSignatureFile(null);
      setVersion("");
      setTarget("windows");
      setArch("x86_64");
      setChangelog("");
      setForce(false);
      if (fileRef.current) fileRef.current.value = "";
      if (signatureFileRef.current) signatureFileRef.current.value = "";
      await load();
    } catch (e) {
      window.clearInterval(interval);
      setUploadError((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const confirmDelete = async () => {
    if (!confirmDeleteId) return;
    const id = confirmDeleteId;
    setConfirmDeleteId(null);
    setDeletingId(id);
    try {
      await adminApi.updates.delete(id);
      setUpdates((prev) => prev.filter((u) => u.id !== id));
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setDeletingId(null);
    }
  };

  const latest = updates[0];

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white flex">
      <AdminSidebar />
      <main className="flex-1 p-8 overflow-auto">
        <AdminGuard>
          <div className="max-w-4xl mx-auto space-y-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-semibold text-white">Atualizacoes</h1>
                <p className="text-sm text-white/40 mt-0.5">Publique updates assinados para o updater nativo do Tauri</p>
              </div>
              <button onClick={load} className="text-white/30 hover:text-white/60 transition-colors" title="Recarregar">
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </button>
            </div>

            {latest && (
              <div className="rounded-2xl border border-[#25D366]/20 bg-[#25D366]/5 p-5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#25D366]/15 flex items-center justify-center">
                    <Package className="w-5 h-5 text-[#25D366]" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">Versao atual publicada</p>
                    <p className="text-xs text-white/40 mt-0.5">
                      v{latest.version} | {latest.target}-{latest.arch} | {formatBytes(latest.fileSize)} | {new Date(latest.publishedAt).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {latest.signature && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#25D366]/15 text-[#25D366] border border-[#25D366]/20">
                      ASSINADO
                    </span>
                  )}
                  {latest.force && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-400/15 text-orange-400 border border-orange-400/20">
                      FORCADA
                    </span>
                  )}
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-white/60 border border-white/10">
                    LATEST
                  </span>
                </div>
              </div>
            )}

            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-6 space-y-5">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <Upload className="w-4 h-4 text-[#25D366]" />
                Publicar nova versao
              </h2>

              <form onSubmit={handleUpload} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div
                    onClick={() => fileRef.current?.click()}
                    className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                      file ? "border-[#25D366]/40 bg-[#25D366]/5" : "border-white/10 hover:border-white/20 hover:bg-white/[0.02]"
                    }`}
                  >
                    <input
                      ref={fileRef}
                      type="file"
                      accept=".exe,.msi,.dmg,.AppImage,.deb,.rpm,.zip"
                      className="hidden"
                      onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                    />
                    {file ? (
                      <div className="flex items-center justify-center gap-3">
                        <CheckCircle2 className="w-5 h-5 text-[#25D366]" />
                        <div className="text-left min-w-0">
                          <p className="text-sm text-white font-medium truncate">{file.name}</p>
                          <p className="text-xs text-white/40">{formatBytes(file.size)}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Upload className="w-8 h-8 text-white/20 mx-auto" />
                        <p className="text-sm text-white/40">Selecionar instalador</p>
                        <p className="text-xs text-white/20">.exe, .msi, .zip, .dmg</p>
                      </div>
                    )}
                  </div>

                  <div
                    onClick={() => signatureFileRef.current?.click()}
                    className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                      signatureFile ? "border-[#25D366]/40 bg-[#25D366]/5" : "border-white/10 hover:border-white/20 hover:bg-white/[0.02]"
                    }`}
                  >
                    <input
                      ref={signatureFileRef}
                      type="file"
                      accept=".sig,text/plain"
                      className="hidden"
                      onChange={(e) => setSignatureFile(e.target.files?.[0] ?? null)}
                    />
                    {signatureFile ? (
                      <div className="flex items-center justify-center gap-3">
                        <ShieldCheck className="w-5 h-5 text-[#25D366]" />
                        <div className="text-left min-w-0">
                          <p className="text-sm text-white font-medium truncate">{signatureFile.name}</p>
                          <p className="text-xs text-white/40">Assinatura Tauri</p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <ShieldCheck className="w-8 h-8 text-white/20 mx-auto" />
                        <p className="text-sm text-white/40">Selecionar arquivo .sig</p>
                        <p className="text-xs text-white/20">Gerado pelo tauri signer</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="text-xs text-white/40 block mb-1.5">Versao</label>
                    <input
                      value={version}
                      onChange={(e) => setVersion(e.target.value)}
                      placeholder="0.1.1"
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[#25D366]/50 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-white/40 block mb-1.5">Target</label>
                    <select
                      value={target}
                      onChange={(e) => setTarget(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:border-[#25D366]/50 transition-colors"
                    >
                      <option value="windows">windows</option>
                      <option value="darwin">darwin</option>
                      <option value="linux">linux</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-white/40 block mb-1.5">Arch</label>
                    <select
                      value={arch}
                      onChange={(e) => setArch(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white focus:outline-none focus:border-[#25D366]/50 transition-colors"
                    >
                      <option value="x86_64">x86_64</option>
                      <option value="aarch64">aarch64</option>
                    </select>
                  </div>
                  <div className="flex items-end">
                    <label className="flex items-center gap-2.5 cursor-pointer select-none">
                      <div
                        onClick={() => setForce((v) => !v)}
                        className={`w-10 h-5 rounded-full transition-colors relative ${force ? "bg-orange-400" : "bg-white/10"}`}
                      >
                        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${force ? "translate-x-5" : "translate-x-0.5"}`} />
                      </div>
                      <div>
                        <p className="text-xs text-white/70 font-medium">Forcada</p>
                        <p className="text-[10px] text-white/30">Sinal informativo</p>
                      </div>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-white/40 block mb-1.5">Changelog</label>
                  <textarea
                    value={changelog}
                    onChange={(e) => setChangelog(e.target.value)}
                    placeholder="- Correcoes de bugs&#10;- Melhorias de performance"
                    rows={4}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[#25D366]/50 transition-colors resize-none"
                  />
                </div>

                {uploading && (
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-white/40">
                      <span>Enviando...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-[#25D366] rounded-full"
                        animate={{ width: `${uploadProgress}%` }}
                        transition={{ duration: 0.3 }}
                      />
                    </div>
                  </div>
                )}

                {uploadError && (
                  <div className="flex items-center gap-2 text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-xl px-3 py-2">
                    <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                    {uploadError}
                  </div>
                )}
                {uploadSuccess && (
                  <div className="flex items-center gap-2 text-xs text-[#25D366] bg-[#25D366]/10 border border-[#25D366]/20 rounded-xl px-3 py-2">
                    <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                    {uploadSuccess}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={uploading || !file || !signatureFile || !version.trim()}
                  className="w-full py-2.5 rounded-xl bg-[#25D366] text-black text-sm font-semibold hover:bg-[#20c05a] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {uploading ? (
                    <><RefreshCw className="w-4 h-4 animate-spin" />Publicando...</>
                  ) : (
                    <><Upload className="w-4 h-4" />Publicar versao assinada</>
                  )}
                </button>
              </form>
            </div>

            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
              <div className="px-5 py-4 border-b border-white/[0.06]">
                <h2 className="text-sm font-semibold text-white">Historico de versoes</h2>
              </div>

              {error && <div className="px-5 py-3 text-sm text-red-400">{error}</div>}

              {loading ? (
                <div className="flex items-center justify-center py-12 text-white/30 text-sm gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin" /> Carregando...
                </div>
              ) : updates.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-white/20 text-sm gap-2">
                  <Package className="w-8 h-8 opacity-30" />
                  Nenhuma versao publicada ainda.
                </div>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="text-left border-b border-white/[0.06]">
                      <th className="px-5 py-3 text-xs text-white/30 font-medium">Versao</th>
                      <th className="px-5 py-3 text-xs text-white/30 font-medium">Plataforma</th>
                      <th className="px-5 py-3 text-xs text-white/30 font-medium">Arquivo</th>
                      <th className="px-5 py-3 text-xs text-white/30 font-medium">Tamanho</th>
                      <th className="px-5 py-3 text-xs text-white/30 font-medium">Publicado em</th>
                      <th className="px-5 py-3 text-xs text-white/30 font-medium w-20"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {updates.map((u, i) => (
                      <motion.tr
                        key={u.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.03 }}
                        className="hover:bg-white/[0.02] transition-colors"
                      >
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-mono text-white">v{u.version}</span>
                            {i === 0 && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#25D366]/15 text-[#25D366] border border-[#25D366]/20">
                                LATEST
                              </span>
                            )}
                            {u.signature && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-white/10 text-white/60 border border-white/10">
                                SIG
                              </span>
                            )}
                          </div>
                          {u.changelog && (
                            <p className="text-[11px] text-white/30 mt-0.5 truncate max-w-xs">{u.changelog.split("\n")[0]}</p>
                          )}
                        </td>
                        <td className="px-5 py-3 text-xs text-white/40 font-mono">{u.target}-{u.arch}</td>
                        <td className="px-5 py-3 text-xs text-white/40 font-mono truncate max-w-[180px]">{u.fileName}</td>
                        <td className="px-5 py-3 text-xs text-white/40">{formatBytes(u.fileSize)}</td>
                        <td className="px-5 py-3 text-xs text-white/40">{new Date(u.publishedAt).toLocaleDateString("pt-BR")}</td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <a
                              href={`${process.env.NEXT_PUBLIC_LICENSE_API_URL ?? "https://license-manager.discloud.app"}/api/v1/updates/download/${u.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-white/20 hover:text-[#25D366] transition-colors"
                              title="Baixar"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </a>
                            <button
                              onClick={() => setConfirmDeleteId(u.id)}
                              disabled={deletingId === u.id}
                              className="text-white/20 hover:text-red-400 transition-colors disabled:opacity-40"
                              title="Deletar"
                            >
                              {deletingId === u.id
                                ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                : <Trash2 className="w-3.5 h-3.5" />
                              }
                            </button>
                          </div>
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
      <ConfirmDialog
        open={!!confirmDeleteId}
        title="Deletar update"
        description="O arquivo sera removido do servidor permanentemente. Usuarios com versoes antigas nao poderao baixar esta versao."
        confirmLabel="Deletar"
        onConfirm={confirmDelete}
        onCancel={() => setConfirmDeleteId(null)}
      />
    </div>
  );
}
