import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Download, FileSpreadsheet, Copy, Send, Shield, User } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

export interface ExtractedContact {
  id: string;
  name: string;
  phone: string;
  groupName: string;
  isAdmin: boolean;
}

interface Props {
  contacts: ExtractedContact[];
  onSendToBulk: (numbers: string) => void;
}

function exportCSV(contacts: ExtractedContact[]) {
  const header = 'Nome,Telefone,Grupo,Admin\n';
  const rows = contacts.map(c =>
    [c.name, c.phone, c.groupName, c.isAdmin ? 'Sim' : 'Não']
      .map(v => `"${String(v).replace(/"/g, '""')}"`)
      .join(',')
  ).join('\n');
  const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'contatos-grupos.csv'; a.click();
  URL.revokeObjectURL(url);
}

type SortKey = 'name' | 'phone' | 'groupName';

export function ExtractedContactsTable({ contacts, onSendToBulk }: Props) {
  const [filter, setFilter] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortAsc, setSortAsc] = useState(true);
  const [page, setPage] = useState(0);
  const [roleFilter, setRoleFilter] = useState<'all' | 'admins' | 'members'>('all');
  const PAGE_SIZE = 50;

  const filtered = contacts
    .filter(c => {
      if (roleFilter === 'admins' && !c.isAdmin) return false;
      if (roleFilter === 'members' && c.isAdmin) return false;
      return (
        c.name.toLowerCase().includes(filter.toLowerCase()) ||
        c.phone.includes(filter) ||
        c.groupName.toLowerCase().includes(filter.toLowerCase())
      );
    })
    .sort((a, b) => {
      const va = a[sortKey]; const vb = b[sortKey];
      return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
    });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortAsc(v => !v);
    else { setSortKey(k); setSortAsc(true); }
    setPage(0);
  };

  const handleSendToBulk = () => {
    const numbers = contacts.map(c => c.phone).filter(Boolean).join('\n');
    onSendToBulk(numbers);
  };

  const SortIcon = ({ k }: { k: SortKey }) => (
    <span className={`ml-0.5 text-[9px] ${sortKey === k ? 'text-wa-green' : 'text-slate-700'}`}>
      {sortKey === k ? (sortAsc ? '▲' : '▼') : '⇅'}
    </span>
  );

  return (
    <motion.div
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex flex-col h-full gap-3"
    >
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <p className="text-sm font-semibold text-wa-text">Contatos Extraídos</p>
          <p className="text-[11px] text-wa-muted">{contacts.length} contato{contacts.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => navigator.clipboard.writeText(contacts.map(c => c.phone).join('\n'))}
            disabled={contacts.length === 0}
            title="Copiar números"
            className="p-1.5 rounded-lg border border-wa-border bg-wa-card text-wa-muted/80 hover:text-wa-text transition-colors disabled:opacity-30"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => exportCSV(contacts)}
            disabled={contacts.length === 0}
            title="Exportar CSV"
            className="p-1.5 rounded-lg border border-wa-border bg-wa-card text-wa-muted/80 hover:text-wa-green transition-colors disabled:opacity-30"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => exportCSV(contacts)}
            disabled={contacts.length === 0}
            title="Exportar Excel"
            className="p-1.5 rounded-lg border border-wa-border bg-wa-card text-wa-muted/80 hover:text-emerald-400 transition-colors disabled:opacity-30"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Search + role filter */}
      <div className="flex flex-col gap-1.5 flex-shrink-0">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-wa-muted" />
          <input
            type="text"
            value={filter}
            onChange={e => { setFilter(e.target.value); setPage(0); }}
            placeholder="Filtrar contatos..."
            className="w-full bg-wa-card border border-wa-border rounded-lg pl-8 pr-3 py-2 text-xs text-wa-text placeholder:text-wa-muted focus:outline-none focus:border-wa-green/40"
          />
        </div>
        <div className="grid grid-cols-3 gap-1">
          {(['all', 'admins', 'members'] as const).map(f => (
            <button key={f} onClick={() => { setRoleFilter(f); setPage(0); }}
              className={`py-1 rounded-lg text-[10px] font-semibold border transition-colors ${
                roleFilter === f
                  ? 'bg-wa-green/10 border-wa-green/40 text-wa-green'
                  : 'bg-wa-bg/80 border-wa-border text-wa-muted hover:text-wa-text'
              }`}>
              {f === 'all' ? `Todos (${contacts.length})` : f === 'admins' ? `Admins (${contacts.filter(c => c.isAdmin).length})` : `Membros (${contacts.filter(c => !c.isAdmin).length})`}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 rounded-xl border border-wa-border bg-wa-card overflow-hidden flex flex-col min-h-0">
        {/* Column headers */}
        <div className="grid grid-cols-[1fr_100px_24px] gap-2 px-3 py-2 border-b border-wa-border bg-wa-bg/80 flex-shrink-0">
          <button onClick={() => toggleSort('name')} className="flex items-center text-left text-[10px] font-semibold text-wa-muted uppercase tracking-wider hover:text-wa-text transition-colors">
            <User className="w-3 h-3 mr-1" />Nome <SortIcon k="name" />
          </button>
          <button onClick={() => toggleSort('phone')} className="flex items-center text-left text-[10px] font-semibold text-wa-muted uppercase tracking-wider hover:text-wa-text transition-colors">
            Telefone <SortIcon k="phone" />
          </button>
          <span className="text-[10px] font-semibold text-wa-muted uppercase tracking-wider text-center">
            <Shield className="w-3 h-3" />
          </span>
        </div>

        <ScrollArea className="flex-1">
          {paged.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <User className="w-8 h-8 text-slate-700" />
              <p className="text-xs text-wa-text/70">
                {contacts.length === 0 ? 'Nenhum contato extraído ainda' : 'Nenhum resultado'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[var(--color-borderColor)]/50">
              <AnimatePresence initial={false}>
                {paged.map(contact => (
                  <motion.div
                    key={contact.id}
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    className="grid grid-cols-[1fr_100px_24px] gap-2 px-3 py-2 hover:bg-wa-bg/60 transition-colors items-center"
                  >
                    <div className="min-w-0">
                      <p className="text-xs text-wa-text font-medium truncate">{contact.name || '—'}</p>
                      <p className="text-[10px] text-wa-muted truncate">{contact.groupName}</p>
                    </div>
                    <span className="text-[10px] text-wa-text font-mono truncate">{contact.phone || '—'}</span>
                    <div className="flex justify-center">
                      {contact.isAdmin && <Shield className="w-3 h-3 text-yellow-400" aria-label="Admin" />}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </ScrollArea>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between flex-shrink-0">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="text-xs text-wa-muted/80 hover:text-wa-text disabled:opacity-30 transition-colors"
          >← Anterior</button>
          <span className="text-[11px] text-wa-muted">{page + 1} / {totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="text-xs text-wa-muted/80 hover:text-wa-text disabled:opacity-30 transition-colors"
          >Próximo →</button>
        </div>
      )}

      {/* Send to bulk */}
      <motion.button
        whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
        onClick={handleSendToBulk}
        disabled={contacts.length === 0}
        className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-wa-green/15 border border-wa-green/30 text-wa-green hover:bg-wa-green/25 font-semibold text-sm transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
      >
        <Send className="w-4 h-4" />
        Enviar para Disparo em Massa
      </motion.button>
    </motion.div>
  );
}

