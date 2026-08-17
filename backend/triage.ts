import type { TicketPayload, TicketSeverity } from "../shared/types.ts";

// Pure severity scorer — called on ticket ingest and on the agent-view queue sort.
// The ISP backend re-scores independently of what the reporting agent sent, so a
// misconfigured or spoofed client can't self-escalate to Critical.
export function triageTicket(payload: TicketPayload): TicketSeverity {
  const history = payload.probeHistory;
  if (!history || history.length === 0) return "Minor";

  const lossPct = (history.filter((s) => s.packetLoss).length / history.length) * 100;
  const latencies = history.map((s) => s.latencyMs).filter((l): l is number => l !== null);
  const avgLatency = latencies.length ? latencies.reduce((a, b) => a + b, 0) / latencies.length : null;
  const noLatency = latencies.length === 0; // complete loss — timeouts on every sample

  // Total outage or catastrophic loss
  if (noLatency || lossPct > 20) return "Critical";

  // Severe bufferbloat
  if (payload.diagnostics?.bufferbloat?.grade === "F") return "Critical";

  // Major degradation
  if (lossPct > 5 || (avgLatency !== null && avgLatency > 300) || payload.diagnostics?.bufferbloat?.grade === "D") {
    return "Critical";
  }

  // Mild degradation
  if (lossPct > 0 || (avgLatency !== null && avgLatency > 150)) return "Degraded";

  return "Minor";
}
