// Simulation script — injects synthetic degraded samples into the live agent probe stream
// via POST /api/simulate, then polls /api/state and /api/history until the full pipeline
// (probe → trigger → diagnostics → self-heal → ticket) completes. Prints each stage.
// Usage: node scripts/simulate-degradation.ts
// Both the agent (:4100) and backend (:4000) must be running.

const AGENT = process.env.AGENT_URL ?? "http://localhost:4100";
const BACKEND = process.env.BACKEND_URL ?? "http://localhost:4000";

const BOLD = (s: string) => `\x1b[1m${s}\x1b[0m`;
const GREEN = (s: string) => `\x1b[32m${s}\x1b[0m`;
const YELLOW = (s: string) => `\x1b[33m${s}\x1b[0m`;
const RED = (s: string) => `\x1b[31m${s}\x1b[0m`;
const CYAN = (s: string) => `\x1b[36m${s}\x1b[0m`;
const DIM = (s: string) => `\x1b[2m${s}\x1b[0m`;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function checkAlive(url: string, name: string): Promise<boolean> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
    return res.ok || res.status < 500;
  } catch {
    return false;
  }
}

// injectedAt guards against reporting a pre-existing diagnostic run or ticket as this
// script's own result — on a real (especially flaky) network the live probe loop can
// independently trigger its own breach around the same time, and grabbing "the first open
// ticket" or "the newest diagnostic" without checking its timestamp would silently report
// success against unrelated evidence instead of what was actually just injected.
async function waitForPipeline(injectedAt: number): Promise<{ ticketId: string | null; diagFound: boolean }> {
  const deadline = Date.now() + 120_000; // 2-minute timeout
  let diagFound = false;
  let ticketId: string | null = null;

  while (Date.now() < deadline) {
    await sleep(2000);

    // Check diagnostic history on the agent
    try {
      const history = (await fetch(`${AGENT}/api/history`).then((r) => r.json())) as any[];
      const d = history.find((h) => h.timestamp >= injectedAt);
      if (d && !diagFound) {
        console.log(
          `\n${CYAN("[diag]")}     down ${d.downstreamMbps.toFixed(1)} Mbps, up ${d.upstreamMbps.toFixed(1)} Mbps, ` +
            `bufferbloat ${d.bufferbloat.grade}, traceroute ${d.traceroute.length} hop(s)`,
        );
        diagFound = true;
      }
    } catch {}

    // Check for new tickets on the backend — only ones created after injection
    try {
      const tickets = (await fetch(`${BACKEND}/tickets?status=open`).then((r) => r.json())) as any[];
      const t = tickets.find((x) => x.createdAt >= injectedAt);
      if (t && !ticketId) {
        ticketId = t.id;
        const color = t.severity === "Critical" ? RED : t.severity === "Degraded" ? YELLOW : GREEN;
        console.log(`${CYAN("[ticket]")}   POSTed → id ${BOLD(t.id)}, severity ${color(t.severity)}, status ${t.status}`);
        if (t.attemptedFix) {
          console.log(`${CYAN("[selfheal]")} attempted: ${t.attemptedFix.id} — ${t.attemptedFix.condition}`);
        }
        console.log(`${CYAN("[summary]")}  ${DIM(t.summary.slice(0, 120))}…`);
      }
    } catch {}

    if (diagFound && ticketId) break;
  }

  return { ticketId, diagFound };
}

async function main() {
  console.log(BOLD("\n╔══ PS-S03 Degradation Simulation ══╗\n"));

  // Health check
  const agentOk = await checkAlive(`${AGENT}/api/state`, "agent");
  const backendOk = await checkAlive(`${BACKEND}/tickets`, "backend");

  if (!agentOk) {
    console.error(RED(`[error] Agent not reachable at ${AGENT} — run: npm run dev:agent`));
    process.exit(1);
  }
  if (!backendOk) {
    console.error(RED(`[error] Backend not reachable at ${BACKEND} — run: npm run dev:backend`));
    process.exit(1);
  }

  console.log(`${GREEN("✔")} agent at ${AGENT}`);
  console.log(`${GREEN("✔")} backend at ${BACKEND}\n`);

  // Print current state before injection
  const before = (await fetch(`${AGENT}/api/state`).then((r) => r.json())) as any;
  const wifi = before.wifi;
  if (wifi) {
    console.log(
      `${DIM("[wifi]")}     RSSI ${wifi.rssi ?? "n/a"} dBm, band ${wifi.band ?? "n/a"}, ch ${wifi.channel ?? "n/a"}, ${wifi.radioType ?? "n/a"}`,
    );
  }
  console.log(`${DIM("[state]")}    status before injection: ${before.status ?? "unknown"}\n`);

  // Inject synthetic bad samples — enough to breach the consecutive-latency threshold
  // (default: 3 consecutive) plus packet loss to push loss% above threshold
  const INJECT_COUNT = 8;
  console.log(`${CYAN("[simulate]")} injecting ${INJECT_COUNT} degraded samples (latency 380ms, packetLoss: true)…`);

  const injectedAt = Date.now();
  const injRes = await fetch(`${AGENT}/api/simulate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ count: INJECT_COUNT, latencyMs: 380, packetLoss: true }),
  });

  if (!injRes.ok) {
    console.error(RED(`[error] simulate endpoint returned ${injRes.status}`));
    process.exit(1);
  }

  const { injected } = (await injRes.json()) as { injected: number };
  console.log(`${CYAN("[probe]")}    ${injected} samples injected → threshold should breach\n`);

  // Wait for the full pipeline to complete
  console.log(DIM("waiting for pipeline… (diagnostics + ticket, up to 2 minutes)"));
  const { diagFound, ticketId } = await waitForPipeline(injectedAt);

  // Final summary
  console.log();
  if (diagFound && ticketId) {
    console.log(GREEN(BOLD("✔ Full pipeline completed: probe → trigger → diagnostics → self-heal → ticket")));
    console.log(DIM(`  ISP agent queue: ${BACKEND}/agent/queue`));
    console.log(DIM(`  Churn risk:      ${BACKEND}/agent/churn-risk`));
    console.log(DIM(`  Ticket:          ${BACKEND}/tickets/${ticketId}`));
  } else if (diagFound) {
    console.log(YELLOW("⚠ Diagnostics ran but no ticket was filed (backend may be unreachable from agent)"));
  } else {
    console.log(RED("✗ Pipeline did not complete within 2 minutes — check agent logs"));
  }

  console.log();
}

main().catch((err) => {
  console.error(RED("[fatal]"), err);
  process.exit(1);
});
