"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useInView, type Variants } from "framer-motion";
import {
  Zap, Shield, Users, MessageSquare, Calendar, Bot,
  Database, Check, ChevronRight, Menu, X,
  Send, RefreshCw, AlertTriangle,
  ArrowRight, Sparkles, Lock, Loader2,
} from "lucide-react";

// ─── Fade-in wrapper ──────────────────────────────────────────────────────────
function FadeIn({
  children, delay = 0, className = "", y = 20,
}: { children: React.ReactNode; delay?: number; className?: string; y?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      viewport={{ once: true, amount: 0.2 }}
      className={`w-full ${className}`}
    >
      {children}
    </motion.div>
  );
}

// ─── Stagger container variants ───────────────────────────────────────────────
const staggerContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1, delayChildren: 0.05 } },
};
const staggerItem: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } },
};
const staggerItemLeft: Variants = {
  hidden: { opacity: 0, x: 24 },
  show: { opacity: 1, x: 0, transition: { duration: 0.45, ease: "easeOut" as const } },
};

// ─── Header ───────────────────────────────────────────────────────────────────
function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
  }, []);

  const links = [
    { label: "Recursos", href: "#features" },
    { label: "Como funciona", href: "#how" },
    { label: "Preços", href: "#pricing" },
  ];

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? "bg-[#050505]/80 backdrop-blur-xl border-b border-white/5" : "bg-transparent"
      }`}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <a href="#" className="flex items-center gap-2 group">
          <span className="font-bold text-lg tracking-tight">
            Dispara<span className="text-[#25D366]">Zapp</span>
          </span>
        </a>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-8">
          {links.map((l) => (
            <a key={l.href} href={l.href}
              className="text-sm text-white/60 hover:text-white transition-colors">
              {l.label}
            </a>
          ))}
        </nav>

        {/* CTA */}
        <div className="hidden md:flex items-center gap-3">
          <a href="#pricing"
            className="px-4 py-2 text-sm font-semibold rounded-xl bg-[#25D366] text-black hover:bg-[#1fbd5a] transition-all glow-green-sm">
            Começar Agora
          </a>
        </div>

        {/* Mobile toggle */}
        <button className="md:hidden text-white/60 hover:text-white"
          onClick={() => setMobileOpen((v) => !v)}>
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="md:hidden bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-white/5 px-4 pb-4">
            {links.map((l) => (
              <a key={l.href} href={l.href} onClick={() => setMobileOpen(false)}
                className="block py-3 text-sm text-white/70 hover:text-white border-b border-white/5">
                {l.label}
              </a>
            ))}
            <a href="#pricing"
              className="mt-3 block text-center px-4 py-2.5 text-sm font-semibold rounded-xl bg-[#25D366] text-black">
              Começar Agora
            </a>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

// ─── Dashboard Mockup ─────────────────────────────────────────────────────────
const mockMessages = [
  { name: "João Silva", phone: "+55 11 99999-0001", status: "sent" },
  { name: "Maria Souza", phone: "+55 21 98888-0002", status: "sent" },
  { name: "Carlos Lima", phone: "+55 31 97777-0003", status: "pending" },
  { name: "Ana Costa", phone: "+55 41 96666-0004", status: "sent" },
  { name: "Pedro Alves", phone: "+55 51 95555-0005", status: "error" },
  { name: "Lucia Ferr.", phone: "+55 61 94444-0006", status: "sent" },
  { name: "Bruno Melo", phone: "+55 71 93333-0007", status: "pending" },
];

const statusConfig = {
  sent: { label: "Enviado", color: "text-[#25D366] bg-[#25D366]/10 border-[#25D366]/20" },
  pending: { label: "Aguardando", color: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20" },
  error: { label: "Falha", color: "text-red-400 bg-red-400/10 border-red-400/20" },
};

// ─── Hero Section ─────────────────────────────────────────────────────────────
function Hero() {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center pt-16 overflow-hidden px-4">
      {/* Background glows */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-[#25D366]/8 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-1/3 left-1/4 w-[300px] h-[300px] bg-[#25D366]/5 rounded-full blur-[80px] pointer-events-none" />

      <div className="relative z-10 max-w-6xl mx-auto w-full">
        {/* Badge */}
        <FadeIn className="flex justify-center mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass border border-[#25D366]/20 text-xs text-[#25D366]">
            <Sparkles className="w-3 h-3" />
            Automação profissional para WhatsApp
            <ChevronRight className="w-3 h-3 opacity-60" />
          </div>
        </FadeIn>

        {/* Headline */}
        <FadeIn delay={0.1} className="text-center mb-6">
          <h1 className="text-4xl sm:text-5xl md:text-7xl font-black tracking-tight leading-[1.05]">
            <span className="gradient-text text-glow">Disparo em Massa no WhatsApp</span>
            <br />
            <span className="text-white">Sem Banir sua Conta</span>
            <br />
            <span className="gradient-text text-glow">Tudo no Seu PC</span>
          </h1>
        </FadeIn>

        {/* Subheadline */}
        <FadeIn delay={0.2} className="text-center mb-10">
          <p className="text-base sm:text-lg text-white/70 max-w-2xl mx-auto leading-relaxed">
            <span className="font-semibold text-[#25D366]">Anti-Ban Inteligente</span> + 
            <span className="font-semibold text-[#25D366]"> Dados 100% Locais</span> + 
            <span className="font-semibold text-[#25D366]"> 5 Contas Simultâneas</span>
            <br />
            Envie milhares de mensagens sem risco de ban, 100% no seu computador.
          </p>
        </FadeIn>

        {/* CTAs */}
        <FadeIn delay={0.3} className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-16">
          <a href="#pricing"
            className="group flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-[#25D366] text-black font-bold text-sm hover:bg-[#1fbd5a] transition-all glow-green">
            Começar Agora
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </a>
          <a href="#features"
            className="flex items-center gap-2 px-6 py-3.5 rounded-2xl glass border border-white/10 text-sm text-white/70 hover:text-white hover:border-white/20 transition-all">
            Ver recursos
            <ChevronRight className="w-4 h-4" />
          </a>
        </FadeIn>

        {/* Social proof */}
        <FadeIn delay={0.35} className="flex items-center justify-center gap-6 mb-8 flex-wrap">
          {[
            { icon: <Shield className="w-3.5 h-3.5" />, text: "Anti-ban integrado" },
            { icon: <Lock className="w-3.5 h-3.5" />, text: "Dados 100% locais" },
            { icon: <Zap className="w-3.5 h-3.5" />, text: "5 contas simultâneas" },
          ].map((item) => (
            <div key={item.text} className="flex items-center gap-1.5 text-xs text-white/40">
              <span className="text-[#25D366]">{item.icon}</span>
              {item.text}
            </div>
          ))}
        </FadeIn>

        {/* Windows exclusivo */}
        <FadeIn delay={0.4} className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm">
            <div className="w-2 h-2 rounded-full bg-[#25D366] animate-pulse"></div>
            <span className="text-xs text-white/60">Exclusivo para Windows 10/11</span>
          </div>
        </FadeIn>

      </div>
    </section>
  );
}

// ─── Features Bento Grid ──────────────────────────────────────────────────────
const features = [
  {
    icon: <Users className="w-6 h-6" />,
    title: "Multi-contas",
    desc: "Conecte até 5 números de WhatsApp simultaneamente. Cada conta opera de forma independente com dados isolados.",
    large: true,
    accent: true,
  },
  {
    icon: <Send className="w-6 h-6" />,
    title: "Disparo em Massa",
    desc: "Envie mensagens, imagens, vídeos e PDFs para milhares de contatos. Importe listas TXT ou CSV.",
    large: false,
  },
  {
    icon: <Shield className="w-6 h-6" />,
    title: "Proteção Anti-Ban",
    desc: "Delay aleatório, simulação de digitação, presença online e limites por hora/dia para proteger sua conta.",
    large: false,
    accent: true,
  },
  {
    icon: <MessageSquare className="w-6 h-6" />,
    title: "Mensagens Dinâmicas",
    desc: "Use variáveis {nome}, {data}, {hora} para personalizar cada mensagem automaticamente.",
    large: false,
  },
  {
    icon: <Calendar className="w-6 h-6" />,
    title: "Agendamentos",
    desc: "Crie campanhas que disparam sozinhas: diário, semanal, mensal ou por intervalo de tempo.",
    large: true,
  },
  {
    icon: <Bot className="w-6 h-6" />,
    title: "Auto-Resposta",
    desc: "Responda automaticamente com base em palavras-chave. Funciona em grupos e conversas privadas.",
    large: false,
  },
  {
    icon: <Database className="w-6 h-6" />,
    title: "Dados Locais",
    desc: "Nenhum dado sai do seu computador. Sessões e campanhas salvas localmente com reconexão automática.",
    large: false,
  },
];

function FeatureCard({ feature }: { feature: typeof features[0] }) {
  return (
    <motion.div
      variants={staggerItem}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className={`relative group rounded-2xl p-6 glass border transition-all duration-300
        ${feature.accent
          ? "border-[#25D366]/20 hover:border-[#25D366]/40 bg-[#25D366]/[0.03]"
          : "border-white/5 hover:border-white/10"
        }
        ${feature.large ? "md:col-span-2" : ""}
      `}
    >
      {feature.accent && (
        <div className="absolute inset-0 bg-[#25D366]/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
      )}
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 transition-all
        ${feature.accent ? "bg-[#25D366]/15 text-[#25D366] group-hover:bg-[#25D366]/25" : "bg-white/5 text-white/60 group-hover:text-white group-hover:bg-white/10"}`}>
        {feature.icon}
      </div>
      <h3 className="text-base font-semibold text-white mb-2">{feature.title}</h3>
      <p className="text-sm text-white/50 leading-relaxed">{feature.desc}</p>
    </motion.div>
  );
}

