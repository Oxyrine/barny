import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSummary, dominantSymptom } from "./summary.ts";
import type { ProbeSample, DiagnosticResult } from "../shared/types.ts";

const okDiag = (): DiagnosticResult => ({
  timestamp: Date.now(),
  downstreamMbps: 50,
  upstreamMbps: 10,
  bufferbloat: { idleLatencyMs: 20, loadedLatencyMs: 25, grade: "A" },
  traceroute: [],
});

const sample = (overrides: Partial<ProbeSample> = {}): ProbeSample => ({
  timestamp: Date.now(),
  latencyMs: 30,
  packetLoss: false,
  dnsMs: 20,
  httpOk: true,
  cpuPercent: 1,
  ...overrides,
});

test("dominantSymptom: packet-loss wins when loss > 5%", () => {
  const samples = Array.from({ length: 10 }, (_, i) => sample({ packetLoss: i < 3 }));
  assert.equal(dominantSymptom(samples, okDiag()), "packet-loss");
});

test("dominantSymptom: high-latency when avg > 150ms and no loss", () => {
  const samples = [sample({ latencyMs: 200 }), sample({ latencyMs: 250 })];
  assert.equal(dominantSymptom(samples, okDiag()), "high-latency");
});

test("dominantSymptom: bufferbloat when grade D/F and throughput fine", () => {
  const samples = [sample()];
  const diag = { ...okDiag(), bufferbloat: { idleLatencyMs: 20, loadedLatencyMs: 300, grade: "F" as const } };
  assert.equal(dominantSymptom(samples, diag), "bufferbloat");
});

test("dominantSymptom: throughput when download < 5 Mbps", () => {
  const diag = { ...okDiag(), downstreamMbps: 2 };
  assert.equal(dominantSymptom([sample()], diag), "throughput");
});

test("dominantSymptom: general when everything is borderline", () => {
  assert.equal(dominantSymptom([sample()], okDiag()), "general");
});

test("high-latency template contains average latency value", () => {
  const samples = [sample({ latencyMs: 220 }), sample({ latencyMs: 280 })];
  const result = buildSummary(samples, okDiag(), null);
  assert.ok(result.includes("250"), `Expected '250' in: ${result}`);
});

test("packet-loss template contains loss percentage", () => {
  const samples = Array.from({ length: 10 }, (_, i) => sample({ packetLoss: i < 3 }));
  const result = buildSummary(samples, okDiag(), null);
  assert.ok(result.includes("30%"), `Expected '30%' in: ${result}`);
});

test("bufferbloat template contains grade, idle ms, and loaded ms", () => {
  const diag = { ...okDiag(), bufferbloat: { idleLatencyMs: 30, loadedLatencyMs: 400, grade: "F" as const } };
  const result = buildSummary([sample()], diag, null);
  assert.ok(result.includes("F"), `Expected grade 'F' in: ${result}`);
  assert.ok(result.includes("30"), `Expected idle '30' in: ${result}`);
  assert.ok(result.includes("400"), `Expected loaded '400' in: ${result}`);
});

test("throughput template contains download speed", () => {
  const diag = { ...okDiag(), downstreamMbps: 1.5 };
  const result = buildSummary([sample()], diag, null);
  assert.ok(result.includes("1.5"), `Expected '1.5' in: ${result}`);
});

test("summary appends self-heal suggestion when provided", () => {
  const suggestion = { id: "relocate", condition: "RSSI below −70 dBm", message: "Move closer to router." };
  const result = buildSummary([sample()], okDiag(), suggestion);
  assert.ok(result.includes("Move closer to router"), `Expected suggestion message in: ${result}`);
  assert.ok(result.includes("RSSI below"), `Expected condition in: ${result}`);
});

test("summary returns plain string with no null values embedded", () => {
  const result = buildSummary([sample()], okDiag(), null);
  assert.ok(!result.includes("null"), `Should not contain 'null': ${result}`);
  assert.ok(result.length > 50, "Summary should be non-trivial");
});
