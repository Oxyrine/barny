import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync, writeFileSync } from "node:fs";
import type { Response } from "express";
import type { AppConfig, ProbeSample, ProbeState } from "../shared/types.ts";
import { Prober } from "./probe.ts";
import { ThresholdTracker } from "./threshold.ts";
import { runDiagnostics } from "./diagnostics.ts";
import { getSelfHealSuggestion } from "./selfheal.ts";
import { buildTicketPayload, submitTicket } from "./ticket.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(__dirname, "..", "config.json");
const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:4000";
const PORT = Number(process.env.PORT) || 4100;
const HISTORY_LIMIT = 200;

function loadConfig(): AppConfig {
  return JSON.parse(readFileSync(CONFIG_PATH, "utf8")) as AppConfig;
}

let config = loadConfig();
const prober = new Prober(config);
const threshold = new ThresholdTracker();
const diagnosticHistory: ReturnType<typeof runDiagnostics> extends Promise<infer T> ? T[] : never[] = [] as any;

// ── SSE client registry ──────────────────────────────────────────────────────
const sseClients = new Set<Response>();

function broadcast(event: string, data: unknown): void {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of sseClients) {
    res.write(payload);
  }
}

// ── Pipeline: probe → threshold → diagnostics → selfheal → ticket ────────────
let runningDiag = false;

prober.on("sample", async (state: ProbeState) => {
  broadcast("probe", state);

  const { status, fired } = threshold.record(state.history, config, Date.now());
  (state as any).status = status;
  prober["state"].status = status;
  prober.setSuspect(status !== "good");

  if (fired && !runningDiag) {
    runningDiag = true;
    console.log("[agent] threshold fired — running diagnostics…");
    try {
      const diag = await runDiagnostics(BACKEND_URL);
      (diagnosticHistory as any[]).unshift(diag);
      if ((diagnosticHistory as any[]).length > HISTORY_LIMIT) (diagnosticHistory as any[]).pop();
      broadcast("diagnostic", diag);
      console.log(`[agent] diag done — down ${diag.downstreamMbps.toFixed(1)} Mbps, up ${diag.upstreamMbps.toFixed(1)} Mbps, bufferbloat ${diag.bufferbloat.grade}`);

      if (state.wifi) {
        const suggestion = getSelfHealSuggestion({
          recentSamples: state.history.slice(-20),
          wifi: state.wifi,
          diagnostics: diag,
          config,
        });
        if (suggestion) console.log(`[agent] self-heal suggestion: ${suggestion.id} — ${suggestion.condition}`);

        const payload = buildTicketPayload(
          status,
          state.history,
          diag,
          state.wifi,
          suggestion,
          false,
        );
        const ticket = await submitTicket(payload);
        if (ticket) {
          broadcast("ticket", ticket);
          console.log(`[agent] ticket submitted → id ${ticket.id}, severity ${ticket.severity}`);
        }
      }
    } catch (err) {
      console.error("[agent] diagnostic error:", err);
    } finally {
      runningDiag = false;
    }
  }
});

// ── Express app ───────────────────────────────────────────────────────────────
const app = express();
app.use(express.json());

// Serve built UI from ui/dist when running in packaged-demo mode
const uiDist = path.join(__dirname, "..", "ui", "dist");
app.use(express.static(uiDist));

// SSE stream
app.get("/events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.flushHeaders();

  // Send a heartbeat immediately so the browser EventSource knows the connection is live
  res.write(": heartbeat\n\n");
  sseClients.add(res);

  req.on("close", () => {
    sseClients.delete(res);
  });
});

// Current probe state snapshot
app.get("/api/state", (_req, res) => {
  res.json(prober.getState());
});

// Config read
app.get("/api/config", (_req, res) => {
  res.json(config);
});

// Config write — updates live config and persists to disk
app.put("/api/config", (req, res) => {
  const incoming = req.body as AppConfig;
  // Minimal validation — reject if core structure missing
  if (!incoming?.thresholds || typeof incoming.probeIntervalIdleMs !== "number") {
    res.status(400).json({ error: "invalid config shape" });
    return;
  }
  config = incoming;
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf8");
  res.json(config);
});

// Diagnostic history
app.get("/api/history", (_req, res) => {
  res.json(diagnosticHistory);
});

// Simulate: inject synthetic bad samples to trigger the full pipeline without waiting for
// real degradation. Used by scripts/simulate-degradation.ts (P8).
app.post("/api/simulate", (req, res) => {
  const { count = 5, latencyMs = 300, packetLoss = true } = (req.body ?? {}) as {
    count?: number;
    latencyMs?: number;
    packetLoss?: boolean;
  };

  const synthetic: ProbeSample = {
    timestamp: Date.now(),
    latencyMs,
    packetLoss,
    dnsMs: 500,
    httpOk: false,
    cpuPercent: 2,
  };

  // Inject directly into prober state so the threshold tracker sees them
  for (let i = 0; i < count; i++) {
    const s = { ...synthetic, timestamp: Date.now() + i };
    (prober.getState().history as ProbeSample[]).push(s);
    (prober.getState() as any).lastSample = s;
    broadcast("probe", prober.getState());

    const { status, fired } = threshold.record(prober.getState().history, config, Date.now());
    prober["state"].status = status;
    prober.setSuspect(true);
    if (fired && !runningDiag) {
      // Kick off async pipeline — deliberate fire-and-forget so simulate endpoint responds fast
      prober.emit("sample", prober.getState());
    }
  }

  res.json({ injected: count, latencyMs, packetLoss });
});

// ── Start ─────────────────────────────────────────────────────────────────────
prober.start();
app.listen(PORT, () => {
  console.log(`agent server listening on :${PORT}`);
  console.log(`backend: ${BACKEND_URL}`);
});
