import { test } from "node:test";
import assert from "node:assert/strict";
import { getSelfHealSuggestion, type SelfHealInput } from "./selfheal.ts";
import type { ProbeSample, WifiTelemetry, DiagnosticResult, AppConfig } from "../shared/types.ts";

const BASE_CONFIG: AppConfig = {
  thresholds: { latencyMs: 150, latencyConsecutive: 3, packetLossPct: 5, dnsMs: 300 },
  probeIntervalIdleMs: 15000,
  probeIntervalSuspectMs: 5000,
  triggerCooldownMs: 60000,
};

const okSample = (overrides: Partial<ProbeSample> = {}): ProbeSample => ({
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

const okWifi = (overrides: Partial<WifiTelemetry> = {}): WifiTelemetry => ({
  ssidHash: "abc",
  bssidHash: "def",
  rssi: -45,
  snr: null,
  snrSource: "unavailable",
  channel: 44,
  band: "5GHz",
  radioType: "802.11ax",
  platform: "win32",
  osVersion: "10.0.0",
  ...overrides,
});

function makeInput(overrides: Partial<SelfHealInput> = {}): SelfHealInput {
  return {
    recentSamples: [okSample()],
    wifi: okWifi(),
    diagnostics: okDiag(),
    config: BASE_CONFIG,
    ...overrides,
  };
}

test("returns null when everything is healthy", () => {
  const result = getSelfHealSuggestion(makeInput());
  assert.equal(result, null);
});

test("band-switch fires when on 2.4GHz with high average latency", () => {
  const input = makeInput({
    wifi: okWifi({ band: "2.4GHz" }),
    recentSamples: [okSample({ latencyMs: 200 }), okSample({ latencyMs: 250 })],
  });
  const result = getSelfHealSuggestion(input);
  assert.equal(result?.id, "band-switch");
});

test("band-switch does NOT fire on 5GHz even with high latency", () => {
  const input = makeInput({
    wifi: okWifi({ band: "5GHz" }),
    recentSamples: [okSample({ latencyMs: 300 })],
  });
  const result = getSelfHealSuggestion(input);
  assert.notEqual(result?.id, "band-switch");
});

test("dns-resolver fires when DNS is slow but latency is fine", () => {
  const input = makeInput({
    recentSamples: [okSample({ dnsMs: 400, latencyMs: 30 })],
  });
  const result = getSelfHealSuggestion(input);
  assert.equal(result?.id, "dns-resolver");
});

test("dns-resolver does NOT fire when latency is also bad", () => {
  const input = makeInput({
    recentSamples: [okSample({ dnsMs: 400, latencyMs: 300 })],
  });
  const result = getSelfHealSuggestion(input);
  assert.notEqual(result?.id, "dns-resolver");
});

test("relocate fires when RSSI is below -70 dBm", () => {
  const input = makeInput({ wifi: okWifi({ rssi: -80 }) });
  const result = getSelfHealSuggestion(input);
  assert.equal(result?.id, "relocate");
});

test("relocate does NOT fire when RSSI is -69 dBm", () => {
  const input = makeInput({ wifi: okWifi({ rssi: -69 }) });
  const result = getSelfHealSuggestion(input);
  assert.notEqual(result?.id, "relocate");
});

test("sqm fires on bufferbloat grade F with good throughput", () => {
  const input = makeInput({
    diagnostics: { ...okDiag(), downstreamMbps: 40, bufferbloat: { idleLatencyMs: 20, loadedLatencyMs: 400, grade: "F" } },
  });
  const result = getSelfHealSuggestion(input);
  assert.equal(result?.id, "sqm");
});

test("sqm does NOT fire on bufferbloat D with low throughput (< 5 Mbps)", () => {
  const input = makeInput({
    diagnostics: { ...okDiag(), downstreamMbps: 3, bufferbloat: { idleLatencyMs: 20, loadedLatencyMs: 250, grade: "D" } },
  });
  const result = getSelfHealSuggestion(input);
  assert.notEqual(result?.id, "sqm");
});

test("reboot fires when packet loss exceeds 20%", () => {
  const samples = Array.from({ length: 10 }, (_, i) => okSample({ packetLoss: i < 3 }));
  const input = makeInput({ recentSamples: samples });
  // 3/10 = 30% loss — should fire
  const result = getSelfHealSuggestion(input);
  assert.equal(result?.id, "reboot");
});

test("reboot does NOT fire at exactly 20% packet loss", () => {
  // Exactly 20% — rule requires > 20
  const samples = Array.from({ length: 10 }, (_, i) => okSample({ packetLoss: i < 2 }));
  const input = makeInput({ recentSamples: samples });
  const result = getSelfHealSuggestion(input);
  assert.notEqual(result?.id, "reboot");
});

test("returned suggestion has id, message, and condition fields", () => {
  const input = makeInput({ wifi: okWifi({ rssi: -80 }) });
  const result = getSelfHealSuggestion(input);
  assert.ok(result);
  assert.ok(typeof result.id === "string" && result.id.length > 0);
  assert.ok(typeof result.message === "string" && result.message.length > 0);
  assert.ok(typeof result.condition === "string" && result.condition.length > 0);
});
