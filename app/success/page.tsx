"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { CheckCircle, Download, Copy, Check, Zap, ArrowRight } from "lucide-react";

function SuccessContent() {
  const params = useSearchParams();
  const sessionId = params.get("session_id");

  const [copied, setCopied] = useState(false);
  // In a real flow the license key would be fetched server-side via the session_id.
  // Here we show a generic success state — the key was already emailed.
  const licenseKey = null as string | null;

  function copy(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col items-center justify-center px-4 py-16">
      {/* Glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[500px] bg-[#25D366]/8 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative z-10 max-w-md w-full">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-10">
          <div className="w-8 h-8 rounded-lg bg-[#25D366] flex items-center justify-center">
            <Zap className="w-4 h-4 text-black" fill="black" />
          </div>
          <span className="font-bold text-lg">
            Dispara<span className="text-[#25D366]">Zapp</span>
          </span>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="bg-[#0d0d0d] border border-white/8 rounded-2xl p-8 text-center"
        >
          {/* Icon */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="w-16 h-16 rounded-full bg-[#25D366]/15 border border-[#25D366]/30 flex items-center justify-center mx-auto mb-6"
          >
            <CheckCircle className="w-8 h-8 text-[#25D366]" />
          </motion.div>

          <h1 className="text-2xl font-black mb-2">Compra confirmada!</h1>
          <p className="text-white/50 text-sm mb-8">
            Sua licença foi enviada para o seu e-mail. Verifique sua caixa de entrada (e spam).
          </p>

          {licenseKey && (
            <div className="mb-8">
              <p className="text-xs text-white/40 uppercase tracking-widest mb-2">Chave de licença</p>
              <div className="flex items-center gap-2 bg-[#111] border border-[#25D366]/20 rounded-xl px-4 py-3">
                <code className="flex-1 text-[#25D366] text-sm font-mono text-left break-all">
                  {licenseKey}
                </code>
                <button
                  onClick={() => copy(licenseKey)}
                  className="flex-shrink-0 text-white/40 hover:text-white transition-colors"
                >
                  {copied ? <Check className="w-4 h-4 text-[#25D366]" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {/* Steps */}
          <div className="text-left space-y-3 mb-8">
            {[
              "Verifique seu e-mail para a chave de licença",
              "Clique no link de download no e-mail",
              "Instale o DisparaZapp no seu Windows",
              "Abra o app e ative com sua chave",
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-[#25D366]/15 border border-[#25D366]/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-[10px] font-bold text-[#25D366]">{i + 1}</span>
                </div>
                <p className="text-sm text-white/60">{step}</p>
              </div>
            ))}
          </div>

          <a
            href="/"
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-[#25D366] text-black font-semibold text-sm hover:bg-[#1fbd5a] transition-all"
          >
            Voltar ao início
            <ArrowRight className="w-4 h-4" />
          </a>
        </motion.div>

        <p className="text-center text-xs text-white/20 mt-6">
          Dúvidas? Entre em contato via WhatsApp.
        </p>
      </div>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense>
      <SuccessContent />
    </Suspense>
  );
}
