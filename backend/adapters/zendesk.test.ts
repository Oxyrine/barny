import { test } from "node:test";
import assert from "node:assert/strict";
import { openDb } from "../db.ts";
import { ZendeskAdapter } from "./zendesk.ts";
import type { TicketPayload } from "../../shared/types.ts";

function fixture(overrides: Partial<TicketPayload> = {}): TicketPayload {
  return {
    createdAt: 0,
    status: "open",
    severity: "Degraded",
    probeHistory: [],
    diagnostics: {
      timestamp: Date.now(),
      downstreamMbps: 50,
      upstreamMbps: 10,
      bufferbloat: { idleLatencyMs: 20, loadedLatencyMs: 200, grade: "C" },
      traceroute: [],
    },
    telemetry: {
      ssidHash: "h1",
      bssidHash: "h2",
      rssi: -60,
      snr: null,
      snrSource: "unavailable",
      channel: 44,
      band: "5GHz",
      radioType: "802.11ax",
      platform: "win32",
      osVersion: "10.0",
    },
    summary: "test summary",
    attemptedFix: null,
    fixResolved: false,
    ...overrides,
  };
}

function makeAdapter() {
  return new ZendeskAdapter(openDb(":memory:"));
}

test("createTicket assigns an id and forces status to open", () => {
  const adapter = makeAdapter();
  const ticket = adapter.createTicket(fixture({ status: "resolved" }));
  assert.ok(ticket.id);
  assert.equal(ticket.status, "open");
});

test("getTicket round-trips a created ticket", () => {
  const adapter = makeAdapter();
  const created = adapter.createTicket(fixture());
  const fetched = adapter.getTicket(created.id!);
  assert.deepEqual(fetched, created);
});

test("getTicket returns null for an unknown id", () => {
  const adapter = makeAdapter();
  assert.equal(adapter.getTicket("does-not-exist"), null);
});

test("listTickets filters by status and orders newest first", async () => {
  const adapter = makeAdapter();
  const a = adapter.createTicket(fixture());
  await new Promise((r) => setTimeout(r, 5));
  const b = adapter.createTicket(fixture());
  adapter.updateStatus(a.id!, "resolved");

  const open = adapter.listTickets("open");
  assert.equal(open.length, 1);
  assert.equal(open[0].id, b.id);

  const all = adapter.listTickets();
  assert.equal(all.length, 2);
  assert.equal(all[0].id, b.id); // newest first
});

test("updateStatus changes status and returns null for an unknown id", () => {
  const adapter = makeAdapter();
  const ticket = adapter.createTicket(fixture());
  const updated = adapter.updateStatus(ticket.id!, "in-progress");
  assert.equal(updated!.status, "in-progress");
  assert.equal(adapter.updateStatus("nope", "resolved"), null);
});
