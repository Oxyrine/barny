import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { openDb } from "./db.ts";
import { getChurnRisk } from "./churn.ts";
import type { TicketPayload } from "../shared/types.ts";

function ticket(ssidHash: string, createdAt: number): TicketPayload {
  return {
    id: randomUUID(),
    createdAt,
    status: "open",
    severity: "Minor",
    probeHistory: [],
    diagnostics: {
      timestamp: createdAt,
      downstreamMbps: 50,
      upstreamMbps: 10,
      bufferbloat: { idleLatencyMs: 10, loadedLatencyMs: 12, grade: "A" },
      traceroute: [],
    },
    telemetry: {
      ssidHash,
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
  };
}

function insert(db: DatabaseSync, t: TicketPayload) {
  db.prepare("INSERT INTO tickets (id, created_at, status, severity, payload) VALUES (?, ?, ?, ?, ?)").run(
    t.id!,
    t.createdAt,
    t.status,
    t.severity,
    JSON.stringify(t),
  );
}

test("getChurnRisk flags an ssidHash with >= 3 tickets in the window", () => {
  const db = openDb(":memory:");
  const now = Date.now();
  insert(db, ticket("home-a", now));
  insert(db, ticket("home-a", now - 1000));
  insert(db, ticket("home-a", now - 2000));

  const result = getChurnRisk(db);
  assert.equal(result.length, 1);
  assert.equal(result[0].ssidHash, "home-a");
  assert.equal(result[0].ticketCount, 3);
  assert.equal(result[0].churnRisk, true);
});

test("getChurnRisk does not flag under the threshold", () => {
  const db = openDb(":memory:");
  const now = Date.now();
  insert(db, ticket("home-b", now));
  insert(db, ticket("home-b", now - 1000));

  const result = getChurnRisk(db);
  assert.equal(result[0].ticketCount, 2);
  assert.equal(result[0].churnRisk, false);
});

test("getChurnRisk excludes tickets outside the 7-day rolling window", () => {
  const db = openDb(":memory:");
  const now = Date.now();
  const EIGHT_DAYS = 8 * 24 * 60 * 60 * 1000;
  insert(db, ticket("home-c", now - EIGHT_DAYS));
  insert(db, ticket("home-c", now - EIGHT_DAYS));
  insert(db, ticket("home-c", now - EIGHT_DAYS));

  assert.equal(getChurnRisk(db).length, 0);
});

test("getChurnRisk keeps different ssidHashes separate", () => {
  const db = openDb(":memory:");
  const now = Date.now();
  insert(db, ticket("home-d", now));
  insert(db, ticket("home-e", now));

  const result = getChurnRisk(db);
  assert.equal(result.length, 2);
});
