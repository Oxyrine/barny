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
All phases P0–P10 done and pushed to `main`. 75 `node --test` cases pass, `tsc --noEmit` clean.
UI builds clean with Vite (619 modules).

Phases completed:
- P0: Scaffold (package.json, tsconfig, CLAUDE.md, git)
- P1: Wi-Fi telemetry + anonymization (wifi.ts, anonymize.ts — real netsh data)
- P2: Health probe + threshold trigger (probe.ts, threshold.ts)
- P3: Mock ISP backend (db.ts, adapters, routes/tickets, routes/speedtest)
- P4: Diagnostic suite (diagnostics.ts — throughput, bufferbloat, traceroute)
- P5: Self-heal rules + summary templates + ticket assembler (selfheal.ts, summary.ts, ticket.ts)
- P6: Agent server — Express :4100 with SSE + full REST API (agent/server.ts)
- P7: Vite+React dashboard — Dashboard, History, Settings, Tickets, ISP Agent View pages
- P8: Demo simulation script (scripts/simulate-degradation.ts)
- P9: ISP triage, churn risk, agent queue endpoint (backend/triage.ts, churn.ts, routes/agentview.ts)
- P10: Electron wrapper (electron/main.js — spawns agent+backend, opens BrowserWindow on :4100)

Traceroute note: this machine is on a flaky phone hotspot whose carrier NAT sometimes drops
or rate-limits ICMP TTL-exceeded probes entirely, so `traceroute` in the payload can
legitimately come back empty or partial — that's the real network, not a bug. `runTraceroute()`
in `agent/diagnostics.ts` was fixed to parse `tracert`'s stdout even when it exits non-zero
(e.g. "Destination net unreachable"), since Node's `exec` still attaches partial stdout to a
rejected promise and discarding it was silently losing real hop data.

