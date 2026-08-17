# CLAUDE.md

## Project
Automated Wi-Fi Diagnostic & ISP Ticketing Engine (hackathon PS-S03).
Two Node processes (agent :4100, mock ISP backend :4000) + a Vite/React dashboard.
No workspaces, no build step for server code — Node 24 strips TypeScript natively.
Full rationale for every deviation from the original spec is in
docs/PS-S03_Project_Guidelines_v4.md and the plan history; the short version is below.

## Stack
- Runtime: Node 24 (native `.ts` execution, no tsc/tsx/ts-node)
- Server deps: Express only. Storage: `node:sqlite` (built in, no native module).
- UI: Vite + React + Recharts
- Real-time: Server-Sent Events (`EventSource`), not Socket.IO
- Tests: `node --test`, no framework

## Core requirements (do not drop any — see docs §0)
1. Background network health probe (latency, packet loss, DNS time, HTTP probe)
2. Auto-triggered diagnostic suite (throughput, bufferbloat, traceroute)
3. Telemetry collector — REAL Wi-Fi data via `netsh`/`airport`/`nmcli` (RSSI/channel/band/BSSID) + anonymization
4. Automated ticket ingestion (structured JSON → mock ticketing API)
5. Real-time dashboard (status, history, thresholds, ticket tracking)

## Known gap — do not paper over
SNR is unavailable on Windows (`netsh` has no noise floor). Report `snr: null,
snrSource: "unavailable"` — never fabricate a value. macOS derives real SNR from `airport`.

## Commands
- `npm run dev:agent` — agent process on :4100
- `npm run dev:backend` — mock ISP backend on :4000
- `npm run dev:ui` — Vite dev server on :5173 (proxies /api and /events to :4100)
- `npm test` — run all `node --test` suites
- `npm run typecheck` — `tsc --noEmit`
- `npm run simulate:degradation` — drives the full probe → diagnostic → ticket loop for demos

## Conventions
- Shared types live in `shared/types.ts` — never redefine a ticket/telemetry shape locally
- All telemetry passes through `agent/anonymize.ts` before it is stored or sent — no exceptions
- Ticketing backend calls always go through `backend/adapters/ticketing.ts` — never call a
  vendor shape directly from a route
- Probe/diagnostic/telemetry logic lives only in `agent/` — the UI only ever reads from the
  agent's HTTP/SSE API

## Architecture
`agent/probe.ts` → `agent/threshold.ts` → `agent/diagnostics.ts` → `agent/selfheal.ts` →
`agent/summary.ts` → `agent/ticket.ts` is a one-way pipeline; each stage is independently
testable and covered by a `node --test` file next to it. The dashboard subscribes to live
data over SSE; ticket submission from agent to backend is REST.

## What "done" looks like for a feature
- A `node --test` covering the happy path sits next to the file it tests
- Manual verification via `npm run simulate:degradation` showing the full
  probe → diagnostic → ticket loop end to end

## Build status
Phases P0–P4 done (scaffold, telemetry/anonymization, health probe + threshold, mock ISP
backend, diagnostic suite) — all committed and pushed to `main`. 35 `node --test` cases pass,
`tsc --noEmit` clean. Everything verified against real hardware, not just unit fixtures: real
RSSI/SNR/band/channel off this machine's Wi-Fi adapter, a real 60s probe run, real curl round
trips against a live backend, and a full diagnostic run (throughput/bufferbloat/traceroute)
against the live mock backend and real network.

Traceroute note: this machine is on a flaky phone hotspot whose carrier NAT sometimes drops
or rate-limits ICMP TTL-exceeded probes entirely, so `traceroute` in the payload can
legitimately come back empty or partial — that's the real network, not a bug. `runTraceroute()`
in `agent/diagnostics.ts` was fixed to parse `tracert`'s stdout even when it exits non-zero
(e.g. "Destination net unreachable"), since Node's `exec` still attaches partial stdout to a
rejected promise and discarding it was silently losing real hop data.

Not yet built: self-heal gate + plain-English summary + ticket builder (P5), the agent's own
SSE/HTTP server (P6), the dashboard UI (P7), demo simulation script (P8), ISP agent view with
triage/churn-risk (P9), optional Electron wrapper (P10).
