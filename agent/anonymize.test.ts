import { test } from "node:test";
import assert from "node:assert/strict";
import { anonymizeWifi, hashIdentifier } from "./anonymize.ts";
import type { RawWifiFields } from "./wifi.ts";

const RAW: RawWifiFields = {
  ssid: "Redmi 9 Power",
  bssid: "56:dd:8c:45:e5:fa",
  rssi: -37,
  snr: null,
  snrSource: "unavailable",
  channel: 44,
  band: "5GHz",
  radioType: "802.11ax",
};

test("anonymizeWifi never leaks raw SSID/BSSID in its serialized output", () => {
  const salt = "test-salt";
  const telemetry = anonymizeWifi(RAW, salt);
  const serialized = JSON.stringify(telemetry);
  assert.ok(!serialized.includes(RAW.ssid!));
  assert.ok(!serialized.includes(RAW.bssid!));
  assert.ok(!serialized.toLowerCase().includes("redmi"));
});

test("anonymizeWifi preserves real signal metrics untouched", () => {
  const telemetry = anonymizeWifi(RAW, "test-salt");
  assert.equal(telemetry.rssi, -37);
  assert.equal(telemetry.channel, 44);
  assert.equal(telemetry.band, "5GHz");
  assert.equal(telemetry.snr, null);
  assert.equal(telemetry.snrSource, "unavailable");
});

test("hashIdentifier is deterministic per salt and differs across salts", () => {
  const a = hashIdentifier("same-value", "salt-a");
  const b = hashIdentifier("same-value", "salt-a");
  const c = hashIdentifier("same-value", "salt-b");
  assert.equal(a, b);
  assert.notEqual(a, c);
});

test("anonymizeWifi handles missing ssid/bssid without throwing", () => {
  const telemetry = anonymizeWifi({ ...RAW, ssid: null, bssid: null }, "test-salt");
  assert.equal(telemetry.ssidHash, "unknown");
  assert.equal(telemetry.bssidHash, "unknown");
});
