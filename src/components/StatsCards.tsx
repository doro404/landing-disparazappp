import { motion } from 'framer-motion';
import { Users } from 'lucide-react';
import { useApp } from '@/context/AppContext';

export function StatsCards() {
  const { sessions } = useApp();
  const connectedCount = sessions.filter((s) => s.status === 'connected').length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="card-wa border bg-wa-teal/10 border-wa-teal/20 flex items-center gap-2 px-3 py-2 w-fit"
    >
      <Users className="w-4 h-4 flex-shrink-0 text-wa-teal" />
      <div className="min-w-0">
        <p className="text-sm font-bold leading-none text-wa-teal">{connectedCount}/5</p>
        <p className="text-[10px] text-wa-muted mt-0.5">Sessões Ativas</p>
      </div>
    </motion.div>
  );
}
