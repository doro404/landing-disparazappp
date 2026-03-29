import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Download, FileSpreadsheet, Copy, ExternalLink, CheckCircle, XCircle, Clock, ShieldCheck, Loader2, Users, LogIn } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

export interface FoundGroup {
  id: string;
  name: string;
  link: string;
  source: string;
  category?: string;
  description?: string;
  members?: number | null;
  status: 'valid' | 'expired' | 'private' | 'unknown' | 'site_only';
}

interface Props {
  groups: FoundGroup[];
  onValidate?: () => void;
  validating?: boolean;
  onlyValid?: boolean;
  onJoinGroups?: (links: string[]) => void;
}

const STATUS_CONFIG = {
  valid:     { label: 'Válido',   color: 'text-wa-green', icon: CheckCircle },
  expired:   { label: 'Expirado', color: 'text-red-400',   icon: XCircle },
  private:   { label: 'Privado',  color: 'text-yellow-400', icon: Clock },
  unknown:   { label: '—',        color: 'text-wa-muted',  icon: Clock },
  site_only: { label: 'Ver site', color: 'text-violet-400', icon: ExternalLink },
};

function exportCSV(groups: FoundGroup[]) {
  const header = 'Nome,Link,Fonte,Status\n';
  const rows = groups.map(g =>
    [g.name, g.link, g.source, STATUS_CONFIG[g.status].label]
      .map(v => `"${v.replace(/"/g, '""')}"`)
      .join(',')
  ).join('\n');
  const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'grupos-encontrados.csv'; a.click();
  URL.revokeObjectURL(url);
}

