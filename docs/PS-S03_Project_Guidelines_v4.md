# PS-S03 — Automated Wi-Fi Diagnostic & ISP Ticketing Engine
### Detailed Build Spec — Claude Code Edition (v4)

*Source PDF: Communication and Networking Software PS, PS-S03.*

---

## 0. Traceability Matrix — proof every PDF requirement is covered

| # | PDF Requirement (verbatim scope) | Covered in this spec |
|---|---|---|
| R1 | Background Network Health Probe — latency, packet loss, DNS response times, HTTP probe success rates, low CPU/battery | §4.1 |
| R2 | Automated Diagnostic & Speed Test Suite — multi-threaded downstream/upstream throughput, **bufferbloat**, **traceroute**, auto-triggered on threshold breach | §4.2 |
| R3 | Telemetry & Environmental Data Collector — RSSI, SNR, channel, frequency band, BSSID, device specs, OS network events, anonymization | §4.3 |
| R4 | Automated Ticket Ingestion Engine — structured JSON/REST payload, auto-submit to ticketing API | §4.4 |
| R5 | Cross-Platform UI — mobile/desktop app, real-time status dashboard, historical speed-test logs, threshold config, ticket status tracking | §4.5 |
| D1 | OS Network & Wi-Fi APIs — Windows Native WiFi API, macOS CoreWLAN, Android WifiManager, iOS NetworkExtension | §5.1 |
| D2 | Target Diagnostic Test Servers — ISP-hosted iPerf3/HTTP, Ookla Speedtest SDK, M-Lab NDT | §5.2 |
| D3 | ISP Service Desk API Gateway — REST/GraphQL, ServiceNow/Zendesk/proprietary ITSM | §5.3 |
| D4 | Background Service Execution Rights — Windows Services, macOS Daemons, Android Foreground Services + battery exemption | §5.4 |

Nothing in the PDF's minimum-requirements or dependencies section is left unaddressed. §4 and §5 go requirement-by-requirement, dependency-by-dependency. Note: this PDF (unlike some other tracks' problem statements) does **not** publish stretch goals, a deliverables list, or judging weightages for PS-S03 — §6 (differentiators) and §13 (demo script) are this spec's own additions, not PDF requirements, and are labeled as such throughout.

**Extra-credit addendum (v4):** the event separately awards marks for features outside the listed deliverables. §7.1 documents the three chosen for this ("plain-English summaries," "self-healing suggestions," "churn-risk flagging"), each with a one-line judge explanation and where it plugs into the pipeline without altering R1–R5. Phase 9 (§13) and the demo script (§14) were updated to build and narrate them.

---

## 1. Background

Subscribers hit transient Wi-Fi drops and latency spikes; they can't self-diagnose, and ISPs get vague tickets with no context. This app closes that loop: monitor continuously → auto-run deep diagnostics the moment something looks wrong → package the evidence → file a structured ticket automatically.

---

## 2. Client Platform Decision — Electron, Desktop-First

**Decision: Electron (Windows/macOS/Linux, one codebase) instead of React Native/Expo.**

### Why this changes the earlier plan
D1 is the dependency everything else (R3, most of R1) is built on top of, and it's where the two client approaches diverge hardest under a hackathon clock:

- **Electron + Node**: `node-wifi`, or simply shelling out to `netsh wlan show interfaces` (Windows) / `airport -I` (macOS) / `nmcli` (Linux), returns real RSSI/SNR/channel/BSSID from whatever laptop is running the demo. No native module work.
- **React Native (Expo, managed workflow)**: this data isn't exposed at all in managed Expo. Getting it means ejecting to bare RN and writing native modules in Kotlin/Swift against `WifiManager`/`CoreWLAN` — real native engineering, on two platforms, with no lab hardware to validate against beyond personal phones.

### What this trades off
- Lost: the "it's on my phone" demo appeal, and native iOS/Android builds (see §14 for how this is stated to judges).
- Gained: D1 becomes a *real* integration instead of a mocked one — "we're reading live signal data off the machine we're demoing on" is a stronger answer to "is any of this real?" than a synthetic generator would be, and it's one less unproven subsystem to debug under time pressure.
- PDF fit: R5 says **"Mobile/desktop app,"** not "mobile app" — a cross-platform Electron build satisfies this literally, it isn't a scope cut dressed up as a decision.

