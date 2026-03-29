import { motion } from 'framer-motion';
import { Send, TrendingUp, Users, Zap } from 'lucide-react';
import { useApp } from '@/context/AppContext';

interface KPICardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subtext?: string;
  color: 'green' | 'blue' | 'purple' | 'orange';
}

function KPICard({ icon, label, value, subtext, color }: KPICardProps) {
  const colorClasses = {
    green: 'hover:border-emerald-500/40 hover:bg-emerald-500/15',
    blue: 'hover:border-cyan-500/40 hover:bg-cyan-500/15',
    purple: 'hover:border-violet-500/40 hover:bg-violet-500/15',
    orange: 'hover:border-amber-500/40 hover:bg-amber-500/15',
  };

  const borderColors = {
    green: 'border-emerald-500/30 bg-gradient-to-br from-emerald-500/8 via-transparent to-transparent',
    blue: 'border-cyan-500/30 bg-gradient-to-br from-cyan-500/8 via-transparent to-transparent',
    purple: 'border-violet-500/30 bg-gradient-to-br from-violet-500/8 via-transparent to-transparent',
    orange: 'border-amber-500/30 bg-gradient-to-br from-amber-500/8 via-transparent to-transparent',
  };

  return (
    <motion.div
      whileHover={{ y: -2 }}
      className={`
        flex-1 rounded-xl border-2 p-5 
        backdrop-blur-sm transition-all duration-200
        hover:shadow-2xl hover:shadow-black/30
        ${borderColors[color]}
        ${colorClasses[color]}
      `}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <p className="text-xs font-semibold uppercase tracking-widest mb-3">{label}</p>
          <p className="text-3xl font-bold">{value}</p>
          {subtext && <p className="text-xs text-neutral-400 mt-2 font-medium">{subtext}</p>}
        </div>
        <div className="flex-shrink-0 opacity-70 hover:opacity-100 transition-opacity">
          {icon}
        </div>
      </div>
    </motion.div>
  );
}

export function DashboardKPIs() {
  const { activeSessionId, bulkProgress: bulkProgressMap } = useApp();
  const bulkProgress = (activeSessionId && bulkProgressMap[activeSessionId]) || null;
  const stats = bulkProgress?.stats;

  const deliveryRate = stats && (stats.sent + stats.failed) > 0
    ? Math.round((stats.sent / (stats.sent + stats.failed)) * 100)
    : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="grid grid-cols-4 gap-3 flex-shrink-0"
    >
      <KPICard
        icon={<Send className="w-5 h-5" />}
        label="Enviadas hoje"
        value={stats?.sent ?? 0}
        subtext="Mensagens"
        color="green"
      />
      <KPICard
        icon={<TrendingUp className="w-5 h-5" />}
        label="Taxa de entrega"
        value={`${deliveryRate}%`}
        subtext="Sucesso"
        color="blue"
      />
      <KPICard
        icon={<Users className="w-5 h-5" />}
        label="Contas ativas"
        value={0}
        subtext="Conectadas agora"
        color="purple"
      />
      <KPICard
        icon={<Zap className="w-5 h-5" />}
        label="Conversões"
        value={0}
        subtext="Hoje"
        color="orange"
      />
    </motion.div>
  );
}
