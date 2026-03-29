import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Download, FileSpreadsheet, Copy, Star, Send, MessageCircle } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

export interface Lead {
  id: string;
  name: string;
  phone: string;
  website: string;
  address: string;
  rating: string;
  reviews: string;
  category?: string;
  hasWhatsapp?: boolean | null; // null = não verificado ainda
}

interface Props {
  leads: Lead[];
  onSendToBulk?: (numbers: string) => void;
  checkingWhatsapp?: boolean;
  onCheckWhatsapp?: () => void;
}

function exportCSV(leads: Lead[]) {
  const header = 'Nome,Telefone,Website,Endereço,Avaliação,Avaliações,Categoria,WhatsApp\n';
  const rows = leads.map(l =>
    [l.name, l.phone, l.website, l.address, l.rating, l.reviews, l.category ?? '', l.hasWhatsapp === true ? 'Sim' : l.hasWhatsapp === false ? 'Não' : '']
      .map(v => `"${(v ?? '').replace(/"/g, '""')}"`)
      .join(',')
  ).join('\n');
  const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'leads.csv'; a.click();
  URL.revokeObjectURL(url);
}

function copyLeads(leads: Lead[]) {
  const text = leads.map(l => `${l.name} | ${l.phone} | ${l.website}`).join('\n');
  navigator.clipboard.writeText(text);
}

