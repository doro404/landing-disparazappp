import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, Sliders, Shield, MessageSquare, Clock, Zap } from 'lucide-react';
import { Input } from './ui/input';
import { Switch } from './ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { cn } from '@/lib/utils';

export interface DisparoOptions {
  // Delay
  delayMin: number;
  delayMax: number;
  delayMode: 'random' | 'fixed' | 'progressive';
  progressiveStep: number; // ms a mais a cada N mensagens

  // Múltiplas mensagens em sequência
  interMessageDelay: number; // delay entre mensagens da sequência (ms)

  // Lotes
  batchSize: number;       // enviar N por vez
  batchPause: number;      // pausa entre lotes (ms)

  // Limites
  limitPerHour: number;
  limitPerDay: number;

  // Comportamento Baileys
  simulateTyping: boolean;
  typingDuration: number;  // ms
  markAsRead: boolean;
  sendPresence: boolean;   // enviar "online" antes de cada msg

  // Personalização
  useNameVar: boolean;     // substituir {nome} pelo nome do contato
  randomizeOrder: boolean; // embaralhar lista antes de enviar
  skipDuplicates: boolean;

  // Retry
  retryFailed: boolean;
  retryDelay: number;
  maxRetries: number;
}

export const DEFAULT_DISPARO_OPTIONS: DisparoOptions = {
  delayMin: 1200,
  delayMax: 3500,
  delayMode: 'random',
  progressiveStep: 100,
  interMessageDelay: 1000,
  batchSize: 0,
  batchPause: 60000,
  limitPerHour: 200,
  limitPerDay: 1000,
  simulateTyping: true,
  typingDuration: 1500,
  markAsRead: false,
  sendPresence: false,
  useNameVar: true,
  randomizeOrder: false,
  skipDuplicates: true,
  retryFailed: true,
  retryDelay: 5000,
  maxRetries: 2,
};

interface SectionProps {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}

function Section({ icon, title, children }: SectionProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2.5 text-[13px] font-bold uppercase tracking-wider" style={{ color: 'var(--color-textSecondary)' }}>
        {icon}{title}
      </div>
      <div className="grid grid-cols-2 gap-4">
        {children}
      </div>
    </div>
  );
}

interface FieldProps {
  label: string;
  hint?: string;
  children: React.ReactNode;
  full?: boolean;
}

function Field({ label, hint, children, full }: FieldProps) {
  return (
    <div className={cn('space-y-1.5', full && 'col-span-2')}>
      <label className="text-[13px] font-medium text-wa-text">{label}</label>
      {children}
      {hint && <p className="text-[10px] text-wa-text/50">{hint}</p>}
    </div>
  );
}

interface ToggleFieldProps {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}

