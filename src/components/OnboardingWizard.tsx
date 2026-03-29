/**
 * OnboardingWizard.tsx
 * Shown once on first launch. Stored in localStorage.
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Smartphone, Brain, CheckCircle2, ChevronRight, ChevronLeft, X } from 'lucide-react';
import { APP_NAME } from '@/lib/appConfig';
import { useThemeStyles } from '@/hooks/useThemeStyles';

const ONBOARDING_KEY = 'srb_onboarding_done';

export function useOnboarding() {
  const [show, setShow] = useState(() => localStorage.getItem(ONBOARDING_KEY) !== '1');

  const dismiss = () => {
    localStorage.setItem(ONBOARDING_KEY, '1');
    setShow(false);
  };

  return { show, dismiss };
}

interface Step {
  icon: React.ReactNode;
  title: string;
  description: string;
  color: string;
  tip?: string;
}

const STEPS: Step[] = [
  {
    icon: <Zap className="w-10 h-10" />,
    title: `Bem-vindo ao ${APP_NAME}`,
    description: 'Automação profissional de WhatsApp com IA, disparo em massa, extração de leads e muito mais.',
    color: 'text-[#25D366]',
    tip: 'Vamos te guiar pelos primeiros passos em menos de 2 minutos.',
  },
  {
    icon: <Smartphone className="w-10 h-10" />,
    title: 'Conecte seu WhatsApp',
    description: 'Vá até a aba "Sessões" na barra lateral e clique em "+ Nova Sessão". Escaneie o QR Code com seu celular.',
    color: 'text-blue-400',
    tip: 'Você pode conectar até 5 números diferentes simultaneamente.',
  },
  {
    icon: <Brain className="w-10 h-10" />,
    title: 'Configure a IA',
    description: 'Acesse "IA Atendimento" para configurar respostas automáticas com OpenAI, Claude, Groq ou Ollama.',
    color: 'text-violet-400',
    tip: 'A IA responde automaticamente, qualifica leads e transfere para humanos quando necessário.',
  },
  {
    icon: <CheckCircle2 className="w-10 h-10" />,
    title: 'Tudo pronto!',
    description: 'Você está pronto para começar. Explore as ferramentas no menu lateral.',
    color: 'text-emerald-400',
    tip: 'Dica: use o atalho Ctrl+, para abrir as configurações a qualquer momento.',
  },
];

interface Props {
  onDone: () => void;
}

export function OnboardingWizard({ onDone }: Props) {
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const themeStyles = useThemeStyles();

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const go = (next: number) => {
    setDir(next > step ? 1 : -1);
    setStep(next);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        style={{
          backgroundColor: themeStyles.bg.secondary,
          borderColor: themeStyles.border,
        }}
        className="w-full max-w-lg mx-4 border-2 rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Progress bar */}
        <div style={{ backgroundColor: themeStyles.border }}>
          <motion.div
            style={{ backgroundColor: themeStyles.accent.success }}
            animate={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
            transition={{ duration: 0.3 }}
            className="h-1"
          />
        </div>

        {/* Skip */}
        <div className="flex justify-end px-6 pt-4">
          <button onClick={onDone} style={{ color: themeStyles.text.secondary }} className="hover:opacity-70 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step content */}
        <div className="px-8 pb-8 pt-2 min-h-[280px] flex flex-col">
          <AnimatePresence mode="wait" custom={dir}>
            <motion.div
              key={step}
              custom={dir}
              initial={{ opacity: 0, x: dir * 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: dir * -40 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col items-center text-center gap-4 flex-1"
            >
              <div 
                style={{ 
                  backgroundColor: `${themeStyles.accent.primary}15`,
                  borderColor: themeStyles.accent.primary,
                }}
                className={`p-4 rounded-2xl border-2 ${current.color}`}
              >
                {current.icon}
              </div>
              <h2 style={{ color: themeStyles.text.primary }} className="text-xl font-bold">{current.title}</h2>
              <p style={{ color: themeStyles.text.secondary }} className="text-sm leading-relaxed max-w-sm">{current.description}</p>
              {current.tip && (
                <div 
                  style={{ 
                    backgroundColor: `${themeStyles.accent.success}15`,
                    borderColor: themeStyles.accent.success,
                  }}
                  className="flex items-start gap-2 px-4 py-3 border rounded-xl text-left w-full"
                >
                  <Zap style={{ color: themeStyles.accent.success }} className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                  <p style={{ color: themeStyles.text.secondary }} className="text-xs">{current.tip}</p>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Dots */}
          <div className="flex items-center justify-center gap-1.5 mt-6 mb-4">
            {STEPS.map((_, i) => (
              <button
                key={i}
                onClick={() => go(i)}
                style={{
                  backgroundColor: i === step ? themeStyles.accent.success : themeStyles.border,
                }}
                className="rounded-full transition-all hover:opacity-70"
              />
            ))}
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-3">
            {step > 0 && (
              <button
                onClick={() => go(step - 1)}
                style={{ 
                  borderColor: themeStyles.border,
                  color: themeStyles.text.primary,
                }}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border-2 hover:opacity-70 transition-all text-sm font-medium"
              >
                <ChevronLeft className="w-4 h-4" />Voltar
              </button>
            )}
            <button
              onClick={() => isLast ? onDone() : go(step + 1)}
              style={{ backgroundColor: themeStyles.accent.success }}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl hover:opacity-90 text-white font-semibold text-sm transition-all"
            >
              {isLast ? 'Começar agora' : 'Próximo'}
              {!isLast && <ChevronRight className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
