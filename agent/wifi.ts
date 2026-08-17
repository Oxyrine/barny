import { exec } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";

const execAsync = promisify(exec);

export interface RawWifiFields {
  ssid: string | null;
  bssid: string | null;
  rssi: number | null;
  snr: number | null;
  snrSource: "measured" | "unavailable";
  channel: number | null;
  band: "2.4GHz" | "5GHz" | "6GHz" | null;
  radioType: string | null;
}

const EMPTY: RawWifiFields = {
  ssid: null,
  bssid: null,
  rssi: null,
  snr: null,
  snrSource: "unavailable",
  channel: null,
  band: null,
  radioType: null,
};

function bandFromChannel(channel: number | null): RawWifiFields["band"] {
  if (channel === null) return null;
  if (channel <= 14) return "2.4GHz";
  if (channel <= 165) return "5GHz";
  return "6GHz";
}

// netsh emits "Key : Value" lines, one per field. Windows locale can localize the key
// names, so this is inherently best-effort — parse defensively, never throw on a miss.
export function parseNetsh(raw: string): RawWifiFields {
  const get = (key: string): string | null => {
    const m = raw.match(new RegExp(`^\\s*${key}\\s*:\\s*(.+)$`, "mi"));
    return m ? m[1].trim() : null;
  };

  const bandRaw = get("Band");
  const band: RawWifiFields["band"] =
    bandRaw?.includes("2.4") ? "2.4GHz" : bandRaw?.includes("5") ? "5GHz" : bandRaw?.includes("6") ? "6GHz" : null;

  const channelRaw = get("Channel");
  const rssiRaw = get("Rssi");

  return {
    ssid: get("SSID"),
    bssid: get("AP BSSID") ?? get("BSSID"),
    rssi: rssiRaw !== null ? Number(rssiRaw) : null,
    snr: null,
    snrSource: "unavailable", // netsh reports no noise floor — see CLAUDE.md known-gap note
    channel: channelRaw !== null ? Number(channelRaw) : null,
    band,
    radioType: get("Radio type"),
  };
}

// macOS `airport -I` reports RSSI and noise in dBm, so SNR is a real derived value here.
export function parseAirport(raw: string): RawWifiFields {
  const get = (key: string): string | null => {
    const m = raw.match(new RegExp(`^\\s*${key}\\s*:\\s*(.+)$`, "mi"));
    return m ? m[1].trim() : null;
  };

  const rssiRaw = get("agrCtlRSSI");
  const noiseRaw = get("agrCtlNoise");
  const rssi = rssiRaw !== null ? Number(rssiRaw) : null;
  const noise = noiseRaw !== null ? Number(noiseRaw) : null;
  const channelRaw = get("channel");
  const channel = channelRaw !== null ? Number(channelRaw.split(",")[0]) : null;

  return {
    ssid: get("SSID"),
    bssid: get("BSSID"),
    rssi,
    snr: rssi !== null && noise !== null ? rssi - noise : null,
    snrSource: rssi !== null && noise !== null ? "measured" : "unavailable",
    channel,
    band: bandFromChannel(channel),
    radioType: null,
  };
}

// `nmcli -t -f active,ssid,bssid,chan,freq,signal dev wifi` — terse, colon-separated.
// Signal is a 0-100 quality figure, not dBm; the dBm conversion below is a standard
// linear approximation, not a measurement — flagged via snrSource staying "unavailable".
export function parseNmcli(raw: string): RawWifiFields {
  const activeLine = raw.split("\n").find((l) => l.startsWith("yes:"));
  if (!activeLine) return EMPTY;

  const parts = activeLine.split(/(?<!\\):/).map((p) => p.replace(/\\:/g, ":").trim());
  const [, ssid, bssid, chan, , signal] = parts;
  const channel = chan ? Number(chan) : null;
  const quality = signal ? Number(signal) : null;
  const rssi = quality !== null ? Math.round(quality / 2 - 100) : null;

  return {
    ssid: ssid || null,
    bssid: bssid || null,
    rssi,
    snr: null,
    snrSource: "unavailable",
    channel,
    band: bandFromChannel(channel),
    radioType: null,
  };
}

const DEBUG = process.argv.includes("--debug-wifi");

export async function getWifiInfo(): Promise<RawWifiFields> {
  try {
    if (process.platform === "win32") {
      const { stdout } = await execAsync("netsh wlan show interfaces");
      if (DEBUG) console.error("[wifi:netsh]\n" + stdout);
      return parseNetsh(stdout);
    }
    if (process.platform === "darwin") {
      const airportPath =
        "/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport";
      const { stdout } = await execAsync(`${airportPath} -I`);
      if (DEBUG) console.error("[wifi:airport]\n" + stdout);
      return parseAirport(stdout);
    }
    if (process.platform === "linux") {
      const { stdout } = await execAsync("nmcli -t -f active,ssid,bssid,chan,freq,signal dev wifi");
      if (DEBUG) console.error("[wifi:nmcli]\n" + stdout);
      return parseNmcli(stdout);
    }
    return EMPTY;
  } catch (err) {
    if (DEBUG) console.error("[wifi] shell-out failed:", err);
    return EMPTY;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  getWifiInfo().then((info) => console.log(JSON.stringify(info, null, 2)));
}
