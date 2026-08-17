import { test } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { createApp } from "../server.ts";
import { openDb } from "../db.ts";
import { ZendeskAdapter } from "../adapters/zendesk.ts";
import type { TicketPayload, ProbeSample } from "../../shared/types.ts";

function startServer() {
  const db = openDb(":memory:");
  const adapter = new ZendeskAdapter(db);
  const server = createApp(adapter, db).listen(0);
  const { port } = server.address() as AddressInfo;
  return { server, base: `http://127.0.0.1:${port}`, adapter };
}

function sample(overrides: Partial<ProbeSample> = {}): ProbeSample {
  return { timestamp: Date.now(), latencyMs: 20, packetLoss: false, dnsMs: 10, httpOk: true, cpuPercent: 1, ...overrides };
}

function fixture(overrides: Partial<TicketPayload> = {}): TicketPayload {
  return {
    createdAt: 0,
    status: "open",
    severity: "Critical", // deliberately wrong client-reported severity — server must ignore it
    probeHistory: [sample()],
    diagnostics: {
      timestamp: Date.now(),
      downstreamMbps: 50,
      upstreamMbps: 10,
      bufferbloat: { idleLatencyMs: 10, loadedLatencyMs: 12, grade: "A" },
      traceroute: [],
    },
    telemetry: {
      ssidHash: "home-x",
      bssidHash: "b",
      rssi: -50,
      snr: null,
      snrSource: "unavailable",
      channel: 44,
      band: "5GHz",
      radioType: null,
      platform: "win32",
      osVersion: "10",
    },
    summary: "s",
    attemptedFix: null,
    fixResolved: false,
    ...overrides,
  };
}

test("GET /agent/queue re-triages server-side and ignores the client-reported severity", async () => {
  const { server, base, adapter } = startServer();
  try {
    // healthy samples -> triage should score this Minor, even though the client claimed Critical
    adapter.createTicket(fixture());

    const queue = await fetch(`${base}/agent/queue`).then((r) => r.json());
    assert.equal(queue.length, 1);
    assert.equal(queue[0].severity, "Minor");
  } finally {
    server.close();
  }
});

test("GET /agent/queue sorts Critical before Degraded before Minor", async () => {
  const { server, base, adapter } = startServer();
  try {
    adapter.createTicket(fixture({ probeHistory: [sample()] })); // Minor
    adapter.createTicket(
      fixture({ probeHistory: Array.from({ length: 10 }, () => sample({ latencyMs: 400 })) }), // Critical (avg > 300ms)
    );
    adapter.createTicket(
      fixture({ probeHistory: Array.from({ length: 10 }, () => sample({ latencyMs: 200 })) }), // Degraded (avg > 150ms)
    );

    const queue = await fetch(`${base}/agent/queue`).then((r) => r.json());
    assert.deepEqual(
      queue.map((t: { severity: string }) => t.severity),
      ["Critical", "Degraded", "Minor"],
    );
  } finally {
    server.close();
  }
});

test("GET /agent/queue annotates churnRisk once a subscriber crosses the ticket threshold", async () => {
  const { server, base, adapter } = startServer();
  try {
    adapter.createTicket(fixture());
    adapter.createTicket(fixture());
    adapter.createTicket(fixture());

    const queue = await fetch(`${base}/agent/queue`).then((r) => r.json());
    assert.ok(queue.every((t: { churnRisk: boolean }) => t.churnRisk === true));
  } finally {
    server.close();
  }
});

test("responses carry CORS headers so the dashboard can fetch this backend cross-origin", async () => {
  const { server, base } = startServer();
  try {
    const res = await fetch(`${base}/agent/queue`);
    assert.equal(res.headers.get("access-control-allow-origin"), "*");
  } finally {
    server.close();
  }
});

test("GET /agent/churn-risk only returns ssidHashes at or above the threshold", async () => {
  const { server, base, adapter } = startServer();
  try {
    adapter.createTicket(fixture({ telemetry: { ...fixture().telemetry, ssidHash: "below-threshold" } }));
    adapter.createTicket(fixture({ telemetry: { ...fixture().telemetry, ssidHash: "at-threshold" } }));
    adapter.createTicket(fixture({ telemetry: { ...fixture().telemetry, ssidHash: "at-threshold" } }));
    adapter.createTicket(fixture({ telemetry: { ...fixture().telemetry, ssidHash: "at-threshold" } }));

    const risk = await fetch(`${base}/agent/churn-risk`).then((r) => r.json());
    assert.equal(risk.length, 1);
    assert.equal(risk[0].ssidHash, "at-threshold");
  } finally {
    server.close();
  }
});
