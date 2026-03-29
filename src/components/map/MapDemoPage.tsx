import { useState } from 'react';
import { BrazilMap } from './BrazilMap';
import type { StateMapData } from './types';
import { X, ToggleLeft, ToggleRight, MapPin } from 'lucide-react';

const DEMO_DATA: StateMapData[] = [
  { id: 'SP', value: 120, status: 'alto',  label: 'Maior mercado do país' },
  { id: 'RJ', value: 85,  status: 'alto',  label: 'Segundo maior mercado' },
  { id: 'MG', value: 60,  status: 'medio', label: 'Crescimento acelerado' },
  { id: 'RS', value: 55,  status: 'medio' },
  { id: 'PR', value: 50,  status: 'medio' },
  { id: 'BA', value: 40,  status: 'medio' },
  { id: 'SC', value: 38,  status: 'medio' },
  { id: 'GO', value: 30,  status: 'baixo' },
  { id: 'PE', value: 28,  status: 'baixo' },
  { id: 'CE', value: 22,  status: 'baixo' },
  { id: 'AM', value: 10,  status: 'baixo' },
  { id: 'PA', value: 12,  status: 'baixo' },
];

const STATE_NAMES: Record<string, string> = {
  AC:'Acre', AL:'Alagoas', AP:'Amapá', AM:'Amazonas', BA:'Bahia', CE:'Ceará',
  DF:'Distrito Federal', ES:'Espírito Santo', GO:'Goiás', MA:'Maranhão',
  MT:'Mato Grosso', MS:'Mato Grosso do Sul', MG:'Minas Gerais', PA:'Pará',
  PB:'Paraíba', PR:'Paraná', PE:'Pernambuco', PI:'Piauí', RJ:'Rio de Janeiro',
  RN:'Rio Grande do Norte', RS:'Rio Grande do Sul', RO:'Rondônia', RR:'Roraima',
  SC:'Santa Catarina', SP:'São Paulo', SE:'Sergipe', TO:'Tocantins',
};

export function MapDemoPage() {
  const [selected, setSelected] = useState<string[]>([]);
  const [multiSelect, setMultiSelect] = useState(true);

  return (
    <div className="flex h-full gap-4 p-4 bg-[#080f1e] min-h-0">
      {/* Map */}
      <div className="flex-1 rounded-xl border border-[#1e2d45] overflow-hidden min-h-0">
        <BrazilMap
          selectedStates={selected}
          onStateSelect={setSelected}
          data={DEMO_DATA}
          multiSelect={multiSelect}
          height="100%"
        />
      </div>

      {/* Side panel */}
      <div className="w-64 flex flex-col gap-3 flex-shrink-0">
        {/* Header */}
        <div className="rounded-xl border border-[#1e2d45] bg-[#0d1f35] p-4">
          <div className="flex items-center gap-2 mb-3">
            <MapPin className="w-4 h-4 text-[#25D366]" />
            <span className="text-sm font-semibold text-wa-text">Mapa do Brasil</span>
          </div>

          {/* Multi select toggle */}
          <button
            onClick={() => { setMultiSelect(m => !m); setSelected([]); }}
            className="flex items-center justify-between w-full text-xs text-slate-400 hover:text-white transition-colors"
          >
            <span>Seleção múltipla</span>
            {multiSelect
              ? <ToggleRight className="w-5 h-5 text-[#25D366]" />
              : <ToggleLeft className="w-5 h-5 text-slate-600" />
            }
          </button>
        </div>

        {/* Legend */}
        <div className="rounded-xl border border-[#1e2d45] bg-[#0d1f35] p-4">
          <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-3">Legenda</p>
          <div className="space-y-2">
            {[
              { color: 'bg-[#25D366]/50', label: 'Alto (≥80)' },
              { color: 'bg-yellow-500/45', label: 'Médio (50–79)' },
              { color: 'bg-orange-500/45', label: 'Baixo (20–49)' },
              { color: 'bg-red-500/40', label: 'Muito baixo (<20)' },
              { color: 'bg-[#0d1f35] border border-[#1e3a5f]', label: 'Sem dados' },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-sm flex-shrink-0 ${item.color}`} />
                <span className="text-[11px] text-slate-400">{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Selected states */}
        <div className="rounded-xl border border-[#1e2d45] bg-[#0d1f35] p-4 flex-1 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Selecionados ({selected.length})
            </p>
            {selected.length > 0 && (
              <button
                onClick={() => setSelected([])}
                className="text-[10px] text-slate-500 hover:text-red-400 transition-colors flex items-center gap-1"
              >
                <X className="w-3 h-3" /> Limpar
              </button>
            )}
          </div>

          {selected.length === 0 ? (
            <p className="text-xs text-slate-600 italic">Clique nos estados para selecionar</p>
          ) : (
            <div className="space-y-1.5 overflow-y-auto">
              {selected.map(id => {
                const entry = DEMO_DATA.find(d => d.id === id);
                return (
                  <div key={id} className="flex items-center justify-between bg-[#111e33] rounded-lg px-2.5 py-2">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded bg-[#25D366]/15 border border-[#25D366]/30 flex items-center justify-center">
                        <span className="text-[9px] font-bold text-[#25D366]">{id}</span>
                      </div>
                      <div>
                        <p className="text-[11px] text-white font-medium">{STATE_NAMES[id] ?? id}</p>
                        {entry?.value !== undefined && (
                          <p className="text-[10px] text-slate-500">Valor: {entry.value}</p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => setSelected(s => s.filter(x => x !== id))}
                      className="text-slate-600 hover:text-red-400 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