### If mobile is wanted for the live demo stage presence
Treat a **read-only companion view** (a simple web dashboard the Electron app also serves, viewable on a phone browser) as an explicit, clearly-labeled stretch item — not a rebuild of the intake/probe pipeline for mobile. See §6.

---

## 3. System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     ELECTRON APP (desktop)                     │
│                                                                 │
│  Main process (Node) — background, no UI needed                │
│  ┌───────────────┐  ┌──────────────────┐  ┌────────────────┐ │
│  │ Health Probe   │→ │ Diagnostic Suite  │→ │ Telemetry       │ │
│  │ (interval loop)│  │ (triggered)       │  │ Collector       │ │
│  │                │  │                    │  │ (node-wifi /    │ │
│  │                │  │                    │  │  netsh/airport/ │ │
│  │                │  │                    │  │  nmcli)         │ │
│  └───────────────┘  └──────────────────┘  └────────────────┘ │
│           │                    │                    │          │
│           └────────────────────┴────────────────────┘          │
│                              │                                 │
│                    ┌──────────────────┐                        │
│                    │ Ticket Payload    │                        │
│                    │ Builder           │                        │
│                    └──────────────────┘                        │
│                              │                                 │
│  Renderer process (React) ── IPC ── main process                │
│                    ┌──────────────────┐                        │
│                    │ Dashboard UI      │                        │
│                    └──────────────────┘                        │
└───────────────────────────┬─────────────────────────────────┘
                             │ WebSocket (live) + REST (ticket submit)
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                    MOCK ISP BACKEND (your own service)        │
│  ┌────────────────┐  ┌───────────────────┐  ┌──────────────┐ │
│  │ Ticketing API   │  │ Ticket Store       │  │ Agent View    │ │
│  │ (Zendesk-style  │  │ (SQLite/Postgres)  │  │ (mini web app │ │
│  │ REST schema)    │  │                    │  │ for demo)     │ │
│  └────────────────┘  └───────────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

Two deployable units: the **client app** (subscriber-facing, Electron) and a **mock ISP backend** (stands in for the real ISP's ticketing system — this is expected and legitimate for a hackathon since D3 assumes credentials you won't have). Probe and telemetry run in Electron's **main process** so they keep working even while the dashboard window is unfocused — this is what satisfies "background" for R1/D4 without needing a separate OS service for the demo (see §5.4 for the production-path story).

---

## 4. Tech Stack (with rationale)

| Layer | Choice | Why |
|---|---|---|
| Client shell | Electron | One codebase → Windows/macOS/Linux; ships real OS-level Wi-Fi telemetry via Node, not a mocked stand-in |
| Client UI | React (renderer process) | Standard, fast to build dashboards with; talks to main process over IPC |
| Wi-Fi telemetry | `node-wifi` primary, with direct CLI fallback (`netsh wlan show interfaces` / `airport -I` / `nmcli -f all dev wifi`) per OS | Real RSSI/SNR/channel/BSSID from the demo machine; CLI fallback covers whatever `node-wifi` doesn't expose per-OS |
| Real-time transport | WebSocket (Socket.IO) | Push probe/telemetry updates from main process → renderer → dashboard without polling |
| Charts | Recharts | Line/area charts for latency, packet loss, throughput trends |
| Mock backend | Node.js + Express + TypeScript | Fast to scaffold, same language as client (shared types) |
| Ticket store | SQLite (dev) → Postgres (scalability talking point) | Zero-setup for hackathon, believable upgrade path |
| Speed test | Synthetic throughput generator, self-hosted; real M-Lab NDT/Ookla SDK call as an optional bonus | Guarantees the demo works even on flaky venue Wi-Fi — this is D2's synthetic/real trade-off, separate from D1's now-real telemetry |
| State/queue (scalability story) | In-memory event queue now, BullMQ/Redis noted as the production path | Keeps scope hackathon-sized while still answering the scalability judging angle |

---

## 5. Functional Requirements — Detailed Breakdown

