import { motion } from 'framer-motion';
import { Users, UserSearch } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

export interface ActivityItem {
  id: string;
  text: string;
  type: 'info' | 'success' | 'warn';
  ts: number;
}

interface Props {
  status: 'idle' | 'running' | 'paused' | 'done';
  currentGroup: string;
  currentMember: string;
  collected: number;
  totalMembers: number;
  groupsDone: number;
  totalGroups: number;
  activity: ActivityItem[];
}

const TYPE_COLOR = {
  info: 'text-sky-400',
  success: 'text-wa-green',
  warn: 'text-yellow-400',
};

const STATUS_LABEL: Record<Props['status'], { label: string; color: string }> = {
  idle: { label: 'Aguardando', color: 'bg-slate-600' },
  running: { label: 'Executando', color: 'bg-wa-green animate-pulse' },
  paused: { label: 'Pausado', color: 'bg-yellow-400' },
  done: { label: 'Concluído', color: 'bg-wa-green' },
};

export function ExtractionViewer({ status, currentGroup, currentMember, collected, totalMembers, groupsDone, totalGroups, activity }: Props) {
  const progress = totalMembers > 0 ? Math.min((collected / totalMembers) * 100, 100) : 0;
  const { label, color } = STATUS_LABEL[status];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col h-full gap-3"
    >
      {/* Status header */}
      <div className="rounded-xl border border-wa-border bg-wa-card p-4 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <UserSearch className="w-4 h-4 text-wa-green" />
            <p className="text-sm font-semibold text-wa-text">Live Extraction</p>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${color}`} />
            <span className="text-xs text-wa-muted/80">{label}</span>
          </div>
        </div>

        {/* Current group */}
        <div className="flex flex-col gap-1 mb-3">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-wa-muted">Grupo atual</span>
            <span className="text-wa-muted">{groupsDone} / {totalGroups} grupos</span>
          </div>
          <p className={`text-sm font-medium truncate ${currentGroup ? 'text-wa-text' : 'text-wa-muted'}`}>
            {currentGroup || '—'}
          </p>
        </div>

        {/* Current member */}
        <div className="flex flex-col gap-1 mb-3">
          <span className="text-[11px] text-wa-muted">Processando membro</span>
          <p className={`text-xs truncate ${currentMember ? 'text-wa-green' : 'text-wa-muted'}`}>
            {currentMember || '—'}
          </p>
        </div>

        {/* Progress */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-wa-muted">Contatos coletados</span>
            <span className="text-wa-text font-semibold">{collected} <span className="text-wa-muted font-normal">/ {totalMembers || '?'}</span></span>
          </div>
          <div className="h-1.5 rounded-full bg-[var(--color-borderColor)] overflow-hidden">
            <motion.div
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className={`h-full rounded-full ${status === 'done' ? 'bg-wa-green' : status === 'paused' ? 'bg-yellow-400' : 'bg-gradient-to-r from-[var(--color-accentSuccess)] to-emerald-400'}`}
            />
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 flex-shrink-0">
        {[
          { label: 'Grupos', value: totalGroups },
          { label: 'Coletados', value: collected },
          { label: 'Progresso', value: `${Math.round(progress)}%` },
        ].map(s => (
          <div key={s.label} className="rounded-xl border border-wa-border bg-wa-card p-3 text-center">
            <p className="text-base font-bold text-wa-text">{s.value}</p>
            <p className="text-[10px] text-wa-muted mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Activity feed */}
      <div className="flex-1 rounded-xl border border-wa-border bg-wa-card overflow-hidden flex flex-col min-h-0">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-wa-border bg-wa-bg/80 flex-shrink-0">
          <Users className="w-3.5 h-3.5 text-wa-muted" />
          <span className="text-[11px] text-wa-muted font-medium">Feed de atividade</span>
        </div>
        <ScrollArea className="flex-1 p-3">
          {activity.length === 0 ? (
            <p className="text-xs text-wa-muted italic">Aguardando início da extração...</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {[...activity].reverse().map(item => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-start gap-2"
                >
                  <span className="text-[10px] text-wa-muted flex-shrink-0 mt-0.5 font-mono">
                    {new Date(item.ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                  <span className={`text-xs ${TYPE_COLOR[item.type]}`}>{item.text}</span>
                </motion.div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>
    </motion.div>
  );
}

