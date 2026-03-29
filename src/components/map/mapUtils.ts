import type { StateMapData } from './types';

// ─── Nominatim geocoding (com fallback local) ─────────────────────────────────

const STATE_NAME_TO_ABBR: Record<string, string> = {
  'acre': 'AC', 'alagoas': 'AL', 'amapá': 'AP', 'amapa': 'AP',
  'amazonas': 'AM', 'bahia': 'BA', 'ceará': 'CE', 'ceara': 'CE',
  'distrito federal': 'DF', 'espírito santo': 'ES', 'espirito santo': 'ES',
  'goiás': 'GO', 'goias': 'GO', 'maranhão': 'MA', 'maranhao': 'MA',
  'mato grosso do sul': 'MS', 'mato grosso': 'MT',
  'minas gerais': 'MG', 'pará': 'PA', 'para': 'PA',
  'paraíba': 'PB', 'paraiba': 'PB', 'paraná': 'PR', 'parana': 'PR',
  'pernambuco': 'PE', 'piauí': 'PI', 'piaui': 'PI',
  'rio de janeiro': 'RJ', 'rio grande do norte': 'RN',
  'rio grande do sul': 'RS', 'rondônia': 'RO', 'rondonia': 'RO',
  'roraima': 'RR', 'santa catarina': 'SC', 'são paulo': 'SP', 'sao paulo': 'SP',
  'sergipe': 'SE', 'tocantins': 'TO',
};

function stateNameToAbbr(name: string): string | null {
  const norm = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  for (const [k, v] of Object.entries(STATE_NAME_TO_ABBR)) {
    const kn = k.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (norm === kn || norm.includes(kn)) return v;
  }
  return null;
}

const geocodeCache = new Map<string, string[]>();

/**
 * Resolve localização → siglas de estados.
 * Tenta Nominatim primeiro; fallback para mapeamento local.
 */
