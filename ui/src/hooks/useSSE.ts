import { useState, useEffect, useRef, useCallback } from "react";
import type { ProbeState, DiagnosticResult, TicketPayload } from "../../../shared/types.ts";

export type SSEEvent =
  | { type: "probe"; data: ProbeState }
  | { type: "diagnostic"; data: DiagnosticResult }
  | { type: "ticket"; data: TicketPayload };

export function useSSE() {
  const [probeState, setProbeState] = useState<ProbeState | null>(null);
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult[]>([]);
  const [tickets, setTickets] = useState<TicketPayload[]>([]);
  const [connected, setConnected] = useState(false);
  const esRef = useRef<EventSource | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    if (esRef.current) {
      esRef.current.close();
    }

    const es = new EventSource("/events");
    esRef.current = es;

    es.onopen = () => setConnected(true);
    es.onerror = () => {
      setConnected(false);
      es.close();
      esRef.current = null;
      // Auto-reconnect after 3s
      reconnectTimer.current = setTimeout(connect, 3000);
    };

    es.addEventListener("probe", (e) => {
      try {
        const data = JSON.parse(e.data) as ProbeState;
        setProbeState(data);
      } catch {}
    });

    es.addEventListener("diagnostic", (e) => {
      try {
        const data = JSON.parse(e.data) as DiagnosticResult;
        setDiagnostics((prev) => [data, ...prev].slice(0, 200));
      } catch {}
    });

    es.addEventListener("ticket", (e) => {
      try {
        const data = JSON.parse(e.data) as TicketPayload;
        setTickets((prev) => [data, ...prev]);
      } catch {}
    });
  }, []);

  useEffect(() => {
    connect();
    return () => {
      esRef.current?.close();
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    };
  }, [connect]);

  return { probeState, diagnostics, tickets, connected };
}
