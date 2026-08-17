import { test } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { createApp } from "../server.ts";
import { openDb } from "../db.ts";
import { ZendeskAdapter } from "../adapters/zendesk.ts";

function startServer() {
  const db = openDb(":memory:");
  const adapter = new ZendeskAdapter(db);
  const server = createApp(adapter, db).listen(0);
  const { port } = server.address() as AddressInfo;
  return { server, base: `http://127.0.0.1:${port}` };
}

const TICKET_BODY = {
  createdAt: 0,
  status: "open",
  severity: "Critical",
  probeHistory: [],
  diagnostics: {
    timestamp: Date.now(),
    downstreamMbps: 5,
    upstreamMbps: 1,
    bufferbloat: { idleLatencyMs: 20, loadedLatencyMs: 900, grade: "F" },
    traceroute: [],
  },
  telemetry: {
    ssidHash: "h1",
    bssidHash: "h2",
    rssi: -80,
    snr: null,
    snrSource: "unavailable",
    channel: 6,
    band: "2.4GHz",
    radioType: null,
    platform: "win32",
    osVersion: "10.0",
  },
  summary: "severe degradation",
  attemptedFix: null,
  fixResolved: false,
};

test("POST /tickets creates a ticket, then GET /tickets/:id fetches it", async () => {
  const { server, base } = startServer();
  try {
    const created = await fetch(`${base}/tickets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(TICKET_BODY),
    }).then((r) => r.json());

    assert.equal(created.status, "open");
    assert.ok(created.id);

    const fetched = await fetch(`${base}/tickets/${created.id}`).then((r) => r.json());
    assert.deepEqual(fetched, created);
  } finally {
    server.close();
  }
});

test("GET /tickets/:id returns 404 for an unknown id", async () => {
  const { server, base } = startServer();
  try {
    const res = await fetch(`${base}/tickets/nope`);
    assert.equal(res.status, 404);
  } finally {
    server.close();
  }
});

test("PATCH /tickets/:id/status updates status and GET /tickets?status= filters on it", async () => {
  const { server, base } = startServer();
  try {
    const created = await fetch(`${base}/tickets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(TICKET_BODY),
    }).then((r) => r.json());

    const patched = await fetch(`${base}/tickets/${created.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "resolved" }),
    }).then((r) => r.json());
    assert.equal(patched.status, "resolved");

    const resolvedList = await fetch(`${base}/tickets?status=resolved`).then((r) => r.json());
    assert.equal(resolvedList.length, 1);

    const openList = await fetch(`${base}/tickets?status=open`).then((r) => r.json());
    assert.equal(openList.length, 0);
  } finally {
    server.close();
  }
});
