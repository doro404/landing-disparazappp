import { useEffect, useRef } from 'react';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import type { BrazilMapProps, StateFeatureProperties, StateMapData, MapPin } from './types';
import { getStateColor, getStateBorderColor, getStateBorderWidth } from './mapUtils';
import { LEAFLET_DARK_CSS } from './mapStyles';
import brazilGeoJSONRaw from './brazil-states.geojson?raw';

// Parse once at module level — safe because this file only loads in browser context
const brazilGeoJSON: FeatureCollection = JSON.parse(brazilGeoJSONRaw);

let cssInjected = false;
function injectCSS() {
  if (cssInjected) return;
  const style = document.createElement('style');
  style.textContent = LEAFLET_DARK_CSS;
  document.head.appendChild(style);
  cssInjected = true;
}

function getStateName(props: StateFeatureProperties): string {
  return (props as unknown as Record<string, string>).name ?? props.nome ?? props.sigla;
}

function buildTooltip(props: StateFeatureProperties, data?: StateMapData[]): string {
  const entry = data?.find(d => d.id === props.sigla);
  let html = `<div style="font-size:12px;font-weight:600;color:#e8f4f8">${getStateName(props)}</div>`;
  html += `<div style="font-size:10px;color:#8ba3b8;margin-top:2px">${props.sigla}</div>`;
  if (entry?.value !== undefined)
    html += `<div style="font-size:11px;color:#25D366;margin-top:4px">Leads: <b>${entry.value}</b></div>`;
  return html;
}

function buildPopup(props: StateFeatureProperties, data?: StateMapData[]): string {
  const entry = data?.find(d => d.id === props.sigla);
  const nome = getStateName(props);
  let html = `<div style="padding:14px 16px;min-width:160px">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
      <div style="width:30px;height:30px;border-radius:8px;background:rgba(37,211,102,0.15);border:1px solid rgba(37,211,102,0.3);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#25D366">${props.sigla}</div>
      <div><div style="font-size:13px;font-weight:600;color:#e8f4f8">${nome}</div></div>
    </div>`;
  if (entry?.value !== undefined)
    html += `<div style="display:flex;justify-content:space-between;padding:5px 0;border-top:1px solid var(--color-borderDeep)"><span style="font-size:11px;color:#8ba3b8">Leads</span><span style="font-size:11px;font-weight:600;color:#25D366">${entry.value}</span></div>`;
  if (entry?.status) {
    const colors: Record<string, string> = { alto: '#25D366', medio: '#eab308', baixo: '#ef4444' };
    const c = colors[entry.status] ?? '#8ba3b8';
    html += `<div style="display:flex;justify-content:space-between;padding:5px 0;border-top:1px solid var(--color-borderDeep)"><span style="font-size:11px;color:#8ba3b8">Status</span><span style="font-size:11px;font-weight:600;color:${c};text-transform:capitalize">${entry.status}</span></div>`;
  }
  html += `</div>`;
  return html;
}

