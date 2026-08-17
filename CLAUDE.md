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
All phases P0–P10 done and pushed to `main`. 84 `node --test` cases pass, `tsc --noEmit` clean.
UI builds clean with Vite (619 modules). Full stack (backend :4000, agent :4100, Vite :5173)
verified live in a real browser — Dashboard/Settings/History/Tickets/ISP Agent View all render
real data with zero console errors.

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

## Post-build fixes (found during live browser verification, not by tsc/tests)
- `ui/src/main.tsx` never called `ReactDOM.createRoot(...).render(...)` — the app exported an
  unused `Router` component instead of mounting anything, so the page was blank. Fixed.
- All 5 page files under `ui/src/pages/` imported `shared/types.ts` with one `../` too many.
  Fixed.
- `backend/server.ts` set no CORS headers, so `Tickets.tsx`/`ISPAgentView.tsx` (which fetch
  the backend directly cross-origin) were silently blocked by the browser in both Vite dev and
  the packaged build — curl and Node-side tests never catch this since neither enforces CORS.
  Added a small manual CORS middleware (matches the existing pattern already used on the
  agent's SSE route) rather than a new dependency. Covered by a test asserting the header.
- `agent/selfheal.ts`'s `relocate` rule mixed `wifi?.rssi` with a bare `wifi.rssi` on the next
  clause — threw `TypeError` at runtime whenever wifi telemetry was null. Fixed to a single
  `wifi != null && wifi.rssi != null` check (this is also what `tsc --noEmit` was flagging).
- `agent/server.ts`: the "sample" SSE handler broadcast the probe state *before* recomputing
  `status` from the threshold tracker, so every frame was one sample stale. Also, `/api/simulate`
  duplicated the same threshold/broadcast logic inline and then re-emitted "sample", double-
  counting `ThresholdTracker`'s consecutive-breach counter. Both fixed by computing status
  before broadcasting once, and having `/api/simulate` push a sample and emit "sample" through
  the single canonical handler instead of re-implementing it.
- `agent/server.ts`: the "sample" handler read `state.history`/`state.wifi` *after*
  `await runDiagnostics(...)` to build self-heal suggestions and the ticket. Diagnostics take
  15-30s, and at this project's 1s probe interval that's enough time for the live probe loop to
  push 15-30 new (often healthy-again) samples, pushing the actual breach evidence out of the
  "last 20 samples" window before the ticket was ever built — self-heal rules and ticket
  severity/summary were being evaluated against stale, usually-healthy data instead of what
  triggered the breach. Fixed by snapshotting `state.history.slice(-20)` and `state.wifi`
  *before* the `await`, and using that snapshot everywhere downstream. Verified via
  `npm run simulate:degradation`: the resulting ticket's `probeHistory` now genuinely contains
  the injected/breaching samples instead of unrelated later ones.
- `scripts/simulate-degradation.ts`: `waitForPipeline()` took `history[0]` / `tickets[0]`
  (newest-first) as "the" result of this run's injection, with no check that they were actually
  *created after* the injection. On this machine's genuinely flaky phone-hotspot Wi-Fi, the real
  probe loop can independently trip its own threshold breach around the same time — the script
  would then report false success against an unrelated pre-existing ticket/diagnostic. Fixed by
  capturing `injectedAt = Date.now()` right before the `POST /api/simulate` call and filtering
  both the diagnostic-history and open-tickets lists to entries at or after that timestamp.

## Open investigation — `/api/simulate` sometimes doesn't fire (unresolved, stopped mid-debug)
`npm run simulate:degradation` is intermittent on this machine: sometimes it completes cleanly
(confirmed working end-to-end at least 3 times this session, each producing a correct,
non-stale ticket after the two fixes above), and sometimes it times out after 2 minutes with no
new ticket/diagnostic ever appearing, even when manually confirmed that no diagnostic was
`runningDiag` at the moment of injection.

**What's confirmed so far** (via temporary debug logging in `agent/server.ts`'s `/api/simulate`
route and `agent/threshold.ts`'s `record()`, since removed — not committed):
- The injected synthetic sample hardcodes `dnsMs: 500` in `agent/server.ts`'s `/api/simulate`
  handler, and `config.json`'s `thresholds.dnsMs` is `300`. Since `dnsBad = sample.dnsMs > 300`
  depends only on the *current* sample (not a rolling window), **`breach` is true on literally
  the very first injected sample, every time** — the "8 samples for 3-consecutive-latency"
  framing in the script's comment is misleading; the real trigger condition is satisfied
  immediately via DNS alone. This was confirmed directly via debug logs on a run that worked.
- Because `breach` is reliably true immediately, the only thing that can make `fired` false is
  `ThresholdTracker`'s cooldown gate (`triggerCooldownMs: 60000`, keyed off `lastFiredAt`) or
  `runningDiag` already being `true` from an unrelated in-flight diagnostic.
- **Leading hypothesis, not yet confirmed**: `lastFiredAt` is set at *fire time*, but tickets
  are created at *diagnostic-completion time* (`createdAt` is stamped after `await
  runDiagnostics(...)`, which itself can take 15-45s — `runTraceroute()` alone can take up to
  ~45s in the worst case on this network, see the traceroute note above). Several manual
  verification attempts this session computed "wait N seconds since the last ticket's
  `createdAt`" and still hit the failure — which contradicts a simple constant-offset version of
  this hypothesis, so either the offset varies more than expected, or something else is also
  contributing. This was not resolved before work was stopped.
- Ruled out: it is **not** a script-vs-curl difference (identical JSON bodies via `curl` and via
  the script's `fetch` both reproduced both outcomes across multiple trials); it is **not** the
  double-counting/stale-window bugs already fixed above (both confirmed fixed independently);
  a `runningDiag`-in-flight collision was explicitly checked and ruled out for at least one
  failure (confirmed idle via `/api/state` and agent log inspection immediately before
  injecting, and it still failed).

**Next steps to resume this investigation:**
1. Re-add the temporary debug logging (or equivalent) to `agent/threshold.ts`'s `record()` —
   print `breach`, `fired`, `lastFiredAt`, and `now - lastFiredAt` on every call where
   `breach === true` — and to `/api/simulate` in `agent/server.ts`. It was removed before commit
   since it's noisy, not because it wasn't useful; the removed version is in this session's
   history if wanted verbatim, but it's simple enough to redo in a couple of minutes.
2. Reproduce a failure with that logging active and read the exact `cooldownRemaining` value at
   the moment of the failed injection — this single number will confirm or rule out the cooldown
   hypothesis directly, which no amount of external timestamp arithmetic fully settled.
3. If it *is* cooldown: decide whether `triggerCooldownMs` should be measured from fire time (current)
   or completion time, and/or whether `/api/simulate` should bypass cooldown entirely (it's an
   explicit, deliberate demo trigger, not organic traffic — arguably it should never be
   silently no-op'd by cooldown state left over from unrelated real jitter). The simplest fix
   is likely: have `/api/simulate` reset `threshold`'s cooldown (`lastFiredAt = null`) before
   injecting, since a demo operator triggering it explicitly has already decided they want a run
   regardless of recent natural activity.
4. If it *isn't* cooldown: re-check `runningDiag` timing more carefully — specifically whether a
   *natural* breach can fire and set `runningDiag = true` in the gap between the script's
   `checkAlive`/state-print calls and its `POST /api/simulate` call (a few hundred ms to ~1-2s),
   given this network's real jitter is frequent enough that this narrow window might not be as
   safe as it looks.
5. Either way, add a `node --test` covering whatever the root cause turns out to be — this
   class of bug (timing/state interaction between real and simulated triggers) has no coverage
   right now.

This is a demo-reliability issue on this specific flaky test network, not a data-correctness bug
— when the pipeline *does* fire (confirmed clean multiple times), the resulting tickets are
correct. A more stable Wi-Fi connection on the actual event demo machine would very likely
reduce how often this is hit, but it should still be root-caused and fixed properly before
relying on `npm run simulate:degradation` live in front of judges.