function Features() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.1 });

  return (
    <section id="features" className="py-24 px-4 relative">
      <div className="absolute top-1/2 right-0 w-[400px] h-[400px] bg-[#25D366]/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-6xl mx-auto">
        <FadeIn className="text-center mb-16">
          <p className="text-xs font-semibold text-[#25D366] uppercase tracking-widest mb-3">Recursos</p>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight mb-4">
            Tudo que você precisa<br />
            <span className="gradient-text">em um só lugar</span>
          </h2>
          <p className="text-white/50 max-w-md mx-auto text-sm">
            Ferramentas profissionais para automação de WhatsApp sem complicação.
          </p>
        </FadeIn>

        <motion.div
          ref={ref}
          variants={staggerContainer}
          initial="hidden"
          animate={inView ? "show" : "hidden"}
          className="grid grid-cols-1 md:grid-cols-4 gap-4"
        >
          {features.map((f) => (
            <FeatureCard key={f.title} feature={f} />
          ))}
        </motion.div>
      </div>
    </section>
  );
}

// ─── How It Works / Checklist ─────────────────────────────────────────────────
const checkItems = [
  { title: "Agendamentos automáticos", desc: "Diário, semanal, mensal ou por intervalo. Campanhas que disparam sozinhas no horário certo." },
  { title: "Gestão de grupos", desc: "Extraia todos os participantes de qualquer grupo e exporte em CSV com um clique." },
  { title: "Auto-resposta inteligente", desc: "Gatilhos por palavra-chave com cooldown, resposta única por contato e variáveis dinâmicas." },
  { title: "Variáveis dinâmicas", desc: "Personalize com {nome}, {numero}, {data}, {hora}, {campanha} — cada mensagem é única." },
  { title: "Sistema anti-ban inteligente", desc: "Delay aleatório ou progressivo, simulação de digitação, limite por hora e por dia." },
  { title: "Dados armazenados localmente", desc: "Nenhum servidor externo. Tudo no seu PC — sessões, campanhas e regras persistem entre reinicializações." },
  { title: "Múltiplas mensagens em sequência", desc: "Envie 2, 3 ou mais mensagens para o mesmo número com delay configurável entre elas." },
  { title: "Reenvio automático de falhas", desc: "Mensagens que falharam são reenviadas automaticamente com delay e número de tentativas configuráveis." },
];