export function BrazilMap({
  selectedStates = [],
  onStateSelect,
  data,
  pins,
  multiSelect = true,
  interactive = true,
  height = '100%',
}: BrazilMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const geoLayerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pinsLayerRef = useRef<any>(null);
  const hoveredRef = useRef<string | null>(null);
  const selectedRef = useRef<string[]>(selectedStates);
  const dataRef = useRef(data);

  selectedRef.current = selectedStates;
  dataRef.current = data;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function getStyle(feature?: Feature<Geometry, StateFeatureProperties>, _L?: any) {
    if (!feature) return {};
    const id = feature.properties.sigla;
    const selected = selectedRef.current.includes(id);
    const hovered = hoveredRef.current === id;
    return {
      fillColor: getStateColor(id, dataRef.current, selected, hovered),
      fillOpacity: 1,
      color: getStateBorderColor(selected, hovered),
      weight: getStateBorderWidth(selected, hovered),
    };
  }

  function refreshLayer() {
    if (!geoLayerRef.current) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    geoLayerRef.current.eachLayer((layer: any) => {
      if (layer.feature) layer.setStyle(getStyle(layer.feature));
    });
  }

  // Init map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let destroyed = false;

    Promise.all([
      import('leaflet'),
    ]).then(([{ default: L }]) => {
      if (destroyed || !containerRef.current) return;
      injectCSS();

      const map = L.map(containerRef.current, {
        center: [-14.235, -51.925],
        zoom: 4,
        minZoom: 3,
        maxZoom: 8,
        zoomControl: true,
        scrollWheelZoom: interactive,
        dragging: interactive,
        doubleClickZoom: false,
        attributionControl: false,
      });

      mapRef.current = map;

      // GeoJSON layer
      const geoLayer = L.geoJSON(brazilGeoJSON, {
        style: (f) => getStyle(f as Feature<Geometry, StateFeatureProperties>),
        onEachFeature(feature, lyr) {
          const props = feature.properties as StateFeatureProperties;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const gl = lyr as any;

          gl.bindTooltip(buildTooltip(props, dataRef.current), { sticky: true, opacity: 1 });
          gl.bindPopup(buildPopup(props, dataRef.current), { closeButton: true, maxWidth: 220 });

          if (!interactive) return;

          gl.on('mouseover', () => {
            hoveredRef.current = props.sigla;
            gl.setStyle(getStyle(feature as Feature<Geometry, StateFeatureProperties>));
            gl.bringToFront();
          });
          gl.on('mouseout', () => {
            hoveredRef.current = null;
            gl.setStyle(getStyle(feature as Feature<Geometry, StateFeatureProperties>));
          });
          gl.on('click', () => {
            if (!onStateSelect) return;
            const id = props.sigla;
            const cur = selectedRef.current;
            const next = multiSelect
              ? cur.includes(id) ? cur.filter(s => s !== id) : [...cur, id]
              : cur.includes(id) ? [] : [id];
            onStateSelect(next);
          });
        },
      }).addTo(map);

      geoLayerRef.current = geoLayer;

      // Pins layer (empty initially)
      pinsLayerRef.current = L.layerGroup().addTo(map);

      // Fit bounds after container has real dimensions
      // Double rAF + setTimeout ensures layout is fully painted before measuring
      const fitMap = () => {
        if (!destroyed && mapRef.current) {
          map.invalidateSize();
          const bounds = geoLayer.getBounds();
          if (bounds.isValid()) {
            map.fitBounds(bounds, { padding: [16, 16] });
          }
        }
      };
      requestAnimationFrame(() => requestAnimationFrame(fitMap));
      // Fallback: also fit after 300ms in case rAF wasn't enough
      const fitTimer = setTimeout(fitMap, 300);
      // Store timer so cleanup can clear it
      (map as unknown as Record<string, unknown>).__fitTimer = fitTimer;
    });

    return () => {
      destroyed = true;
      if (mapRef.current) {
        const t = (mapRef.current as unknown as Record<string, unknown>).__fitTimer;
        if (t) clearTimeout(t as ReturnType<typeof setTimeout>);
        mapRef.current.remove();
        mapRef.current = null;
        geoLayerRef.current = null;
        pinsLayerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ResizeObserver: quando o container sai de tamanho 0 (tab fica visível), refaz o fit
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      if (!mapRef.current || !geoLayerRef.current) return;
      const { width, height: h } = el.getBoundingClientRect();
      if (width > 0 && h > 0) {
        mapRef.current.invalidateSize();
        const bounds = geoLayerRef.current.getBounds();
        if (bounds.isValid()) {
          mapRef.current.fitBounds(bounds, { padding: [16, 16] });
        }
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Re-style on selection/data change
  useEffect(() => {
    refreshLayer();
    // Update tooltips/popups with new data
    if (geoLayerRef.current) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      geoLayerRef.current.eachLayer((layer: any) => {
        if (layer.feature) {
          const props = layer.feature.properties as StateFeatureProperties;
          layer.setTooltipContent(buildTooltip(props, data));
          layer.setPopupContent(buildPopup(props, data));
        }
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStates, data]);

  // Render pins
  useEffect(() => {
    if (!pinsLayerRef.current || !mapRef.current) return;

    import('leaflet').then(({ default: L }) => {
      const layer = pinsLayerRef.current;
      if (!layer) return;
      layer.clearLayers();

      if (!pins?.length) return;

      pins.forEach((pin: MapPin, i: number) => {
        const isActive = pin.active === true || i === pins.length - 1;
        const marker = L.circleMarker([pin.lat, pin.lng], {
          radius: isActive ? 7 : 5,
          fillColor: isActive ? '#25D366' : 'rgba(37,211,102,0.7)',
          color: isActive ? '#ffffff' : 'rgba(255,255,255,0.4)',
          weight: isActive ? 1.5 : 0.8,
          fillOpacity: 1,
        });

        if (pin.label) marker.bindTooltip(pin.label, { sticky: true, opacity: 1 });
        layer.addLayer(marker);
      });
    });
  }, [pins]);

  return (
    <div
      ref={containerRef}
      style={{ height, width: '100%', background: '#080f1e' }}
    />
  );
}
