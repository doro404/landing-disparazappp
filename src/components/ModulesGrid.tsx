import { motion } from 'framer-motion';
import {
  Send, Bot, Calendar, BarChart3, MapPin, UserSearch,
  Telescope, LogIn, Brain, ArrowRight,
} from 'lucide-react';

type BadgeVariant = 'green' | 'blue' | 'purple' | 'orange' | 'amber';
type StatusVariant = 'active' | 'inactive' | 'beta';

interface ModuleCardProps {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  description: string;
  badge?: string;
  badgeVariant?: BadgeVariant;
  status?: StatusVariant;
  onClick?: () => void;
  index?: number;
}

const BADGE: Record<BadgeVariant, string> = {
  green:  'bg-emerald-500/10 text-emerald-500 ring-1 ring-emerald-500/25',
  blue:   'bg-cyan-500/10    text-cyan-400    ring-1 ring-cyan-500/25',
  purple: 'bg-violet-500/10  text-violet-400  ring-1 ring-violet-500/25',
  orange: 'bg-orange-500/10  text-orange-400  ring-1 ring-orange-500/25',
  amber:  'bg-amber-500/10   text-amber-400   ring-1 ring-amber-500/25',
};

const STATUS_DOT: Record<StatusVariant, string> = {
  active:   'bg-emerald-500',
  inactive: 'bg-wa-muted/40',
  beta:     'bg-amber-400',
};

const STATUS_LABEL: Record<StatusVariant, string> = {
  active:   'Ativo',
  inactive: 'Inativo',
  beta:     'Beta',
};

export function ModuleCard({
  icon, iconBg, title, description,
  badge, badgeVariant = 'blue',
  status = 'active',
  onClick,
  index = 0,
}: ModuleCardProps) {
  return (
    <motion.button
      onClick={onClick}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.98 }}
      className="group relative flex flex-col items-start gap-4 p-5 rounded-2xl text-left
                 focus:outline-none focus-visible:ring-2 focus-visible:ring-wa-green/40
                 transition-shadow duration-200
                 ring-1 ring-wa-border hover:ring-wa-green/30
                 bg-wa-card hover:shadow-lg"
    >
      {/* Icon + badge */}
      <div className="w-full flex items-start justify-between gap-2">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
          {icon}
        </div>
        {badge && (
          <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${BADGE[badgeVariant]}`}>
            {badge}
          </span>
        )}
      </div>

      {/* Text */}
      <div className="flex-1 space-y-1">
        <h3 className="text-sm font-semibold leading-tight text-wa-text group-hover:text-wa-green transition-colors duration-150">
          {title}
        </h3>
        <p className="text-xs leading-relaxed text-wa-muted line-clamp-2">
          {description}
        </p>
      </div>

      {/* Footer */}
      <div className="w-full flex items-center justify-between pt-3 border-t border-wa-border/60">
        <div className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[status]} ${status === 'active' ? 'animate-pulse' : ''}`} />
          <span className="text-[10px] font-medium text-wa-muted">{STATUS_LABEL[status]}</span>
        </div>
        <ArrowRight
          className="w-3.5 h-3.5 text-wa-muted group-hover:text-wa-green group-hover:translate-x-1 transition-all duration-150"
          strokeWidth={1.5}
        />
      </div>
    </motion.button>
  );
}

const MODULES = [
  { id: 'disparo',         icon: <Send className="w-5 h-5" strokeWidth={1.5} />,       iconBg: 'bg-emerald-500/10 text-emerald-500', title: 'Disparo em Massa',    description: 'Envie mensagens em escala com segurança e rastreamento completo.',    badge: 'Principal', badgeVariant: 'green'  as BadgeVariant, status: 'active' as StatusVariant },
  { id: 'autoresposta',    icon: <Bot className="w-5 h-5" strokeWidth={1.5} />,        iconBg: 'bg-violet-500/10 text-violet-400',  title: 'Auto-Resposta IA',    description: 'Respostas automáticas inteligentes para seus clientes.',             badge: '12 ativos', badgeVariant: 'purple' as BadgeVariant, status: 'active' as StatusVariant },
  { id: 'agendamento',     icon: <Calendar className="w-5 h-5" strokeWidth={1.5} />,   iconBg: 'bg-orange-500/10 text-orange-400',  title: 'Agendamentos',        description: 'Agende disparos de mensagens para datas específicas.',              badge: '3 próximos', badgeVariant: 'orange' as BadgeVariant, status: 'active' as StatusVariant },
  { id: 'stats',           icon: <BarChart3 className="w-5 h-5" strokeWidth={1.5} />,  iconBg: 'bg-cyan-500/10 text-cyan-400',      title: 'Estatísticas',        description: 'Análise completa de campanhas e performance de envio.',                                                                                    status: 'active' as StatusVariant },
  { id: 'maps',            icon: <MapPin className="w-5 h-5" strokeWidth={1.5} />,     iconBg: 'bg-red-500/10 text-red-400',        title: 'Google Maps',         description: 'Extraia leads e dados de locais diretamente do Google Maps.',                                                                                status: 'active' as StatusVariant },
  { id: 'group-extractor', icon: <UserSearch className="w-5 h-5" strokeWidth={1.5} />, iconBg: 'bg-emerald-500/10 text-emerald-500',title: 'Extrator de Grupos',  description: 'Extraia membros e informações de grupos WhatsApp.',                                                                                   status: 'active' as StatusVariant },
  { id: 'group-finder',    icon: <Telescope className="w-5 h-5" strokeWidth={1.5} />,  iconBg: 'bg-violet-500/10 text-violet-400',  title: 'Group Finder',        description: 'Encontre grupos públicos do WhatsApp por tópicos.',                  badge: 'Beta',      badgeVariant: 'amber'  as BadgeVariant, status: 'beta'   as StatusVariant },
  { id: 'group-joiner',    icon: <LogIn className="w-5 h-5" strokeWidth={1.5} />,      iconBg: 'bg-teal-500/10 text-teal-400',      title: 'Group Joiner',        description: 'Entre automaticamente em grupos selecionados.',                                                                                       status: 'active' as StatusVariant },
  { id: 'ia-atendimento',  icon: <Brain className="w-5 h-5" strokeWidth={1.5} />,      iconBg: 'bg-purple-500/10 text-purple-400',  title: 'IA Atendimento',      description: 'Atendimento automático com inteligência artificial.',                                                                                status: 'active' as StatusVariant },
];

interface ModulesGridProps {
  onTabChange: (tab: string) => void;
}

export function ModulesGrid({ onTabChange }: ModulesGridProps) {
  return (
    <div className="space-y-4 p-1">
      <p className="text-[10px] font-bold uppercase tracking-widest text-wa-muted flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-wa-green" />
        Ferramentas & Módulos
      </p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {MODULES.map((m, i) => (
          <ModuleCard
            key={m.id}
            index={i}
            icon={m.icon}
            iconBg={m.iconBg}
            title={m.title}
            description={m.description}
            badge={m.badge}
            badgeVariant={m.badgeVariant}
            status={m.status}
            onClick={() => onTabChange(m.id)}
          />
        ))}
      </div>
    </div>
  );
}
