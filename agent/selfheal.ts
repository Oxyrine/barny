import type { ProbeSample, WifiTelemetry, DiagnosticResult, SelfHealSuggestion, AppConfig } from "../shared/types.ts";

export interface SelfHealInput {
  recentSamples: ProbeSample[];
  wifi: WifiTelemetry | null;
  diagnostics: DiagnosticResult;
  config: AppConfig;
}

// Each rule is a pure predicate + suggestion. Rules are evaluated in priority order;
// the first match wins and is returned to the caller for surfacing to the user.
// Returning null means no actionable self-heal suggestion exists → escalate to ticket.
const RULES: Array<{
  id: string;
  condition: string;
  message: string;
  match: (input: SelfHealInput) => boolean;
}> = [
  {
    id: "band-switch",
    condition: "2.4 GHz band detected with elevated latency",
    message:
      "Your router is connected on the 2.4 GHz band, which is more congested and has higher latency. " +
      "Switch your device to the 5 GHz network (look for an SSID ending in '_5G' or similar) " +
      "for lower latency and less interference.",
    match: ({ wifi, recentSamples, config }) => {
      if (wifi?.band !== "2.4GHz") return false;
      const latencies = recentSamples.map((s) => s.latencyMs).filter((l): l is number => l !== null);
      if (latencies.length === 0) return false;
      const avg = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      return avg > config.thresholds.latencyMs;
    },
  },
  {
    id: "dns-resolver",
    condition: "DNS resolution is slow but raw latency is healthy",
    message:
      "Your DNS lookups are taking longer than expected, but your raw network latency is fine. " +
      "Your ISP's DNS resolver may be slow or overloaded. " +
      "Try switching to a faster public resolver: set your DNS to 1.1.1.1 (Cloudflare) or 8.8.8.8 (Google) " +
      "in your network adapter settings.",
    match: ({ recentSamples, config }) => {
      const last = recentSamples[recentSamples.length - 1];
      if (!last) return false;
      const dnsBad = last.dnsMs !== null && last.dnsMs > config.thresholds.dnsMs;
      const latencyOk = last.latencyMs !== null && last.latencyMs <= config.thresholds.latencyMs;
      return dnsBad && latencyOk;
    },
  },
  {
    id: "relocate",
    condition: "RSSI below −70 dBm — weak signal",
    message:
      "Your Wi-Fi signal strength is very weak (RSSI below −70 dBm). " +
      "Move your device closer to the router, or consider a Wi-Fi extender / mesh node " +
      "to improve coverage in this area.",
    match: ({ wifi }) => {
      return wifi?.rssi !== null && wifi.rssi !== undefined && wifi.rssi < -70;
    },
  },
  {
    id: "sqm",
    condition: "Bufferbloat grade D or F with adequate throughput",
    message:
      "Your connection has significant bufferbloat (latency spikes under load) but adequate throughput. " +
      "Enable SQM (Smart Queue Management) or fq_codel on your router to reduce latency under load. " +
      "On OpenWrt routers, go to Network → SQM QoS. Consumer routers may call this 'QoS' or 'Traffic Control'.",
    match: ({ diagnostics }) => {
      const grade = diagnostics.bufferbloat.grade;
      const goodThroughput = diagnostics.downstreamMbps > 5;
      return (grade === "D" || grade === "F") && goodThroughput;
    },
  },
  {
    id: "reboot",
    condition: "High packet loss — router restart may clear state",
    message:
      "Sustained packet loss detected. Your router or modem may have accumulated stale NAT state " +
      "or a memory/firmware issue. Power-cycle your router: unplug for 30 seconds, then reconnect. " +
      "If packet loss persists after reboot, an ISP-side fault is likely.",
    match: ({ recentSamples }) => {
      if (recentSamples.length === 0) return false;
      const lossPct = (recentSamples.filter((s) => s.packetLoss).length / recentSamples.length) * 100;
      return lossPct > 20;
    },
  },
];

export function getSelfHealSuggestion(input: SelfHealInput): SelfHealSuggestion | null {
  for (const rule of RULES) {
    if (rule.match(input)) {
      return { id: rule.id, message: rule.message, condition: rule.condition };
    }
  }
  return null;
}