### 5.1 Background Network Health Probe (R1)
- Sampling interval: default 15s idle / 5s once a degradation is suspected (adaptive, not constant polling — keeps CPU/battery low, and matters more on a laptop running a live demo)
- Metrics per sample: latency (ICMP or TCP handshake time), packet loss %, DNS resolution time, HTTP HEAD probe success/failure
- Runs in the Electron **main process** so it keeps sampling even if the dashboard window loses focus
- Acceptance criteria: state a CPU/battery budget (e.g., "<2% average CPU") — even an approximate claim shows you engineered for the constraint

### 5.2 Automated Diagnostic & Speed Test Suite (R2)
- Trigger condition: fires automatically when probe metrics cross a configurable threshold (e.g., latency > 150ms for 3 consecutive samples, or packet loss > 5%)
- Tests run, in parallel (Node worker threads or child processes): downstream throughput, upstream throughput, **bufferbloat** (latency under load vs idle), **traceroute** (hop-by-hop path)
- Must not block the renderer/UI — run in the main process or a worker thread, push results to the renderer over IPC/WebSocket as they complete

### 5.3 Telemetry & Environmental Data Collector (R3)
- Captures: RSSI (dBm), SNR, channel, frequency band (2.4/5/6GHz), BSSID, device model/OS version, relevant OS network state-change events
- Sourced via `node-wifi` / OS CLI as described in §2 — **this is now real data from the demo device**, not synthetic
- **Anonymization is a hard requirement, not optional**: strip/hash any PII (device owner name, exact GPS, account identifiers) before the payload leaves the process — implement this at the point of collection, not as a later filter

### 5.4 Automated Ticket Ingestion Engine (R4)
- Builds a structured JSON payload combining probe history + diagnostic test results + telemetry snapshot
- POSTs to the mock ticketing API's `/tickets` endpoint automatically — no user click required for the ticket to exist (a "confirm and add notes" UI step is fine, but underlying ticket creation is automatic)

### 5.5 Cross-Platform User Interface (R5)
- Real-time status dashboard (traffic-light health indicator + live charts)
- Historical speed-test log (list/table, filterable by date)
- Threshold configuration screen (user can adjust sensitivity)
- Ticket status tracking (open/in-progress/resolved, pulled from the mock backend)
- "Cross-platform" satisfied via Electron's Windows/macOS/Linux build from one codebase, matching the PDF's "Mobile/desktop app" wording (§2)

---

## 6. Dependencies — Detailed Integration Plan

### 6.1 OS Network & Wi-Fi APIs (D1)
| Platform | Access path | Notes |
|---|---|---|
| Windows | `netsh wlan show interfaces` (parsed) or `node-wifi` | Signal %, SSID/BSSID, channel, radio type directly available |
| macOS | `airport -I` (`/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport`) or `node-wifi` | RSSI, noise (→ SNR), channel, BSSID |
| Linux | `nmcli -f all dev wifi` or `iwconfig` | Signal, channel, frequency band |
| *(Mobile — deferred)* | Android `WifiManager` / iOS `NetworkExtension` | Not in the core build; see §2 and §14 for why, and §6 for the optional read-only companion stretch |

This directly satisfies D1 for the desktop OSes the PDF names (Windows Native WiFi API, macOS CoreWLAN are both desktop APIs) with **real** rather than mocked data — the strongest single upgrade this spec makes over the earlier draft.

### 6.2 Target Diagnostic Test Servers (D2)
- Use a synthetic throughput generator (self-hosted or simulated) as the primary demo path so the app works regardless of venue network conditions
- If time allows, wire in a real M-Lab NDT or Ookla SDK call as a "real integration" bonus point — but don't make the live demo depend on venue internet being fast/stable

### 6.3 ISP Service Desk API Gateway (D3)
- Build a mock REST service matching a realistic ticketing schema (Zendesk/ServiceNow-shaped): `POST /tickets`, `GET /tickets/:id`, `GET /tickets?status=`
- This is the correct hackathon substitute for real ISP credentials the PDF assumes you'd have in production — say this explicitly in your pitch so judges see you understood the dependency, not that you missed it

