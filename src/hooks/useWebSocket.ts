import { useEffect, useRef, useCallback } from 'react';

type Handler = (data: unknown) => void;

export function useWebSocket(onEvent: (event: string, data: unknown) => void) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const connect = useCallback(() => {
    if (!mountedRef.current) return;
    try {
      const ws = new WebSocket('ws://127.0.0.1:3001');
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[WS] Conectado ao sidecar');
        onEvent('ws_connected', {});
      };

      ws.onmessage = (e) => {
        try {
          const { event, data } = JSON.parse(e.data);
          onEvent(event, data);
        } catch {}
      };

      ws.onclose = () => {
        if (!mountedRef.current) return;
        onEvent('ws_disconnected', {});
        reconnectTimer.current = setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      reconnectTimer.current = setTimeout(connect, 3000);
    }
  }, [onEvent]);

  useEffect(() => {
    mountedRef.current = true;
    // Aguarda sidecar iniciar
    const timer = setTimeout(connect, 2000);
    return () => {
      mountedRef.current = false;
      clearTimeout(timer);
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return wsRef;
}