export function GroupsTable({ groups, onValidate, validating, onlyValid, onJoinGroups }: Props) {
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  // Quando onlyValid, copiar/exportar só inclui grupos válidos
  const exportGroups = onlyValid ? groups.filter(g => g.status === 'valid') : groups;

  // Links para o joiner: válidos com link WA direto
  const joinableLinks = groups
    .filter(g => g.link.includes('chat.whatsapp.com') && (g.status === 'valid' || g.status === 'unknown'))
    .map(g => g.link);

  const filtered = groups.filter(g =>
    (g.name + g.link + g.source).toLowerCase().includes(filter.toLowerCase())
  );
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <motion.div
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex flex-col h-full gap-3"
    >
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <p className="text-sm font-semibold text-wa-text">Grupos Encontrados</p>
          <p className="text-[11px] text-wa-muted">{groups.length} grupo{groups.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-1.5">
          {onValidate && (
            <button onClick={onValidate}
              disabled={groups.length === 0 || validating} title="Validar links"
              className="p-1.5 rounded-lg border border-wa-border bg-wa-card text-wa-muted/80 hover:text-violet-400 transition-colors disabled:opacity-30">
              {validating
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <ShieldCheck className="w-3.5 h-3.5" />}
            </button>
          )}
          {onJoinGroups && (
            <button
              onClick={() => onJoinGroups(joinableLinks)}
              disabled={joinableLinks.length === 0}
              title={`Entrar nos ${joinableLinks.length} grupos válidos`}
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg border border-wa-green/30 bg-wa-green/5 text-wa-green text-[10px] font-semibold hover:bg-wa-green/15 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
              <LogIn className="w-3 h-3" />
              Entrar ({joinableLinks.length})
            </button>
          )}
          <button onClick={() => navigator.clipboard.writeText(exportGroups.map(g => g.link).join('\n'))}
            disabled={exportGroups.length === 0} title={onlyValid ? 'Copiar links válidos' : 'Copiar links'}
            className="p-1.5 rounded-lg border border-wa-border bg-wa-card text-wa-muted/80 hover:text-wa-text transition-colors disabled:opacity-30">
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => exportCSV(exportGroups)} disabled={exportGroups.length === 0} title={onlyValid ? 'Exportar CSV (válidos)' : 'Exportar CSV'}
            className="p-1.5 rounded-lg border border-wa-border bg-wa-card text-wa-muted/80 hover:text-wa-green transition-colors disabled:opacity-30">
            <Download className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => exportCSV(exportGroups)} disabled={exportGroups.length === 0} title={onlyValid ? 'Exportar Excel (válidos)' : 'Exportar Excel'}
            className="p-1.5 rounded-lg border border-wa-border bg-wa-card text-wa-muted/80 hover:text-emerald-400 transition-colors disabled:opacity-30">
            <FileSpreadsheet className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative flex-shrink-0">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-wa-muted" />
        <input type="text" value={filter} onChange={e => { setFilter(e.target.value); setPage(0); }}
          placeholder="Filtrar grupos..."
          className="w-full bg-wa-card border border-wa-border rounded-lg pl-8 pr-3 py-2 text-xs text-wa-text placeholder:text-wa-muted focus:outline-none focus:border-wa-green/40" />
      </div>

      {/* Table */}
      <div className="flex-1 rounded-xl border border-wa-border bg-wa-card overflow-hidden flex flex-col min-h-0">
        <div className="grid grid-cols-[1fr_55px_70px_60px] gap-2 px-3 py-2 border-b border-wa-border bg-wa-bg/80 flex-shrink-0">
          <span className="text-[10px] font-semibold text-wa-muted uppercase tracking-wider">Grupo / Link</span>
          <span className="text-[10px] font-semibold text-wa-muted uppercase tracking-wider">Membros</span>
          <span className="text-[10px] font-semibold text-wa-muted uppercase tracking-wider">Fonte</span>
          <span className="text-[10px] font-semibold text-wa-muted uppercase tracking-wider">Status</span>
        </div>
        <ScrollArea className="flex-1">
          {paged.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <Search className="w-8 h-8 text-slate-700" />
              <p className="text-xs text-wa-text/70">{groups.length === 0 ? 'Nenhum grupo encontrado ainda' : 'Sem resultados'}</p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--color-borderColor)]/50">
              <AnimatePresence initial={false}>
                {paged.map(group => {
                  const sc = STATUS_CONFIG[group.status];
                  const Icon = sc.icon;
                  return (
                    <motion.div key={group.id}
                      initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                      className="grid grid-cols-[1fr_55px_70px_60px] gap-2 px-3 py-2.5 hover:bg-wa-bg/60 transition-colors items-center"
                    >
                      <div className="min-w-0">
                        <p className="text-xs text-wa-text font-medium truncate">{group.name}</p>
                        <a href={group.link} target="_blank" rel="noreferrer"
                          className="text-[10px] text-violet-400/70 hover:text-violet-400 truncate flex items-center gap-0.5 transition-colors"
                          onClick={e => e.stopPropagation()}>
                          <ExternalLink className="w-2.5 h-2.5 flex-shrink-0" />
                          <span className="truncate">
                            {group.status === 'site_only'
                              ? group.link.replace('https://gruposwpp.com.br/groups/', 'gruposwpp.com.br/').replace('https://gruposwhats.app/group/', 'gruposwhats.app #')
                              : group.link.replace('https://chat.whatsapp.com/', '')}
                          </span>
                        </a>
                        {group.category && (
                          <span className="text-[9px] text-wa-muted">{group.category}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-0.5">
                        {group.members != null
                          ? <><Users className="w-2.5 h-2.5 text-wa-muted flex-shrink-0" /><span className="text-[10px] text-wa-muted/80">{group.members}</span></>
                          : <span className="text-[10px] text-slate-700">—</span>
                        }
                      </div>
                      <span className="text-[10px] text-wa-muted truncate">{group.source}</span>
                      <div className="flex items-center gap-1">
                        <Icon className={`w-3 h-3 ${sc.color}`} />
                        <span className={`text-[10px] ${sc.color}`}>{sc.label}</span>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between flex-shrink-0">
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
            className="text-xs text-wa-muted/80 hover:text-wa-text disabled:opacity-30 transition-colors">← Anterior</button>
          <span className="text-[11px] text-wa-muted">{page + 1} / {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
            className="text-xs text-wa-muted/80 hover:text-wa-text disabled:opacity-30 transition-colors">Próximo →</button>
        </div>
      )}
    </motion.div>
  );
}

