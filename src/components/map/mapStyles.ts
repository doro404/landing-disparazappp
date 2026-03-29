// CSS injetado globalmente para o Leaflet no tema dark
export const LEAFLET_DARK_CSS = `
  .leaflet-container {
    background: #080f1e !important;
    font-family: inherit;
  }
  .leaflet-control-zoom {
    border: 1px solid var(--color-borderDeep) !important;
    border-radius: 8px !important;
    overflow: hidden;
    box-shadow: 0 4px 12px rgba(0,0,0,0.4) !important;
  }
  .leaflet-control-zoom a {
    background: #0d1f35 !important;
    color: #8ba3b8 !important;
    border-bottom: 1px solid var(--color-borderDeep) !important;
    width: 28px !important;
    height: 28px !important;
    line-height: 28px !important;
    font-size: 14px !important;
    transition: background 0.2s, color 0.2s;
  }
  .leaflet-control-zoom a:hover {
    background: var(--color-borderDeep) !important;
    color: #25D366 !important;
  }
  .leaflet-control-attribution {
    display: none !important;
  }
  .leaflet-popup-content-wrapper {
    background: #0d1f35 !important;
    border: 1px solid var(--color-borderDeep) !important;
    border-radius: 10px !important;
    box-shadow: 0 8px 24px rgba(0,0,0,0.5) !important;
    color: #e8f4f8 !important;
    padding: 0 !important;
  }
  .leaflet-popup-content {
    margin: 0 !important;
    min-width: 160px;
  }
  .leaflet-popup-tip-container {
    display: none !important;
  }
  .leaflet-popup-close-button {
    color: #8ba3b8 !important;
    top: 8px !important;
    right: 8px !important;
    font-size: 16px !important;
    padding: 0 !important;
    width: 20px !important;
    height: 20px !important;
    line-height: 20px !important;
  }
  .leaflet-popup-close-button:hover {
    color: #25D366 !important;
    background: transparent !important;
  }
  .leaflet-tooltip {
    background: #0d1f35 !important;
    border: 1px solid var(--color-borderDeep) !important;
    border-radius: 6px !important;
    color: #e8f4f8 !important;
    font-size: 11px !important;
    padding: 4px 8px !important;
    box-shadow: 0 4px 12px rgba(0,0,0,0.4) !important;
    white-space: nowrap;
  }
  .leaflet-tooltip::before {
    display: none !important;
  }
`;