function ToggleField({ label, hint, checked, onChange }: ToggleFieldProps) {
  return (
    <div className="col-span-2 flex items-center justify-between p-3.5 rounded-xl border" style={{ backgroundColor: 'var(--color-bgTertiary)', borderColor: 'var(--color-borderColor)' }}>
      <div>
        <p className="text-[13px] font-medium" style={{ color: 'var(--color-textPrimary)' }}>{label}</p>
        {hint && <p className="text-xs mt-0.5" style={{ color: 'var(--color-textSecondary)', opacity: 0.8 }}>{hint}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

interface DisparoConfigProps {
  options: DisparoOptions;
  onChange: (o: DisparoOptions) => void;
}

export function DisparoConfig({ options, onChange }: DisparoConfigProps) {
  const [open, setOpen] = useState(false);
  const set = (patch: Partial<DisparoOptions>) => onChange({ ...options, ...patch });

  return (
    <div className="rounded-[14px] border overflow-hidden" style={{ borderColor: 'var(--color-borderColor)' }}>
      {/* Header toggle */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-5 py-3.5 transition-colors duration-200"
        style={{ backgroundColor: 'var(--color-bgSecondary)' }}
        onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--color-bgTertiary)'}
        onMouseLeave={e => e.currentTarget.style.backgroundColor = 'var(--color-bgSecondary)'}
      >
        <div className="flex items-center gap-2.5 text-sm font-semibold" style={{ color: 'var(--color-textPrimary)' }}>
          <Sliders className="w-4 h-4 text-wa-green" />
          Configurações Avançadas de Disparo
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-wa-text/70">
            {options.delayMin/1000}s–{options.delayMax/1000}s • {options.limitPerHour}/h
            {options.simulateTyping && ' • typing'}
          </span>
          {open ? <ChevronUp className="w-4 h-4 text-wa-muted" /> : <ChevronDown className="w-4 h-4 text-wa-muted" />}
        </div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-5 space-y-6 border-t" style={{ borderColor: 'var(--color-borderColor)', backgroundColor: 'var(--color-bgTertiary)' }}>

              {/* ── Delay ── */}
              <Section icon={<Clock className="w-3.5 h-3.5" />} title="Delay entre mensagens">
                <Field label="Modo de delay" full>
                  <Select value={options.delayMode} onValueChange={(v) => set({ delayMode: v as DisparoOptions['delayMode'] })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="random">Aleatório (recomendado anti-ban)</SelectItem>
                      <SelectItem value="fixed">Fixo</SelectItem>
                      <SelectItem value="progressive">Progressivo (aumenta com o tempo)</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>

                <Field label="Mínimo (ms)" hint="1200ms = 1.2s">
                  <Input type="number" min={500} max={60000} value={options.delayMin}
                    onChange={(e) => set({ delayMin: +e.target.value })} />
                </Field>

                <Field label="Máximo (ms)" hint="3500ms = 3.5s">
                  <Input type="number" min={500} max={120000} value={options.delayMax}
                    onChange={(e) => set({ delayMax: +e.target.value })} />
                </Field>

                {options.delayMode === 'progressive' && (
                  <Field label="Incremento por mensagem (ms)" hint="Ex: 50ms a mais a cada envio" full>
                    <Input type="number" min={0} max={5000} value={options.progressiveStep}
                      onChange={(e) => set({ progressiveStep: +e.target.value })} />
                  </Field>
                )}

                <Field label="Delay entre msgs da sequência (ms)" hint="Pausa entre cada mensagem do mesmo número" full>
                  <Input type="number" min={0} max={30000} value={options.interMessageDelay}
                    onChange={(e) => set({ interMessageDelay: +e.target.value })} />
                </Field>
              </Section>

              {/* ── Lotes ── */}
              <Section icon={<Zap className="w-3.5 h-3.5" />} title="Envio em lotes">
                <Field label="Tamanho do lote" hint="0 = desativado (envio contínuo)">
                  <Input type="number" min={0} max={500} value={options.batchSize}
                    onChange={(e) => set({ batchSize: +e.target.value })} />
                </Field>

                <Field label="Pausa entre lotes (ms)" hint="60000ms = 1 minuto">
                  <Input type="number" min={1000} value={options.batchPause}
                    onChange={(e) => set({ batchPause: +e.target.value })} />
                </Field>

                <Field label="Limite por hora">
                  <Input type="number" min={1} max={1000} value={options.limitPerHour}
                    onChange={(e) => set({ limitPerHour: +e.target.value })} />
                </Field>

                <Field label="Limite por dia">
                  <Input type="number" min={1} max={10000} value={options.limitPerDay}
                    onChange={(e) => set({ limitPerDay: +e.target.value })} />
                </Field>
              </Section>

              {/* ── Comportamento Baileys ── */}
              <Section icon={<MessageSquare className="w-3.5 h-3.5" />} title="Comportamento WhatsApp">
                <ToggleField
                  label="Simular digitação"
                  hint="Envia 'digitando...' antes de cada mensagem"
                  checked={options.simulateTyping}
                  onChange={(v) => set({ simulateTyping: v })}
                />

                {options.simulateTyping && (
                  <Field label="Duração da digitação (ms)" hint="Tempo visível como 'digitando'">
                    <Input type="number" min={500} max={10000} value={options.typingDuration}
                      onChange={(e) => set({ typingDuration: +e.target.value })} />
                  </Field>
                )}

                <ToggleField
                  label="Marcar como lido antes de enviar"
                  hint="Simula que você leu a conversa"
                  checked={options.markAsRead}
                  onChange={(v) => set({ markAsRead: v })}
                />

                <ToggleField
                  label="Enviar presença 'online'"
                  hint="Aparece como online antes de cada envio"
                  checked={options.sendPresence}
                  onChange={(v) => set({ sendPresence: v })}
                />
              </Section>

              {/* ── Anti-ban / Segurança ── */}
              <Section icon={<Shield className="w-3.5 h-3.5" />} title="Anti-ban e segurança">
                <ToggleField
                  label="Embaralhar ordem da lista"
                  hint="Randomiza a sequência de envio"
                  checked={options.randomizeOrder}
                  onChange={(v) => set({ randomizeOrder: v })}
                />

                <ToggleField
                  label="Ignorar números duplicados"
                  hint="Remove duplicatas antes de enviar"
                  checked={options.skipDuplicates}
                  onChange={(v) => set({ skipDuplicates: v })}
                />

                <ToggleField
                  label="Usar variável {nome}"
                  hint="Substitui {nome} pelo nome do contato (se CSV)"
                  checked={options.useNameVar}
                  onChange={(v) => set({ useNameVar: v })}
                />

                <ToggleField
                  label="Retentar falhas automaticamente"
                  hint="Tenta reenviar mensagens que falharam"
                  checked={options.retryFailed}
                  onChange={(v) => set({ retryFailed: v })}
                />

                {options.retryFailed && (
                  <>
                    <Field label="Delay antes de retentar (ms)">
                      <Input type="number" min={1000} value={options.retryDelay}
                        onChange={(e) => set({ retryDelay: +e.target.value })} />
                    </Field>
                    <Field label="Máximo de tentativas">
                      <Input type="number" min={1} max={10} value={options.maxRetries}
                        onChange={(e) => set({ maxRetries: +e.target.value })} />
                    </Field>
                  </>
                )}
              </Section>

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