export async function resolveLocationToStates(location: string): Promise<string[]> {
  const key = location.trim().toLowerCase();
  if (!key) return [];
  if (geocodeCache.has(key)) return geocodeCache.get(key)!;

  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(location)}&countrycodes=br&format=json&addressdetails=1&limit=5`;
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch(url, {
      headers: { 'Accept-Language': 'pt-BR,pt;q=0.9', 'User-Agent': 'DisparaZapp/1.0' },
      signal: ctrl.signal,
    });
    clearTimeout(tid);
    if (res.ok) {
      const results: Array<{ address?: { state?: string } }> = await res.json();
      const states = new Set<string>();
      for (const r of results) {
        const abbr = r.address?.state ? stateNameToAbbr(r.address.state) : null;
        if (abbr) states.add(abbr);
      }
      if (states.size > 0) {
        const arr = [...states];
        geocodeCache.set(key, arr);
        return arr;
      }
    }
  } catch {
    // timeout ou CORS — cai no fallback
  }

  const fallback = getStatesFromLocation(location);
  geocodeCache.set(key, fallback);
  return fallback;
}

// ─── Autocomplete de cidades (offline) ───────────────────────────────────────

export interface CidadeSugestao {
  label: string;   // "Campinas, SP"
  state: string;   // "SP"
  city: string;    // "Campinas"
}

// Lista das ~300 cidades mais buscadas do Brasil com seus estados
const CIDADES_BR: Array<[string, string]> = [
  ['São Paulo','SP'],['Rio de Janeiro','RJ'],['Brasília','DF'],['Salvador','BA'],
  ['Fortaleza','CE'],['Belo Horizonte','MG'],['Manaus','AM'],['Curitiba','PR'],
  ['Recife','PE'],['Porto Alegre','RS'],['Belém','PA'],['Goiânia','GO'],
  ['Guarulhos','SP'],['Campinas','SP'],['São Luís','MA'],['São Gonçalo','RJ'],
  ['Maceió','AL'],['Duque de Caxias','RJ'],['Natal','RN'],['Teresina','PI'],
  ['Campo Grande','MS'],['Nova Iguaçu','RJ'],['São Bernardo do Campo','SP'],
  ['João Pessoa','PB'],['Santo André','SP'],['Osasco','SP'],['Jaboatão dos Guararapes','PE'],
  ['São José dos Campos','SP'],['Ribeirão Preto','SP'],['Uberlândia','MG'],
  ['Contagem','MG'],['Sorocaba','SP'],['Aracaju','SE'],['Feira de Santana','BA'],
  ['Cuiabá','MT'],['Joinville','SC'],['Juiz de Fora','MG'],['Londrina','PR'],
  ['Aparecida de Goiânia','GO'],['Ananindeua','PA'],['Porto Velho','RO'],
  ['Serra','ES'],['Caxias do Sul','RS'],['Mauá','SP'],['Macapá','AP'],
  ['Florianópolis','SC'],['São João de Meriti','RJ'],['Niterói','RJ'],
  ['Belford Roxo','RJ'],['Natal','RN'],['Teresópolis','RJ'],['Petrópolis','RJ'],
  ['Volta Redonda','RJ'],['Maringá','PR'],['Cascavel','PR'],['Foz do Iguaçu','PR'],
  ['Ponta Grossa','PR'],['Blumenau','SC'],['Chapecó','SC'],['Itajaí','SC'],
  ['Criciúma','SC'],['Caruaru','PE'],['Petrolina','PE'],['Olinda','PE'],
  ['Paulista','PE'],['Garanhuns','PE'],['Caucaia','CE'],['Juazeiro do Norte','CE'],
  ['Maracanaú','CE'],['Sobral','CE'],['Santarém','PA'],['Marabá','PA'],
  ['Castanhal','PA'],['Ananindeua','PA'],['Imperatriz','MA'],['Timon','MA'],
  ['Caxias','MA'],['Anápolis','GO'],['Rio Verde','GO'],['Vitória','ES'],
  ['Vila Velha','ES'],['Cariacica','ES'],['Cachoeiro de Itapemirim','ES'],
  ['Montes Claros','MG'],['Betim','MG'],['Uberaba','MG'],['Ipatinga','MG'],
  ['Divinópolis','MG'],['Sete Lagoas','MG'],['Governador Valadares','MG'],
  ['Itabuna','BA'],['Ilhéus','BA'],['Camaçari','BA'],['Vitória da Conquista','BA'],
  ['Bauru','SP'],['Jundiaí','SP'],['Piracicaba','SP'],['Limeira','SP'],
  ['Santos','SP'],['São Vicente','SP'],['Praia Grande','SP'],['Taubaté','SP'],
  ['Franca','SP'],['Presidente Prudente','SP'],['Marília','SP'],['Araçatuba','SP'],
  ['São José do Rio Preto','SP'],['Araraquara','SP'],['Americana','SP'],
  ['Pelotas','RS'],['Canoas','RS'],['Santa Maria','RS'],['Gravataí','RS'],
  ['Viamão','RS'],['Novo Hamburgo','RS'],['São Leopoldo','RS'],['Caxias do Sul','RS'],
  ['Passo Fundo','RS'],['Uruguaiana','RS'],['Santana do Livramento','RS'],
  ['Boa Vista','RR'],['Rio Branco','AC'],['Cruzeiro do Sul','AC'],
  ['Porto Velho','RO'],['Ji-Paraná','RO'],['Ariquemes','RO'],
  ['Palmas','TO'],['Araguaína','TO'],['Gurupi','TO'],
  ['Dourados','MS'],['Três Lagoas','MS'],['Corumbá','MS'],
  ['Rondonópolis','MT'],['Várzea Grande','MT'],['Sinop','MT'],
  ['Macapá','AP'],['Santana','AP'],['Rorainópolis','RR'],
  ['Arapiraca','AL'],['Mossoró','RN'],['Parnamirim','RN'],['Caicó','RN'],
  ['Campina Grande','PB'],['Patos','PB'],['Bayeux','PB'],
  ['Lagarto','SE'],['Itabaiana','SE'],['Nossa Senhora do Socorro','SE'],
  ['Parnaíba','PI'],['Picos','PI'],['Floriano','PI'],
  ['Itacoatiara','AM'],['Manacapuru','AM'],['Parintins','AM'],['Coari','AM'],
  ['ABC','SP'],['Grande São Paulo','SP'],['Grande Rio','RJ'],
  ['Região Metropolitana de SP','SP'],['Região Metropolitana de BH','MG'],
];

function normStr(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Retorna sugestões de cidades para autocomplete.
 * Máx 8 resultados, ordenados por relevância (começa com > contém).
 */
export function getCidadeSugestoes(query: string): CidadeSugestao[] {
  if (query.trim().length < 2) return [];
  const q = normStr(query);
  const starts: CidadeSugestao[] = [];
  const contains: CidadeSugestao[] = [];
  for (const [city, state] of CIDADES_BR) {
    const cn = normStr(city);
    if (cn.startsWith(q)) starts.push({ label: `${city}, ${state}`, city, state });
    else if (cn.includes(q)) contains.push({ label: `${city}, ${state}`, city, state });
    if (starts.length + contains.length >= 12) break;
  }
  return [...starts, ...contains].slice(0, 8);
}

/** Retorna cor de preenchimento baseada no valor/status do estado */
export function getStateColor(
  stateId: string,
  data?: StateMapData[],
  selected?: boolean,
  hovered?: boolean
): string {
  if (selected) return 'rgba(37,211,102,0.55)';
  if (hovered)  return 'rgba(37,211,102,0.25)';

  const entry = data?.find(d => d.id === stateId);
  if (!entry) return 'rgba(13,31,53,0.85)';

  if (entry.status === 'alto')  return 'rgba(37,211,102,0.45)';
  if (entry.status === 'medio') return 'rgba(234,179,8,0.40)';
  if (entry.status === 'baixo') return 'rgba(239,68,68,0.40)';

  // Heatmap por valor numérico
  if (entry.value !== undefined) {
    if (entry.value >= 80) return 'rgba(37,211,102,0.50)';
    if (entry.value >= 50) return 'rgba(234,179,8,0.45)';
    if (entry.value >= 20) return 'rgba(249,115,22,0.45)';
    return 'rgba(239,68,68,0.40)';
  }

  return 'rgba(13,31,53,0.85)';
}

export function getStateBorderColor(selected: boolean, hovered: boolean): string {
  if (selected) return '#25D366';
  if (hovered)  return 'rgba(37,211,102,0.6)';
  return 'var(--color-borderDeep)';
}

export function getStateBorderWidth(selected: boolean, hovered: boolean): number {
  if (selected) return 2;
  if (hovered)  return 1.5;
  return 0.8;
}

// Mapeamento de palavras-chave de localização para siglas de estados
const LOCATION_MAP: Array<{ keywords: string[]; states: string[] }> = [
  { keywords: ['são paulo', 'sao paulo', 'sp', 'campinas', 'santos', 'sorocaba', 'ribeirão', 'ribeirao', 'guarulhos', 'osasco', 'abc', 'santo andré', 'santo andre', 'mauá', 'maua', 'bauru', 'jundiaí', 'jundiai'], states: ['SP'] },
  { keywords: ['rio de janeiro', 'rj', 'niterói', 'niteroi', 'petrópolis', 'petropolis', 'volta redonda', 'nova iguaçu', 'nova iguacu', 'duque de caxias', 'belford roxo'], states: ['RJ'] },
  { keywords: ['minas gerais', 'mg', 'belo horizonte', 'bh', 'uberlândia', 'uberlandia', 'contagem', 'juiz de fora', 'betim', 'montes claros', 'uberaba'], states: ['MG'] },
  { keywords: ['bahia', 'ba', 'salvador', 'feira de santana', 'vitória da conquista', 'vitoria da conquista', 'camaçari', 'camacari', 'ilhéus', 'ilheus', 'itabuna'], states: ['BA'] },
  { keywords: ['paraná', 'parana', 'pr', 'curitiba', 'londrina', 'maringá', 'maringa', 'cascavel', 'foz do iguaçu', 'foz do iguacu', 'ponta grossa'], states: ['PR'] },
  { keywords: ['rio grande do sul', 'rs', 'porto alegre', 'caxias do sul', 'pelotas', 'canoas', 'santa maria', 'gravataí', 'gravata', 'viamão', 'viamao'], states: ['RS'] },
  { keywords: ['santa catarina', 'sc', 'florianópolis', 'florianopolis', 'joinville', 'blumenau', 'chapecó', 'chapeco', 'itajaí', 'itajai', 'criciúma', 'criciuma'], states: ['SC'] },
  { keywords: ['pernambuco', 'pe', 'recife', 'caruaru', 'olinda', 'petrolina', 'paulista', 'jaboatão', 'jaboatao', 'garanhuns'], states: ['PE'] },
  { keywords: ['ceará', 'ceara', 'ce', 'fortaleza', 'caucaia', 'juazeiro do norte', 'maracanaú', 'maracanau', 'sobral'], states: ['CE'] },
  { keywords: ['pará', 'para', 'pa', 'belém', 'belem', 'ananindeua', 'santarém', 'santarem', 'marabá', 'maraba', 'castanhal'], states: ['PA'] },
  { keywords: ['goiás', 'goias', 'go', 'goiânia', 'goiania', 'aparecida de goiânia', 'aparecida de goiania', 'anápolis', 'anapolis', 'rio verde'], states: ['GO'] },
  { keywords: ['maranhão', 'maranhao', 'ma', 'são luís', 'sao luis', 'imperatriz', 'timon', 'caxias', 'codó', 'codo'], states: ['MA'] },
  { keywords: ['amazonas', 'am', 'manaus', 'parintins', 'itacoatiara', 'manacapuru', 'coari'], states: ['AM'] },
  { keywords: ['mato grosso do sul', 'ms', 'campo grande', 'dourados', 'três lagoas', 'tres lagoas', 'corumbá', 'corumba'], states: ['MS'] },
  { keywords: ['mato grosso', 'mt', 'cuiabá', 'cuiaba', 'várzea grande', 'varzea grande', 'rondonópolis', 'rondonopolis', 'sinop'], states: ['MT'] },
  { keywords: ['espírito santo', 'espirito santo', 'es', 'vitória', 'vitoria', 'vila velha', 'cariacica', 'serra', 'cachoeiro'], states: ['ES'] },
  { keywords: ['piauí', 'piaui', 'pi', 'teresina', 'parnaíba', 'parnaiba', 'picos', 'floriano'], states: ['PI'] },
  { keywords: ['alagoas', 'al', 'maceió', 'maceio', 'arapiraca', 'palmeira dos índios', 'palmeira dos indios'], states: ['AL'] },
  { keywords: ['rio grande do norte', 'rn', 'natal', 'mossoró', 'mossoro', 'parnamirim', 'caicó', 'caico'], states: ['RN'] },
  { keywords: ['paraíba', 'paraiba', 'pb', 'joão pessoa', 'joao pessoa', 'campina grande', 'patos', 'bayeux'], states: ['PB'] },
  { keywords: ['sergipe', 'se', 'aracaju', 'nossa senhora do socorro', 'lagarto', 'itabaiana'], states: ['SE'] },
  { keywords: ['tocantins', 'to', 'palmas', 'araguaína', 'araguaina', 'gurupi', 'porto nacional'], states: ['TO'] },
  { keywords: ['rondônia', 'rondonia', 'ro', 'porto velho', 'ji-paraná', 'ji-parana', 'ariquemes', 'vilhena'], states: ['RO'] },
  { keywords: ['acre', 'ac', 'rio branco', 'cruzeiro do sul', 'sena madureira', 'tarauacá', 'tarauaca'], states: ['AC'] },
  { keywords: ['roraima', 'rr', 'boa vista', 'rorainópolis', 'rorainopolis', 'caracaraí', 'caracarai'], states: ['RR'] },
  { keywords: ['amapá', 'amapa', 'ap', 'macapá', 'macapa', 'santana', 'laranjal do jari'], states: ['AP'] },
  { keywords: ['distrito federal', 'df', 'brasília', 'brasilia', 'taguatinga', 'ceilândia', 'ceilandia', 'samambaia'], states: ['DF'] },
  { keywords: ['nordeste', 'northeast'], states: ['MA', 'PI', 'CE', 'RN', 'PB', 'PE', 'AL', 'SE', 'BA'] },
  { keywords: ['sudeste', 'southeast'], states: ['SP', 'RJ', 'MG', 'ES'] },
  { keywords: ['sul', 'south'], states: ['PR', 'SC', 'RS'] },
  { keywords: ['norte', 'north'], states: ['AM', 'PA', 'AC', 'RO', 'RR', 'AP', 'TO'] },
  { keywords: ['centro-oeste', 'centro oeste', 'midwest'], states: ['MT', 'MS', 'GO', 'DF'] },
  { keywords: ['brasil', 'brazil', 'todo brasil', 'todo o brasil', 'nacional'], states: ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'] },
];

export function getStatesFromLocation(location: string): string[] {
  if (!location.trim()) return [];
  const lower = location.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  for (const entry of LOCATION_MAP) {
    for (const kw of entry.keywords) {
      const kwNorm = kw.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (lower.includes(kwNorm)) return entry.states;
    }
  }
  return [];
}

// Coordenadas geográficas reais dos centros de cada estado
export const STATE_COORDS: Record<string, { lat: number; lng: number }> = {
  AC: { lat: -9.0238,  lng: -70.812  },
  AL: { lat: -9.5713,  lng: -36.782  },
  AP: { lat: 1.4102,   lng: -51.770  },
  AM: { lat: -3.4168,  lng: -65.856  },
  BA: { lat: -12.5797, lng: -41.700  },
  CE: { lat: -5.4984,  lng: -39.320  },
  DF: { lat: -15.7998, lng: -47.864  },
  ES: { lat: -19.1834, lng: -40.308  },
  GO: { lat: -15.8270, lng: -49.836  },
  MA: { lat: -5.4220,  lng: -45.440  },
  MT: { lat: -12.6819, lng: -56.921  },
  MS: { lat: -20.7722, lng: -54.785  },
  MG: { lat: -18.5122, lng: -44.555  },
  PA: { lat: -3.4168,  lng: -52.233  },
  PB: { lat: -7.2399,  lng: -36.782  },
  PR: { lat: -24.8890, lng: -51.889  },
  PE: { lat: -8.8137,  lng: -36.954  },
  PI: { lat: -7.7183,  lng: -42.729  },
  RJ: { lat: -22.9068, lng: -43.173  },
  RN: { lat: -5.8127,  lng: -36.205  },
  RS: { lat: -30.0346, lng: -51.217  },
  RO: { lat: -11.5057, lng: -63.580  },
  RR: { lat: 2.7376,   lng: -62.075  },
  SC: { lat: -27.2423, lng: -50.218  },
  SP: { lat: -23.5505, lng: -46.633  },
  SE: { lat: -10.9472, lng: -37.073  },
  TO: { lat: -10.1753, lng: -48.298  },
};

// Spread determinístico ao redor do centro do estado
export function pinCoords(stateAbbr: string, idx: number): { lat: number; lng: number } {
  const center = STATE_COORDS[stateAbbr];
  if (!center) return { lat: -14.235, lng: -51.925 };
  // Raio máximo ~1.5 graus, distribuição por ângulo dourado
  const maxRadius = 1.5;
  const angle = (idx * 137.508) % 360;
  const radius = (Math.sqrt((idx % 20) / 20)) * maxRadius;
  const rad = (angle * Math.PI) / 180;
  return {
    lat: center.lat + Math.sin(rad) * radius,
    lng: center.lng + Math.cos(rad) * radius,
  };
}
