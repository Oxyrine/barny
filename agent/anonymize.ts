import { createHmac, randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { RawWifiFields } from "./wifi.ts";
import type { WifiTelemetry } from "../shared/types.ts";

const SALT_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".wifi-salt");

// One random salt per install, generated once and kept local. HMAC output is not
// reversible and, without the salt, not linkable across devices — it never leaves this
// machine, so raw SSID/BSSID never has to either.
export function getOrCreateSalt(): string {
  if (existsSync(SALT_PATH)) return readFileSync(SALT_PATH, "utf8").trim();
  const salt = randomBytes(32).toString("hex");
  writeFileSync(SALT_PATH, salt, "utf8");
  return salt;
}

export function hashIdentifier(value: string, salt: string): string {
  return createHmac("sha256", salt).update(value).digest("hex");
}

export function anonymizeWifi(raw: RawWifiFields, salt: string): WifiTelemetry {
  return {
    ssidHash: raw.ssid ? hashIdentifier(raw.ssid, salt) : "unknown",
    bssidHash: raw.bssid ? hashIdentifier(raw.bssid, salt) : "unknown",
    rssi: raw.rssi,
    snr: raw.snr,
    snrSource: raw.snrSource,
    channel: raw.channel,
    band: raw.band,
    radioType: raw.radioType,
    platform: process.platform,
    osVersion: os.release(), // coarse version string only — no hostname, no user, no GPS
  };
}
