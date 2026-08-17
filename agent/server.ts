import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync, writeFileSync } from "node:fs";
import type { Response } from "express";
import type { AppConfig, ProbeSample, ProbeState, DiagnosticResult } from "../shared/types.ts";
import { Prober } from "./probe.ts";
import { ThresholdTracker } from "./threshold.ts";
import { runDiagnostics } from "./diagnostics.ts";
import { getSelfHealSuggestion } from "./selfheal.ts";
import { buildTicketPayload, submitTicket } from "./ticket.ts";

process.on("uncaughtException", (err) => {
  console.error("FATAL UNCAUGHT EXCEPTION:", err.stack || err);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("FATAL UNHANDLED REJECTION:", reason);
  process.exit(1);
});

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
const diagnosticHistory: DiagnosticResult[] = [];

// ── SSE client registry ──────────────────────────────────────────────────────
const sseClients = new Set<Response>();

function broadcast(event: string, data: unknown): void {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of sseClients) {
    try {
      res.write(payload, (err) => {
        if (err) {
          console.warn("[agent] SSE write callback error, cleaning up client:", err.message);
          sseClients.delete(res);
        }
      });
    } catch (err) {
      console.warn("[agent] SSE write synchronous error, cleaning up client:", (err as Error).message);
      sseClients.delete(res);
    }
  }
}

// ── Pipeline: probe → threshold → diagnostics → selfheal → ticket ────────────
let runningDiag = false;

prober.on("sample", async (state: ProbeState) => {
  // status must be current before this sample is broadcast — computing it after would send
  // every SSE frame one sample stale, leaving the dashboard's status indicator a tick behind.
  const { status, fired } = threshold.record(state.history, config, Date.now());
  state.status = status;
  prober.setSuspect(status !== "good");
  broadcast("probe", state);

  if (fired && !runningDiag) {
    runningDiag = true;
    console.log("[agent] threshold fired — running diagnostics…");

    // Snapshot the evidence that actually caused this breach before running diagnostics.
    // runDiagnostics() takes 15-30s, during which the live probe loop keeps appending new
    // samples to state.history — re-reading state.history/state.wifi after that await would
    // evaluate self-heal rules and build the ticket against whatever the network looks like
    // *now* (often healthy again by then), not the samples that triggered the breach.
    const triggerSamples = state.history.slice(-20);
    const triggerWifi = state.wifi;

    try {
      const diag = await runDiagnostics(BACKEND_URL);
      diagnosticHistory.unshift(diag);
      if (diagnosticHistory.length > HISTORY_LIMIT) diagnosticHistory.pop();
      broadcast("diagnostic", diag);
      console.log(`[agent] diag done — down ${diag.downstreamMbps.toFixed(1)} Mbps, up ${diag.upstreamMbps.toFixed(1)} Mbps, bufferbloat ${diag.bufferbloat.grade}`);

      if (triggerWifi) {
        const suggestion = getSelfHealSuggestion({
          recentSamples: triggerSamples,
          wifi: triggerWifi,
          diagnostics: diag,
          config,
        });
        if (suggestion) console.log(`[agent] self-heal suggestion: ${suggestion.id} — ${suggestion.condition}`);

        const payload = buildTicketPayload(
          status,
          triggerSamples,
          diag,
          triggerWifi,
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

  res.on("error", (err) => {
    console.warn("[agent] SSE connection error event:", err.message);
    sseClients.delete(res);
  });

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

  // Inject directly into prober state, then emit through the same "sample" event the real
  // probe loop uses — that handler is the single place threshold/status/broadcast/diagnostics
  // logic lives, so injected samples get identical treatment instead of a duplicated (and
  // double-counting, since ThresholdTracker's consecutive-breach counter isn't idempotent)
  // copy of that logic here.
  
  threshold.resetCooldown();

  for (let i = 0; i < count; i++) {
    const s = { ...synthetic, timestamp: Date.now() + i };
    const state = prober.getState();
    state.history.push(s);
    state.lastSample = s;
    prober.emit("sample", state);
  }

  res.json({ injected: count, latencyMs, packetLoss });
});

// ── Start ─────────────────────────────────────────────────────────────────────
prober.start();
app.listen(PORT, () => {
  console.log(`agent server listening on :${PORT}`);
  console.log(`backend: ${BACKEND_URL}`);
});
