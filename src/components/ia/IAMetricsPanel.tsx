import { BarChart3 } from 'lucide-react';

export function IAMetricsPanel() {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[300px] rounded-xl border border-wa-border bg-wa-card gap-3 text-center p-8">
      <div className="w-12 h-12 rounded-xl bg-violet-500/10 flex items-center justify-center">
        <BarChart3 className="w-6 h-6 text-violet-400/50" />
      </div>
      <p className="text-sm font-semibold text-wa-muted/80">Sem dados ainda</p>
      <p className="text-xs text-wa-muted max-w-xs">
        As métricas aparecerão aqui após a IA começar a atender conversas. Ative a IA e aguarde os primeiros atendimentos.
      </p>
    </div>
  );
}

