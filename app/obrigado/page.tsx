"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Mail, Download, MessageCircle, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function ObrigadoPage() {
  const [show, setShow] = useState(false);
  useEffect(() => { setShow(true); }, []);

  const downloadUrl = process.env.NEXT_PUBLIC_APP_URL
    ? `${process.env.NEXT_PUBLIC_APP_URL}/downloads/DisparaZapp-Setup.exe`
    : "/downloads/DisparaZapp-Setup.exe";

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: show ? 1 : 0, y: show ? 0 : 24 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-lg text-center space-y-8"
      >
        {/* Ícone */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 300, damping: 20 }}
          className="w-20 h-20 rounded-full bg-[#25D366]/20 border-2 border-[#25D366] flex items-center justify-center mx-auto"
        >
          <CheckCircle2 className="w-10 h-10 text-[#25D366]" />
        </motion.div>

        {/* Título */}
        <div className="space-y-2">
          <h1 className="text-3xl font-black text-white">Compra confirmada!</h1>
          <p className="text-white/50">Sua licença foi ativada com sucesso. Verifique seu e-mail.</p>
        </div>

        {/* Steps */}
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-6 space-y-4 text-left">
          {[
            { icon: Mail,           label: "Verifique seu e-mail",        desc: "Enviamos sua chave de licença para o e-mail cadastrado no pagamento." },
            { icon: Download,       label: "Baixe o DisparaZapp",         desc: "Instale o software no seu Windows para começar a usar." },
            { icon: MessageCircle,  label: "Ative sua licença",           desc: "Abra o app, clique em Ativar Licença e cole a chave recebida." },
          ].map(({ icon: Icon, label, desc }, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + i * 0.1 }}
              className="flex items-start gap-3"
            >
              <div className="w-8 h-8 rounded-xl bg-[#25D366]/15 flex items-center justify-center shrink-0 mt-0.5">
                <Icon className="w-4 h-4 text-[#25D366]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">{label}</p>
                <p className="text-xs text-white/40 mt-0.5">{desc}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-3">
          <a
            href={downloadUrl}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-[#25D366] text-black font-semibold text-sm hover:bg-[#20b858] transition-colors"
          >
            <Download className="w-4 h-4" />
            Baixar DisparaZapp
          </a>
          <Link
            href="/"
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border border-white/10 text-white/60 text-sm hover:border-white/20 hover:text-white transition-colors"
          >
            Voltar ao início
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <p className="text-xs text-white/20">
          Não recebeu o e-mail?{" "}
          <a href="https://wa.me/5500000000000" target="_blank" rel="noopener noreferrer" className="text-[#25D366] hover:underline">
            Fale com o suporte
          </a>
        </p>
      </motion.div>
    </div>
  );
}