function HowItWorks() {
  const listRef = useRef(null);
  const listInView = useInView(listRef, { once: true, amount: 0.1 });

  return (
    <section id="how" className="py-24 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          {/* Left */}
          <FadeIn>
            <p className="text-xs font-semibold text-[#25D366] uppercase tracking-widest mb-3">Como funciona</p>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-4">
              Automação completa,<br />
              <span className="gradient-text">sem complicação</span>
            </h2>
            <p className="text-white/50 text-sm leading-relaxed mb-8">
              Configure uma vez e deixe o sistema trabalhar por você. Cada detalhe foi pensado para maximizar entregas e minimizar bloqueios.
            </p>
            <a href="#pricing"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#25D366] text-black font-semibold text-sm hover:bg-[#1fbd5a] transition-all glow-green-sm">
              Quero começar <ArrowRight className="w-4 h-4" />
            </a>
          </FadeIn>

          {/* Right: checklist */}
          <motion.div
            ref={listRef}
            variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } } }}
            initial="hidden"
            animate={listInView ? "show" : "hidden"}
            className="space-y-3"
          >
            {checkItems.map((item) => (
              <motion.div
                key={item.title}
                variants={staggerItemLeft}
                className="flex gap-3 p-4 rounded-xl glass border border-white/5 hover:border-[#25D366]/20 transition-colors group"
              >
                <div className="w-5 h-5 rounded-full bg-[#25D366]/15 border border-[#25D366]/30 flex items-center justify-center flex-shrink-0 mt-0.5 group-hover:bg-[#25D366]/25 transition-colors">
                  <Check className="w-3 h-3 text-[#25D366]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white mb-0.5">{item.title}</p>
                  <p className="text-xs text-white/40 leading-relaxed">{item.desc}</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// ─── Terminal Log Preview ─────────────────────────────────────────────────────
const logLines = [
  { type: "info",    text: "[CONNECTED] Conta session-1 ativa — 556799976269" },
  { type: "info",    text: "[CONNECTED] Conta session-2 ativa — 556799976270" },
  { type: "success", text: "[OK] Mensagem enviada → +55 11 99999-0001 (id: 3EB0A1)" },
  { type: "success", text: "[OK] Mensagem enviada → +55 21 98888-0002 (id: 3EB0A2)" },
  { type: "wait",    text: "[WAIT] Aguardando fila... delay: 2.3s" },
  { type: "success", text: "[OK] Mensagem enviada → +55 31 97777-0003 (id: 3EB0A3)" },
  { type: "success", text: "[OK] Mensagem enviada → +55 41 96666-0004 (id: 3EB0A4)" },
  { type: "error",   text: "[ERROR] Falha no envio → +55 51 95555-0005 — retrying..." },
  { type: "wait",    text: "[WAIT] Aguardando fila... delay: 1.8s" },
  { type: "success", text: "[OK] Reenvio bem-sucedido → +55 51 95555-0005 (id: 3EB0A5)" },
  { type: "success", text: "[OK] Mensagem enviada → +55 61 94444-0006 (id: 3EB0A6)" },
  { type: "info",    text: "[SCHEDULER] Campanha 'Promo Semanal' agendada → cron: 0 9 * * 1" },
  { type: "success", text: "[OK] Mensagem enviada → +55 71 93333-0007 (id: 3EB0A7)" },
  { type: "info",    text: "[DONE] Disparo concluído: 1189 enviados, 58 falhas" },
];

const logColors = {
  success: "text-[#25D366]",
  error:   "text-red-400",
  wait:    "text-yellow-400",
  info:    "text-blue-400",
};


// ─── Pricing ──────────────────────────────────────────────────────────────────
const plans = [
  {
    name: "Mensal",
    price: "R$ 39",
    period: "/mês",
    badge: "Para testar",
    badgeColor: "bg-blue-500/20 text-blue-400 border border-blue-500/30",
    featured: false,
    items: [
      "5 contas simultâneas",
      "Disparo em massa ilimitado",
      "Agendamentos automáticos",
      "Auto-resposta inteligente",
      "Gestão de grupos",
      "Proteção anti-ban básica",
      "Atualizações mensais",
      "Suporte via email",
    ],
  },
  {
    name: "Anual",
    price: "R$ 79",
    period: "/ano",
    badge: "Popular",
    badgeColor: "bg-[#25D366]/20 text-[#25D366] border border-[#25D366]/30",
    featured: true,
    items: [
      "5 contas simultâneas",
      "Disparo em massa ilimitado",
      "Agendamentos automáticos",
      "Auto-resposta inteligente",
      "Gestão de grupos",
      "Proteção anti-ban avançada",
      "Atualizações por 1 ano",
      "Suporte prioritário",
      "Economia de 83% vs mensal",
    ],
  },
  {
    name: "Vitalício",
    price: "R$ 199",
    period: "único",
    badge: "Melhor valor",
    badgeColor: "bg-purple-500/20 text-purple-400 border border-purple-500/30",
    featured: false,
    items: [
      "5 contas simultâneas",
      "Disparo em massa ilimitado",
      "Agendamentos automáticos",
      "Auto-resposta inteligente",
      "Gestão de grupos",
      "Proteção anti-ban premium",
      "Atualizações vitalícias",
      "Suporte prioritário + WhatsApp",
      "Economia vitalícia",
    ],
  },
];

function Pricing() {
  const [loading, setLoading] = useState<string | null>(null);
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.2 });

  async function handleCheckout(plan: "monthly" | "annual" | "lifetime") {
    setLoading(plan);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json() as { url?: string; error?: string };
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error ?? "Erro ao iniciar checkout");
      }
    } catch {
      alert("Erro de conexão. Tente novamente.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <section id="pricing" className="py-24 px-4 relative">
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-[#25D366]/6 rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-4xl mx-auto">
        <FadeIn className="text-center mb-16">
          <p className="text-xs font-semibold text-[#25D366] uppercase tracking-widest mb-3">Preços</p>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight mb-4">
            Investimento único,<br />
            <span className="gradient-text">resultado contínuo</span>
          </h2>
          <p className="text-white/50 text-sm">Garantia de 7 dias. Sem mensalidade surpresa.</p>
        </FadeIn>

        <motion.div
          ref={ref}
          variants={staggerContainer}
          initial="hidden"
          animate={inView ? "show" : "hidden"}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start"
        >
          {plans.map((plan) => {
            const planKeyMap: Record<string, "monthly" | "annual" | "lifetime"> = {
              "Mensal": "monthly",
              "Anual": "annual",
              "Vitalício": "lifetime",
            };
            const planKey = planKeyMap[plan.name];
            const isLoading = loading === planKey;
            return (
              <motion.div
                key={plan.name}
                variants={staggerItem}
                className={`relative rounded-2xl p-7 transition-all duration-300
                  ${plan.featured
                    ? "glass border border-[#25D366]/30 glow-green"
                    : "glass border border-white/8 hover:border-white/15"
                  }
                `}
              >
                {plan.featured && (
                  <div className="absolute inset-0 bg-[#25D366]/[0.04] rounded-2xl pointer-events-none" />
                )}

                <div className="relative">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-base font-semibold text-white">{plan.name}</h3>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${plan.badgeColor}`}>
                      {plan.badge}
                    </span>
                  </div>

                  <div className="flex items-end gap-1 mb-1">
                    <span className={`text-4xl font-black ${plan.featured ? "text-[#25D366] text-glow" : "text-white"}`}>
                      {plan.price}
                    </span>
                    <span className="text-white/40 text-sm mb-1">{plan.period}</span>
                  </div>
                  <p className="text-xs text-white/30 mb-7">Pagamento único • Sem mensalidade</p>

                  <ul className="space-y-3 mb-8">
                    {plan.items.map((item) => (
                      <li key={item} className="flex items-center gap-2.5 text-sm text-white/70">
                        <Check className={`w-4 h-4 flex-shrink-0 ${plan.featured ? "text-[#25D366]" : "text-white/40"}`} />
                        {item}
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => handleCheckout(planKey)}
                    disabled={!!loading}
                    className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed
                      ${plan.featured
                        ? "bg-[#25D366] text-black hover:bg-[#1fbd5a] glow-green"
                        : "glass border border-white/10 text-white hover:border-white/20"
                      }
                    `}
                  >
                    {isLoading ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Aguarde...</>
                    ) : (
                      plan.featured ? "Comprar Agora" : "Escolher Plano"
                    )}
                  </button>
                </div>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Guarantee */}
        <FadeIn delay={0.3} className="text-center mt-8">
          <div className="inline-flex items-center gap-2 text-xs text-white/40">
            <Shield className="w-3.5 h-3.5 text-[#25D366]" />
            Garantia de 7 dias — se não gostar, devolvemos seu dinheiro
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

// ─── Testimonials ─────────────────────────────────────────────────────────────
const testimonials = [
  {
    text: "Comecei a usar o DisparaZapp na minha loja e em 3 dias já tinha vendido mais do que na semana inteira. O disparo em massa é absurdamente rápido.",
    name: "Lucas Mendes",
    role: "Dono de loja virtual",
    avatar: "LM",
  },
  {
    text: "Tentei vários bots antes e todos me deram ban. Com o DisparaZapp uso há 2 meses sem nenhum problema. O anti-ban realmente funciona.",
    name: "Fernanda Rocha",
    role: "Gestora de tráfego",
    avatar: "FR",
  },
  {
    text: "O agendamento automático mudou minha rotina. Configuro as campanhas no domingo e a semana toda roda sozinha. Economizo horas por dia.",
    name: "Rafael Souza",
    role: "Infoprodutor",
    avatar: "RS",
  },
  {
    text: "Uso para disparar promoções da minha clínica. Os pacientes respondem muito mais rápido do que por email. Retorno imediato.",
    name: "Dra. Camila Torres",
    role: "Clínica estética",
    avatar: "CT",
  },
  {
    text: "Suporte via WhatsApp resolveu minha dúvida em menos de 10 minutos. Produto sólido e atendimento rápido. Recomendo sem hesitar.",
    name: "Patrícia Lima",
    role: "Consultora de vendas",
    avatar: "PL",
  },
];

function TestimonialCard({ t }: { t: typeof testimonials[0] }) {
  return (
    <div className="flex-shrink-0 w-72 sm:w-80 glass border border-white/8 rounded-2xl p-6 mx-3">
      <p className="text-sm text-white/60 leading-relaxed mb-5">"{t.text}"</p>
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-[#25D366]/20 border border-[#25D366]/30 flex items-center justify-center text-xs font-bold text-[#25D366]">
          {t.avatar}
        </div>
        <div>
          <p className="text-sm font-semibold text-white">{t.name}</p>
          <p className="text-xs text-white/40">{t.role}</p>
        </div>
      </div>
    </div>
  );
}

function Testimonials() {
  const doubled = [...testimonials, ...testimonials];
  return (
    <section className="py-24 overflow-hidden">
      <FadeIn className="text-center mb-12 px-4">
        <p className="text-xs font-semibold text-[#25D366] uppercase tracking-widest mb-3">Depoimentos</p>
        <h2 className="text-3xl sm:text-4xl font-black tracking-tight">
          Além das expectativas,<br />
          <span className="gradient-text">na prática</span>
        </h2>
      </FadeIn>

      <div className="relative">
        {/* fade edges */}
        <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-[#050505] to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-[#050505] to-transparent z-10 pointer-events-none" />

        <motion.div
          className="flex"
          animate={{ x: ["0%", "-50%"] }}
          transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
        >
          {doubled.map((t, i) => (
            <TestimonialCard key={i} t={t} />
          ))}
        </motion.div>
      </div>
    </section>
  );
}

// ─── Final CTA ────────────────────────────────────────────────────────────────
function FinalCTA() {
  return (
    <section className="py-24 px-4 relative overflow-hidden">
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
        <span
          className="text-[clamp(80px,18vw,220px)] font-black text-white/[0.03] tracking-tighter leading-none whitespace-nowrap"
          aria-hidden
        >
          DisparaZapp
        </span>
      </div>

      <div className="relative z-10 max-w-2xl mx-auto text-center">
        <FadeIn>
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-tight leading-[1.05] mb-6">
            Automação real,<br />
            <span className="gradient-text text-glow">disponível agora.</span>
          </h2>
          <p className="text-white/50 text-base mb-10 max-w-md mx-auto">
            Comece hoje mesmo. Sem mensalidade, sem servidor, sem complicação.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href="#pricing"
              className="group flex items-center gap-2 px-8 py-4 rounded-2xl bg-[#25D366] text-black font-bold text-sm hover:bg-[#1fbd5a] transition-all glow-green"
            >
              Comprar Agora
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </a>
            <a
              href="#features"
              className="flex items-center gap-2 px-8 py-4 rounded-2xl glass border border-white/10 text-sm text-white/70 hover:text-white hover:border-white/20 transition-all"
            >
              Ver recursos
              <ChevronRight className="w-4 h-4" />
            </a>
          </div>
          <p className="mt-6 text-xs text-white/25">
            Garantia de 7 dias • Pagamento único • Suporte via WhatsApp
          </p>
        </FadeIn>
      </div>
    </section>
  );
}

// ─── FAQ ─────────────────────────────────────────────────────────────────────
function FAQ() {
  const faqs = [
    {
      question: "O DisparaZapp pode banir minha conta do WhatsApp?",
      answer: "Não. O DisparaZapp tem proteção anti-ban inteligente que simula comportamento humano real: delays aleatórios, digitação simulada, presença online e limites seguros por hora/dia. Usamos há meses sem nenhum ban."
    },
    {
      question: "Como funciona o anti-ban?",
      answer: "O sistema usa múltiplas camadas de proteção: delays progressivos entre envios, simulação de digitação, presença online constante, limites configuráveis por hora/dia, e comportamento que imita um usuário real usando o WhatsApp Web."
    },
    {
      question: "É compatível com qual versão do Windows?",
      answer: "Exclusivo para Windows 10 e 11 (64-bit). Não funciona em Mac, Linux ou versões antigas do Windows."
    },
    {
      question: "Quantas mensagens posso enviar por dia com segurança?",
      answer: "Recomendamos até 200-300 mensagens por conta por dia para máxima segurança. O sistema permite configurar limites automáticos para não exceder."
    },
    {
      question: "Preciso deixar o computador ligado?",
      answer: "Sim, o DisparaZapp roda 100% no seu PC. Para agendamentos automáticos, o computador precisa estar ligado na hora programada."
    },
    {
      question: "Como funciona o suporte?",
      answer: "Oferecemos suporte via WhatsApp para planos Anual e Vitalício, e email para o plano Mensal. Tempo médio de resposta: menos de 1 hora em horário comercial."
    },
    {
      question: "Posso usar em mais de 5 contas?",
      answer: "Cada licença permite até 5 contas simultâneas. Para mais contas, é necessário adquirir licenças adicionais."
    },
    {
      question: "A licença é vitalícia mesmo?",
      answer: "Sim, o plano Vitalício inclui atualizações e suporte vitalícios. Os planos Mensal e Anual têm atualizações apenas durante o período contratado."
    }
  ];

  return (
    <section className="py-24 px-4">
      <div className="max-w-3xl mx-auto">
        <FadeIn className="text-center mb-12">
          <p className="text-xs font-semibold text-[#25D366] uppercase tracking-widest mb-3">FAQ</p>
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight">
            Perguntas frequentes,<br />
            <span className="gradient-text">respostas claras</span>
          </h2>
        </FadeIn>

        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <FadeIn key={index} delay={index * 0.05}>
              <div className="glass border border-white/8 rounded-xl p-5 hover:border-white/15 transition-all">
                <h3 className="text-base font-semibold text-white mb-2">{faq.question}</h3>
                <p className="text-sm text-white/60 leading-relaxed">{faq.answer}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Windows Banner ───────────────────────────────────────────────────────────
function WindowsBanner() {
  return (
    <FadeIn className="px-4 py-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-center gap-3 px-5 py-3.5 rounded-2xl glass border border-yellow-500/20 bg-yellow-500/[0.03]">
          <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0" />
          <p className="text-sm text-white/60">
            <span className="text-yellow-400 font-semibold">Atenção:</span>{" "}
            Sistema disponível exclusivamente para{" "}
            <span className="text-white font-semibold">Windows</span>
          </p>
        </div>
      </div>
    </FadeIn>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer className="border-t border-white/5 py-10 px-4">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#25D366] flex items-center justify-center">
            <Zap className="w-3.5 h-3.5 text-black" fill="black" />
          </div>
          <span className="font-bold text-sm">
            Dispara<span className="text-[#25D366]">Zapp</span>
          </span>
        </div>
        <p className="text-xs text-white/30">
          © 2025 DisparaZapp. Todos os direitos reservados.
        </p>
        <div className="flex items-center gap-1.5 text-xs text-white/30">
          <Shield className="w-3 h-3 text-[#25D366]" />
          Garantia de 7 dias
        </div>
      </div>
    </footer>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function Page() {
  return (
    <main className="relative overflow-x-hidden">
      <Header />
      <Hero />
      <Features />
      <HowItWorks />
      <Pricing />
      <Testimonials />
      <FAQ />
      <FinalCTA />
      <WindowsBanner />
      <Footer />
    </main>
  );
}
