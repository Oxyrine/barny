import { test } from "node:test";
import assert from "node:assert/strict";
import { triageTicket } from "./triage.ts";
import type { TicketPayload, ProbeSample } from "../shared/types.ts";

const sample = (overrides: Partial<ProbeSample> = {}): ProbeSample => ({
  timestamp: Date.now(),
  latencyMs: 30,
  packetLoss: false,
  dnsMs: 20,
  httpOk: true,
  cpuPercent: 1,
  ...overrides,
});

const baseDiag = {
  timestamp: Date.now(),
  downstreamMbps: 50,
  upstreamMbps: 10,
  bufferbloat: { idleLatencyMs: 20, loadedLatencyMs: 25, grade: "A" as const },
  traceroute: [],
};

function makePayload(overrides: {
  samples?: ProbeSample[];
  grade?: "A" | "B" | "C" | "D" | "F";
}): TicketPayload {
  return {
    createdAt: Date.now(),
    status: "open",
    severity: "Minor", // client-reported; triage overrides this
    probeHistory: overrides.samples ?? [sample()],
    diagnostics: { ...baseDiag, bufferbloat: { ...baseDiag.bufferbloat, grade: overrides.grade ?? "A" } },
    telemetry: {
      ssidHash: "x",
      bssidHash: "y",
      rssi: -45,
      snr: null,
      snrSource: "unavailable",
      channel: 44,
      band: "5GHz",
      radioType: null,
      platform: "win32",
      osVersion: "10.0",
    },
    summary: "test",
    attemptedFix: null,
    fixResolved: false,
  };
}

test("triageTicket: healthy samples → Minor", () => {
  assert.equal(triageTicket(makePayload({})), "Minor");
});

test("triageTicket: >20% packet loss → Critical", () => {
  const samples = Array.from({ length: 10 }, (_, i) => sample({ packetLoss: i < 3 }));
  assert.equal(triageTicket(makePayload({ samples })), "Critical");
});

test("triageTicket: total latency failure (all null) → Critical", () => {
  const samples = Array.from({ length: 5 }, () => sample({ latencyMs: null }));
  assert.equal(triageTicket(makePayload({ samples })), "Critical");
});

test("triageTicket: bufferbloat F → Critical", () => {
  assert.equal(triageTicket(makePayload({ grade: "F" })), "Critical");
});

test("triageTicket: bufferbloat D → Critical (severe)", () => {
  assert.equal(triageTicket(makePayload({ grade: "D" })), "Critical");
});

test("triageTicket: avg latency > 300ms → Critical", () => {
  const samples = [sample({ latencyMs: 400 }), sample({ latencyMs: 350 })];
  assert.equal(triageTicket(makePayload({ samples })), "Critical");
});

test("triageTicket: any packet loss → at least Degraded", () => {
  const samples = [sample({ packetLoss: true }), ...Array.from({ length: 9 }, () => sample())];
  const result = triageTicket(makePayload({ samples }));
  assert.ok(result === "Degraded" || result === "Critical");
});

test("triageTicket: avg latency 180ms (above 150) → Degraded", () => {
  const samples = [sample({ latencyMs: 180 }), sample({ latencyMs: 180 })];
  assert.equal(triageTicket(makePayload({ samples })), "Degraded");
});

test("triageTicket: empty probeHistory → Minor (safe default)", () => {
  const payload = makePayload({});
  payload.probeHistory = [];
  assert.equal(triageTicket(payload), "Minor");
});
