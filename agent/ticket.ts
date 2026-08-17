import { randomUUID } from "node:crypto";
import type {
  ProbeSample,
  DiagnosticResult,
  WifiTelemetry,
  SelfHealSuggestion,
  TicketPayload,
  TicketSeverity,
  HealthStatus,
} from "../shared/types.ts";
import { buildSummary } from "./summary.ts";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:4000";
const PROBE_WINDOW = 20; // number of recent samples to attach to the ticket

// Derive severity from the current health status and loss rate.
// Critical = outage or severe loss; Degraded = partial; Minor = threshold breach.
export function deriveTicketSeverity(status: HealthStatus, samples: ProbeSample[]): TicketSeverity {
  if (status === "critical") return "Critical";
  const lossPct = samples.length
    ? (samples.filter((s) => s.packetLoss).length / samples.length) * 100
    : 0;
  if (lossPct > 10) return "Critical";
  if (status === "degraded") return "Degraded";
  return "Minor";
}

export function buildTicketPayload(
  status: HealthStatus,
  allSamples: ProbeSample[],
  diagnostics: DiagnosticResult,
  telemetry: WifiTelemetry,
  suggestion: SelfHealSuggestion | null,
  fixResolved: boolean,
): TicketPayload {
  const probeHistory = allSamples.slice(-PROBE_WINDOW);
  const summary = buildSummary(probeHistory, diagnostics, suggestion);
  return {
    createdAt: Date.now(),
    status: "open",
    severity: deriveTicketSeverity(status, probeHistory),
    probeHistory,
    diagnostics,
    telemetry,
    summary,
    attemptedFix: suggestion,
    fixResolved,
  };
}

// In-memory queue for tickets that couldn't be submitted because the backend was down.
// Drained on the next successful POST.
const pendingQueue: TicketPayload[] = [];

async function postTicket(payload: TicketPayload): Promise<TicketPayload> {
  const res = await fetch(`${BACKEND_URL}/tickets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`backend returned ${res.status}`);
  return res.json() as Promise<TicketPayload>;
}

// Attempt to drain any queued tickets after a successful post.
async function drainQueue(): Promise<void> {
  while (pendingQueue.length > 0) {
    const next = pendingQueue[0];
    try {
      await postTicket(next);
      pendingQueue.shift();
    } catch {
      break; // still down — leave queue intact
    }
  }
}

// Submit a ticket with one automatic retry on 5xx/network error.
// If both attempts fail, the ticket is pushed to the in-memory queue
// (BullMQ/Redis would be the production path; in-memory is sufficient for the demo).
export async function submitTicket(payload: TicketPayload): Promise<TicketPayload | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const created = await postTicket(payload);
      // Success — drain any queued tickets from previous outages
      await drainQueue();
      return created;
    } catch (err) {
      if (attempt === 0) {
        console.warn("[ticket] submit failed, retrying once:", (err as Error).message);
        await new Promise((r) => setTimeout(r, 1000));
      } else {
        console.warn("[ticket] both attempts failed — queuing for later:", (err as Error).message);
        pendingQueue.push({ ...payload, id: payload.id ?? randomUUID() });
      }
    }
  }
  return null;
}

export function getPendingQueueLength(): number {
  return pendingQueue.length;
}

// Drain pending queue explicitly (called by agent server on startup if backend recovers).
export async function drainPendingQueue(): Promise<number> {
  const before = pendingQueue.length;
  await drainQueue();
  return before - pendingQueue.length;
}
