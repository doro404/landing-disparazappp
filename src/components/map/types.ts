export interface StateMapData {
  id: string;       // sigla ex: "SP"
  value?: number;
  status?: 'alto' | 'medio' | 'baixo' | string;
  label?: string;   // texto extra no popup
}

export interface MapPin {
  lat: number;
  lng: number;
  label?: string;
  active?: boolean; // pin mais recente (pulsante)
}

export interface StateFeatureProperties {
  sigla: string;
  name?: string;
  nome?: string;
}

export interface BrazilMapProps {
  selectedStates?: string[];
  onStateSelect?: (states: string[]) => void;
  data?: StateMapData[];
  pins?: MapPin[];
  multiSelect?: boolean;
  showLabels?: boolean;
  interactive?: boolean;
  height?: string;
}