export function LeadsTable({ leads, onSendToBulk, checkingWhatsapp, onCheckWhatsapp }: Props) {
  const [filter, setFilter] = useState('');
  const [waOnly, setWaOnly] = useState(false);

  const filtered = leads.filter(l => {
    if (waOnly && l.hasWhatsapp !== true) return false;
    return (
      l.name.toLowerCase().includes(filter.toLowerCase()) ||
      l.phone.includes(filter) ||
      l.address.toLowerCase().includes(filter.toLowerCase()) ||
      (l.category || '').toLowerCase().includes(filter.toLowerCase())
    );
  });

  const waCount = leads.filter(l => l.hasWhatsapp === true).length;
  const verified = leads.filter(l => l.hasWhatsapp !== null && l.hasWhatsapp !== undefined).length;

  function handleSendToBulk() {
    const numbers = leads
      .map(l => l.phone.replace(/\D/g, ''))
      .filter(p => p.length >= 10)
      .join('\n');
    if (numbers && onSendToBulk) onSendToBulk(numbers);
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex flex-col h-full gap-3"
    >
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <p className="text-sm font-semibold text-wa-text">Leads Extraídos</p>
          <p className="text-[11px] text-wa-muted">
            {leads.length} resultado{leads.length !== 1 ? 's' : ''}
            {verified > 0 && (
              <span className="ml-2 text-wa-green">
                <MessageCircle className="w-2.5 h-2.5 inline mr-0.5" />
                {waCount}/{verified} com WA
              </span>
            )}
            {checkingWhatsapp && (
              <span className="ml-2 text-blue-400 animate-pulse">verificando WA...</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          {onCheckWhatsapp && (
            <button
              onClick={onCheckWhatsapp}
              disabled={leads.length === 0 || checkingWhatsapp}
              title="Verificar WhatsApp em lote"
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg border border-wa-green/40 bg-wa-green/10 text-wa-green hover:bg-wa-green/20 transition-colors disabled:opacity-30 text-[11px] font-medium"
            >
              <MessageCircle className="w-3 h-3" />
              {checkingWhatsapp ? 'Verificando...' : 'Verificar WA'}
            </button>
          )}
          <button
            onClick={() => setWaOnly(v => !v)}
            disabled={leads.length === 0}
            title={waOnly ? 'Mostrar todos' : 'Mostrar só com WA'}
            className={`flex items-center gap-1 px-2 py-1.5 rounded-lg border text-[11px] font-medium transition-colors disabled:opacity-30 ${waOnly ? 'border-wa-green bg-wa-green/20 text-wa-green' : 'border-wa-border bg-wa-card text-wa-muted/80 hover:text-wa-text'}`}
          >
            <MessageCircle className="w-3 h-3" />
            Só WA
          </button>
          {onSendToBulk && (
            <button
              onClick={handleSendToBulk}
              disabled={leads.length === 0}
              title="Disparar para esses números"
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg border border-wa-green/40 bg-wa-green/10 text-wa-green hover:bg-wa-green/20 transition-colors disabled:opacity-30 text-[11px] font-medium"
            >
              <Send className="w-3 h-3" />
              Disparar
            </button>
          )}
          <button
            onClick={() => copyLeads(leads)}
            disabled={leads.length === 0}
            title="Copiar leads"
            className="p-1.5 rounded-lg border border-wa-border bg-wa-card text-wa-muted/80 hover:text-wa-text hover:border-wa-green/30 transition-colors disabled:opacity-30"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => exportCSV(leads)}
            disabled={leads.length === 0}
            title="Exportar CSV"
            className="p-1.5 rounded-lg border border-wa-border bg-wa-card text-wa-muted/80 hover:text-wa-green hover:border-wa-green/30 transition-colors disabled:opacity-30"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => exportCSV(leads)}
            disabled={leads.length === 0}
            title="Exportar Excel"
            className="p-1.5 rounded-lg border border-wa-border bg-wa-card text-wa-muted/80 hover:text-emerald-400 hover:border-emerald-500/30 transition-colors disabled:opacity-30"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative flex-shrink-0">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-wa-muted" />
        <input
          type="text"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="Filtrar leads..."
          className="w-full bg-wa-card border border-wa-border rounded-lg pl-8 pr-3 py-2 text-xs text-wa-text placeholder:text-wa-muted focus:outline-none focus:border-wa-green/40"
        />
      </div>

      {/* Table */}
      <div className="flex-1 rounded-xl border border-wa-border bg-wa-card overflow-hidden flex flex-col min-h-0">
        {/* Column headers */}
        <div className="grid grid-cols-[1fr_90px_80px_60px] gap-2 px-3 py-2 border-b border-wa-border bg-wa-bg/80 flex-shrink-0">
          <span className="text-[10px] font-semibold text-wa-muted uppercase tracking-wider">Empresa</span>
          <span className="text-[10px] font-semibold text-wa-muted uppercase tracking-wider">Telefone</span>
          <span className="text-[10px] font-semibold text-wa-muted uppercase tracking-wider">Avaliação</span>
          <span className="text-[10px] font-semibold text-wa-muted uppercase tracking-wider">Reviews</span>
        </div>

        <ScrollArea className="flex-1">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <FileSpreadsheet className="w-8 h-8 text-slate-700" />
              <p className="text-xs text-wa-text/70">
                {leads.length === 0 ? 'Nenhum lead coletado ainda' : 'Nenhum resultado para o filtro'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--color-borderColor)]/50">
              <AnimatePresence initial={false}>
                {filtered.map(lead => (
                  <motion.div
                    key={lead.id}
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    className="grid grid-cols-[1fr_90px_80px_60px] gap-2 px-3 py-2.5 hover:bg-wa-bg/60 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-xs text-wa-text font-medium truncate">{lead.name}</p>
                      <p className="text-[10px] text-wa-muted truncate">{lead.address || '—'}</p>
                      {lead.website && (
                        <p className="text-[10px] text-wa-green/70 truncate">{lead.website}</p>
                      )}
                    </div>
                    <div className="flex flex-col gap-0.5 self-center min-w-0">
                      <span className="text-[10px] text-wa-text truncate">{lead.phone || '—'}</span>
                      {lead.phone && (
                        lead.hasWhatsapp === true ? (
                          <span className="flex items-center gap-0.5 text-[9px] text-wa-green font-medium">
                            <MessageCircle className="w-2.5 h-2.5" />WA
                          </span>
                        ) : lead.hasWhatsapp === false ? (
                          <span className="text-[9px] text-wa-muted">sem WA</span>
                        ) : null
                      )}
                    </div>
                    <div className="flex items-center gap-1 self-center">
                      {lead.rating ? (
                        <>
                          <Star className="w-2.5 h-2.5 text-yellow-400 fill-yellow-400" />
                          <span className="text-[10px] text-yellow-400">{lead.rating}</span>
                        </>
                      ) : <span className="text-[10px] text-wa-text/60">—</span>}
                    </div>
                    <span className="text-[10px] text-wa-muted self-center">{lead.reviews || '—'}</span>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </ScrollArea>
      </div>
    </motion.div>
  );
}