### 6.4 Background Service Execution Rights (D4)
- For the hackathon demo: the probe runs as long as the Electron app is running, in the main process, independent of window focus — this satisfies "background execution" for the purposes of a live demo
- Production-path story (state this, don't build it): package as a Windows Service (via `node-windows`) / macOS LaunchAgent / Linux systemd unit so monitoring survives app-window closure entirely — mention this as the deployment target, not something built during the event
- The PDF's D4 wording names Windows Services / macOS Daemons / Android Foreground Services specifically (no iOS line) — the desktop two are covered by the production-path story above; Android/iOS background execution is out of scope along with the rest of native mobile (§2, §14)

---

## 7. Differentiator Features (this spec's own suggestions — not PDF requirements; pick 2–4)

- **Auto severity/triage scoring** — Critical / Degraded / Minor classification so the mock ISP agent view shows a prioritized queue, not a flat list
- **Predictive trend detection** — flag a slow multi-day decline before it becomes a full outage
- **Area-wide outage correlation** — if several simulated devices in the same region report degradation simultaneously, auto-flag as infrastructure issue vs. individual home issue (strong scalability talking point)
- **Network health score** — single 0–100 glanceable score with trend arrow
- **Dual role view** — end-user app + a lightweight ISP-agent view receiving the ticket live; demoing both sides in one flow is a strong hackathon moment
- **Read-only mobile companion view** — the Electron app also serves a lightweight web dashboard (status + charts, no probe logic) reachable from a phone on the same network; recovers some "it's on my phone" demo appeal without native mobile engineering. Clearly optional/stretch, not core.

### 7.1 Selected "outside the box" features (for the judging track's extra-credit criterion)

The event awards separate marks for ideas that go beyond the listed deliverables. The three below were chosen because each one (a) builds entirely on data the core pipeline (R1–R3) already collects — no new external dependency — and (b) tells a single connected story when demoed together: **detect → explain → fix → protect revenue**. This story arc, not just the feature list, is what should be said out loud to judges.

**1. Plain-English diagnostic summaries**
- What it does: takes the raw ticket payload (probe history + diagnostic results + telemetry snapshot from §5.4) and makes one LLM call that returns a short, non-technical explanation of the root cause — e.g., "likely wall interference between your router and this room, not an ISP-side issue."
- Where it plugs in: a new step between the Ticket Payload Builder and ticket submission (after Phase 6, before Phase 7's dashboard renders it) — it does not touch the probe/diagnostic/telemetry pipeline itself.
- How to explain it to judges: "Every team can detect a problem. We also close the comprehension gap — the subscriber doesn't need to understand RSSI or bufferbloat to know what's wrong and why." This directly addresses the PDF's own background section, which calls out that non-technical users can't self-diagnose.
- Scope guard: cache/mock a few representative LLM responses as a fallback in case of API flakiness during the live demo — never let the demo depend on a live external call succeeding on stage.

**2. Self-healing suggestions before escalation**
- What it does: before a ticket is auto-filed, the diagnostic suite's output is checked against a small rules table of known low-risk fixes (e.g., recommend a specific 5GHz channel if congestion is detected, suggest a DNS server switch if resolution time is high). If a fix is available, it's surfaced to the user first; the ticket is filed only if the issue persists or no fix applies.
- Where it plugs in: sits between §5.2 (Diagnostic Suite) and §5.4 (Ticket Payload Builder) as a decision gate — doesn't change R1–R3 pipeline logic, only what happens after diagnosis.
- How to explain it to judges: "This is the difference between a ticket generator and a support tool an ISP would actually want to deploy — it resolves what it can and only escalates what it can't, which is a direct answer to the PDF's stated goal of reducing call-center overhead."
- Scope guard: keep the rules table small and deterministic (3–5 conditions) for the hackathon — framing it as "this is where a learned policy would go in production" is enough; don't try to build a real recommendation model under time pressure.

**3. Churn-risk flagging**
- What it does: on the mock ISP agent view, an account with repeated unresolved degradation + tickets within a rolling window gets flagged as elevated churn risk, surfaced alongside the ticket queue.
- Where it plugs in: a read-only aggregation over the existing ticket store (§3, mock ISP backend) — purely additive, no changes to the client app or core pipeline.
- How to explain it to judges: "This reframes the tool from a support-cost line item to a retention tool — the same diagnostic data that resolves a ticket also tells the ISP which subscribers are at risk of leaving, which is the business case that actually gets a tool like this funded."
- Scope guard: a simple threshold rule (e.g., ≥3 unresolved-or-repeated tickets in 30 simulated days) is sufficient — state that a real deployment would feed this into an existing CRM/retention model rather than building one from scratch.

These three are additive to, not a replacement for, §7's original list — if time allows after Phase 9, §7's other items (health score, dual role view) remain good next picks since they reinforce the same demo story.

---

## 8. Scalability Story (state this explicitly to judges)

- Adapter pattern for ticketing backends — one interface, swap Zendesk/ServiceNow/proprietary ITSM behind it
- Event-driven ingestion — telemetry goes through a queue (in-memory for the demo, note BullMQ/Redis/Kafka as the production path) so it scales to many concurrent devices without a redesign
- Config-driven thresholds — not hardcoded constants, so the same build works across regions/ISPs with different baselines
- Desktop-agent deployment story — the same Electron core, packaged headless as a Windows Service/macOS daemon/Linux systemd unit, is how this would actually ship to a subscriber base (see §6.4)

---

## 9. UX / Frontend Guidelines

- Top-of-dashboard traffic-light status card — the one thing a non-technical user needs first
- 2–3 real-time charts max (latency, packet loss, throughput) — don't overload the screen
- Collapsible history/ticket timeline below the fold
- One-tap ticket confirmation card, never a raw JSON dump
- Loading skeletons for first launch before data accumulates
- Onboarding screen explaining *why* background monitoring and Wi-Fi access are requested (macOS in particular will prompt for location permission to read Wi-Fi details — explain this, don't let it surprise the user)
- Consistent spacing/typography system, responsive down to a reasonable minimum desktop window size
- Accessibility: sufficient contrast, status never conveyed by color alone (pair with icon/text)

---

## 10. Repository Structure

```
ps-s03-wifi-diagnostic/
├── CLAUDE.md                      # project instructions for Claude Code (see §11)
├── .claude/
│   ├── commands/                  # custom slash commands (see §12)
│   └── agents/                    # subagent definitions (see §12)
├── apps/
│   ├── desktop/                   # Electron app (main + renderer)
│   │   ├── src/
│   │   │   ├── main/              # main process: probes, diagnostics, telemetry, IPC
│   │   │   │   ├── probes/        # health probe, speed test, telemetry collector (node-wifi/CLI)
│   │   │   │   └── ticketing/     # payload builder, submit logic
│   │   │   ├── renderer/          # React UI
│   │   │   │   ├── dashboard/     # screens & charts
│   │   │   │   └── config/        # threshold settings screen
│   │   │   └── preload/           # IPC bridge
│   │   └── package.json
│   └── mock-isp-backend/          # Express + TypeScript
│       ├── src/
│       │   ├── routes/tickets.ts
│       │   ├── adapters/          # ticketing-backend adapter pattern (§8)
│       │   └── db/
│       └── package.json
├── packages/
│   └── shared-types/              # shared TS types between client & backend
├── scripts/
│   └── simulate-degradation.ts    # triggers a fake network degradation for demos/tests
└── docs/
    └── PS-S03_Project_Guidelines_v4.md   # this file
```

---

## 11. `CLAUDE.md` — drop this in your repo root

```markdown
# CLAUDE.md

## Project
Automated Wi-Fi Diagnostic & ISP Ticketing Engine (hackathon PS-S03).
Monorepo: Electron desktop client (apps/desktop) + Express mock ISP backend (apps/mock-isp-backend),
sharing types via packages/shared-types.

## Core requirements (do not drop any of these — see docs/PS-S03_Project_Guidelines_v4.md §0)
1. Background network health probe (latency, packet loss, DNS time, HTTP probe)
2. Auto-triggered speed test suite (throughput, bufferbloat, traceroute)
3. Telemetry collector — REAL Wi-Fi data via node-wifi/OS CLI (RSSI/SNR/channel/band/BSSID) + anonymization
4. Automated ticket ingestion (structured JSON → mock ticketing API)
5. Cross-platform (Windows/macOS/Linux) real-time dashboard (status, history, thresholds, ticket tracking)

## Client platform
Electron, not React Native. Wi-Fi telemetry comes from node-wifi with OS-CLI fallback
(netsh/airport/nmcli) — see docs/PS-S03_Project_Guidelines_v4.md §2 and §6.1 for why.
Probe/diagnostic/telemetry logic lives in the Electron MAIN process, never the renderer.

## Commands
- `npm run dev:desktop` — start Electron app in dev mode
- `npm run dev:backend` — start mock ISP backend on :4000
- `npm run test` — run test suite for both apps
- `npm run simulate:degradation` — trigger scripts/simulate-degradation.ts for demoing the full loop

## Conventions
- TypeScript everywhere, strict mode on
- Shared types live in packages/shared-types — never redefine a ticket/telemetry shape locally
- All telemetry must pass through the anonymization step in apps/desktop/src/main/probes/telemetry
  before it is sent anywhere — no exceptions, even in test code
- Ticketing backend calls always go through the adapter interface in
  apps/mock-isp-backend/src/adapters — never call a vendor shape directly from routes
- Never put probe/diagnostic/telemetry logic in the renderer — main process only, exposed to the
  renderer via the preload IPC bridge

## Architecture notes
- Probe → Diagnostic Suite → Telemetry Collector → Ticket Payload Builder is a one-way
  pipeline in the main process; each stage should be independently testable
- Dashboard (renderer) subscribes to live data over WebSocket/IPC; ticket submission is REST

## What "done" looks like for a feature
- Unit test covering the happy path
- Manual verification via `npm run simulate:degradation` showing the full
  probe → test → ticket loop end to end
```

Keep this file short and factual — it loads into every session. Put deeper explanations (like the full architecture doc) in `docs/` and reference them from here, not inline.

---

## 12. Recommended Claude Code Setup

**Custom slash commands** (`.claude/commands/`):
- `/simulate-degradation` — runs `scripts/simulate-degradation.ts`, useful for testing the full pipeline without waiting for real network conditions
- `/new-endpoint` — scaffolds a new Express route + adapter method + shared type in one pass
- `/demo-check` — runs through the demo script in §14 end to end and reports what broke

**Subagents** (`.claude/agents/`), if the team is splitting work in parallel:
- `frontend-builder` — scoped to `apps/desktop/src/renderer/**`, focused on UI/UX polish
- `backend-builder` — scoped to `apps/mock-isp-backend/**`, focused on the ticketing adapter and API
- `qa-runner` — read-mostly, runs tests and the simulate-degradation script, reports failures without making edits

Subagents give each teammate's Claude Code session isolated context, so one person working on the dashboard doesn't fill their context window with backend code and vice versa.

**Workflow habits that matter for a hackathon timeline:**
- Use **plan mode** before starting each new feature (probe, then diagnostic suite, then ticketing, then dashboard) — have Claude propose an approach before writing code, review it, then approve.
- Use **checkpoints** liberally — if a generated approach isn't working, rewind instead of manually reverting.
- If working with teammates on the same repo, use **git worktrees** so parallel Claude Code sessions on different features don't step on each other's file edits.
- Give Claude something to verify against at every step — e.g., "run `npm run simulate:degradation` and confirm a ticket appears in the mock backend" — rather than asking it to write code with no way to check correctness.
- Test the `node-wifi`/CLI telemetry path **first**, on every team member's actual laptop, before building anything on top of it — this is the one integration that varies by machine/OS and you want that surprise on hour one, not hour eleven.

---

## 13. Phase-by-Phase Build Plan (literal prompts for Claude Code)

**Phase 0 — Scaffold**
> "Set up the monorepo structure from docs/PS-S03_Project_Guidelines_v4.md §10. Initialize the Electron app (apps/desktop, main + renderer + preload), the Express+TypeScript mock backend, and the shared-types package. Wire up npm workspaces so they can import from packages/shared-types."

**Phase 1 — Real Wi-Fi Telemetry Spike (do this before anything else)**
> "In apps/desktop/src/main/probes/telemetry, get node-wifi returning RSSI/SSID/BSSID/channel from this machine, with a fallback that shells out to netsh/airport/nmcli per-OS if node-wifi comes back empty. Log the raw output so we can see what fields are actually available on this OS before building the anonymization/formatting layer on top."

**Phase 2 — Health Probe (R1)**
> "Implement the background network health probe described in §5.1: adaptive-interval sampling of latency, packet loss, DNS resolution time, and HTTP probe success, running in the Electron main process. Include a unit test with mocked network responses."

**Phase 3 — Diagnostic Suite (R2)**
> "Implement the auto-triggered diagnostic suite from §5.2: when health-probe metrics cross the configured threshold, run downstream/upstream throughput, bufferbloat, and traceroute tests without blocking the renderer. Trigger this from a threshold-crossing event, not a timer."

**Phase 4 — Telemetry Collector + Anonymization (R3)**
> "Build the anonymization step as its own tested function first, then wire the telemetry collector from Phase 1 to call it before any data is stored or transmitted (device owner name, exact GPS, account identifiers stripped/hashed)."

**Phase 5 — Mock ISP Backend + Ticketing (R4, D3)**
> "Build the mock-isp-backend Express service with the adapter pattern from §8: a ticketing interface, one concrete Zendesk-style adapter implementing it, and a POST /tickets route. Add a SQLite-backed ticket store."

**Phase 6 — Ticket Payload Builder**
> "Connect probe + diagnostic + telemetry outputs into the structured JSON ticket payload described in §5.4, and auto-POST it to the mock backend when a diagnostic run completes."

**Phase 7 — Dashboard (R5)**
> "Build the renderer dashboard from §5.5 and §9: real-time status card, live charts fed over IPC/WebSocket, historical speed-test log, threshold config screen, and ticket status tracking pulled from the mock backend."

**Phase 8 — Demo Script Wiring**
> "Implement scripts/simulate-degradation.ts so it artificially triggers a degradation, walks the full probe → diagnostic → ticket pipeline, and prints each stage's output — this is what /simulate-degradation and /demo-check will run."

**Phase 9 — Differentiator features (§7.1)**
> "Implement the three outside-the-box features from §7.1, in this order, each as an additive step that doesn't modify the core probe/diagnostic/ticket flow:
> 1. Plain-English diagnostic summary — one LLM call between the Ticket Payload Builder and ticket submission, with cached fallback responses for demo reliability.
> 2. Self-healing suggestion gate — a small rules table checked after the Diagnostic Suite, before the Ticket Payload Builder; only escalate to a ticket if no fix applies or the issue persists.
> 3. Churn-risk flagging — a read-only aggregation query on the mock ISP backend's ticket store, surfaced on the agent view.
> Verify each independently against `npm run simulate:degradation` before moving to the next."

Work through these in order; each phase has a natural verification point before moving to the next.

---

## 14. Demo Script (under 90 seconds)

1. Show live dashboard, green status — point out this is reading real signal data off the demo laptop right now
2. Run `/simulate-degradation` (or tap the equivalent in-app trigger)
3. Watch: probe flags it → diagnostic suite auto-runs
4. **Self-healing gate**: show the app surfacing a suggested fix first (§7.1.2) — narrate: "before we ever file a ticket, we try to resolve it"
5. If the fix doesn't apply/resolve: ticket auto-files, carrying a **plain-English summary** (§7.1.1) instead of raw telemetry — narrate: "the subscriber gets an explanation, not a wall of numbers"
6. Cut to the ISP-agent view receiving the ticket with full context, **and the account's churn-risk flag** (§7.1.3) — narrate: "the same event that resolves a support case also tells the ISP who's at risk of leaving"
7. Show the historical trend graph / health score to prove it's not a one-off

Steps 4–6 are where the extra-credit story (detect → explain → fix → protect revenue) gets said out loud — don't just show the features, narrate the arc.

---

## 15. Explicitly Out of Scope (state this to judges, don't hide it)

- **Native iOS/Android builds** — the PDF's R5 says "Mobile/desktop app"; Electron ships Windows/macOS/Linux from one codebase and satisfies that wording. Native mobile access to WifiManager/NetworkExtension would require ejecting from a managed mobile framework and writing native modules on two platforms with no lab hardware to test against — a bad time trade for a hackathon. A read-only mobile-web companion view is offered as an optional stretch (§7), not a gap being hidden.
- Real ISP ticketing credentials/integration — mocked per §6.3, matches what a team without ISP partnership access would legitimately do
- Real router/gateway telemetry — not required by this PS; all data comes from OS-level client APIs
- True OS-level background service (surviving app close) — the demo runs the probe in-app continuously; packaging as a Windows Service/macOS daemon is the stated production path (§6.4), not something built during the event
