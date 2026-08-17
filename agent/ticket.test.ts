import { test } from "node:test";
import assert from "node:assert/strict";
import { buildTicketPayload, deriveTicketSeverity } from "./ticket.ts";
import type { ProbeSample, DiagnosticResult, WifiTelemetry } from "../shared/types.ts";

const sample = (overrides: Partial<ProbeSample> = {}): ProbeSample => ({
  timestamp: Date.now(),
  latencyMs: 30,
  packetLoss: false,
  dnsMs: 20,
  httpOk: true,
  cpuPercent: 1,
  ...overrides,
});

const okDiag = (): DiagnosticResult => ({
  timestamp: Date.now(),
  downstreamMbps: 50,
  upstreamMbps: 10,
  bufferbloat: { idleLatencyMs: 20, loadedLatencyMs: 25, grade: "A" },
  traceroute: [],
});

const okWifi = (): WifiTelemetry => ({
  ssidHash: "abc123",
  bssidHash: "def456",
  rssi: -45,
  snr: null,
  snrSource: "unavailable",
  channel: 44,
  band: "5GHz",
  radioType: "802.11ax",
  platform: "win32",
  osVersion: "10.0.0",
});

test("deriveTicketSeverity: critical status → Critical", () => {
  assert.equal(deriveTicketSeverity("critical", [sample()]), "Critical");
});

test("deriveTicketSeverity: degraded status, no high loss → Degraded", () => {
  assert.equal(deriveTicketSeverity("degraded", [sample()]), "Degraded");
});

test("deriveTicketSeverity: degraded status with >10% loss → Critical", () => {
  const samples = Array.from({ length: 10 }, (_, i) => sample({ packetLoss: i < 2 }));
  // 2/10 = 20% loss → Critical
  assert.equal(deriveTicketSeverity("degraded", samples), "Critical");
});

test("deriveTicketSeverity: good status → Minor", () => {
  assert.equal(deriveTicketSeverity("good", [sample()]), "Minor");
});

test("buildTicketPayload produces a well-formed payload", () => {
  const samples = [sample({ latencyMs: 200 }), sample({ latencyMs: 220 })];
  const payload = buildTicketPayload("degraded", samples, okDiag(), okWifi(), null, false);

  assert.equal(payload.status, "open");
  assert.equal(payload.severity, "Degraded");
  assert.ok(typeof payload.summary === "string" && payload.summary.length > 0);
  assert.equal(payload.attemptedFix, null);
  assert.equal(payload.fixResolved, false);
  assert.ok(Array.isArray(payload.probeHistory));
  assert.ok(payload.probeHistory.length > 0);
});

test("buildTicketPayload attaches suggestion when provided", () => {
  const suggestion = { id: "relocate", condition: "RSSI below −70 dBm", message: "Move closer to router." };
  const payload = buildTicketPayload("degraded", [sample()], okDiag(), okWifi(), suggestion, false);
  assert.deepEqual(payload.attemptedFix, suggestion);
});

test("buildTicketPayload trims probe window to last 20 samples", () => {
  const samples = Array.from({ length: 50 }, () => sample());
  const payload = buildTicketPayload("degraded", samples, okDiag(), okWifi(), null, false);
  assert.ok(payload.probeHistory.length <= 20);
});

test("buildTicketPayload summary is a non-empty string quoting metrics", () => {
  const samples = [sample({ latencyMs: 300 }), sample({ latencyMs: 320 })];
  const payload = buildTicketPayload("degraded", samples, okDiag(), okWifi(), null, false);
  // Summary should include ms somewhere since latency is dominant
  assert.ok(payload.summary.includes("ms") || payload.summary.includes("Mbps"), payload.summary);
});
