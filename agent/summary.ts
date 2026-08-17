import type { ProbeSample, DiagnosticResult, SelfHealSuggestion } from "../shared/types.ts";

export type DominantSymptom = "high-latency" | "packet-loss" | "bufferbloat" | "throughput" | "general";

function avgLatency(samples: ProbeSample[]): number | null {
  const vals = samples.map((s) => s.latencyMs).filter((l): l is number => l !== null);
  if (vals.length === 0) return null;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

function lossPct(samples: ProbeSample[]): number {
  if (samples.length === 0) return 0;
  return Math.round((samples.filter((s) => s.packetLoss).length / samples.length) * 100);
}

// Determines the single dominant symptom from the probe window + diagnostic result.
// Used to key into the template table below.
export function dominantSymptom(samples: ProbeSample[], diag: DiagnosticResult): DominantSymptom {
  const loss = lossPct(samples);
  if (loss > 5) return "packet-loss";

  const avg = avgLatency(samples);
  if (avg !== null && avg > 150) return "high-latency";

  if (diag.bufferbloat.grade === "D" || diag.bufferbloat.grade === "F") return "bufferbloat";

  if (diag.downstreamMbps < 5 || diag.upstreamMbps < 1) return "throughput";

  return "general";
}

// Template functions keyed on dominant symptom. Every template quotes the real numbers
// from the probe window and diagnostic result — no fabricated values.
const TEMPLATES: Record<DominantSymptom, (samples: ProbeSample[], diag: DiagnosticResult) => string> = {
  "high-latency": (samples, diag) => {
    const avg = avgLatency(samples) ?? "unknown";
    const hops = diag.traceroute.filter((h) => h.rttMs !== null);
    const hopDetail =
      hops.length > 0
        ? ` The traceroute shows ${hops.length} responding hop(s); the first elevated hop is at position ${
            hops.findIndex((h) => h.rttMs !== null && h.rttMs > 50) + 1 || "unknown"
          }.`
        : "";
    return (
      `Your connection is experiencing elevated latency. Average round-trip time over the last ` +
      `${samples.length} samples was ${avg} ms — above the healthy threshold of 150 ms.` +
      ` Download speed: ${diag.downstreamMbps.toFixed(1)} Mbps; upload: ${diag.upstreamMbps.toFixed(1)} Mbps.` +
      hopDetail
    );
  },

  "packet-loss": (samples, diag) => {
    const loss = lossPct(samples);
    const hops = diag.traceroute.filter((h) => h.address === null);
    return (
      `Packet loss detected: ${loss}% of the last ${samples.length} probes failed to reach the endpoint. ` +
      `This indicates an unstable connection between your device and the upstream network. ` +
      (hops.length > 0
        ? `${hops.length} traceroute hop(s) timed out, suggesting a mid-path fault. `
        : ``) +
      `Download: ${diag.downstreamMbps.toFixed(1)} Mbps; upload: ${diag.upstreamMbps.toFixed(1)} Mbps.`
    );
  },

  bufferbloat: (samples, diag) => {
    const { idleLatencyMs, loadedLatencyMs, grade } = diag.bufferbloat;
    const increase = loadedLatencyMs - idleLatencyMs;
    return (
      `Bufferbloat detected (grade ${grade}). Latency increased from ${Math.round(idleLatencyMs)} ms at idle ` +
      `to ${Math.round(loadedLatencyMs)} ms under load — a spike of ${Math.round(increase)} ms. ` +
      `Your router's buffers are too large, causing latency to balloon during downloads/uploads. ` +
      `Throughput itself is healthy: ${diag.downstreamMbps.toFixed(1)} Mbps / ${diag.upstreamMbps.toFixed(1)} Mbps. ` +
      `Average idle latency over the probe window: ${avgLatency(samples) ?? "n/a"} ms.`
    );
  },

  throughput: (samples, diag) => {
    return (
      `Throughput degradation detected. Download speed: ${diag.downstreamMbps.toFixed(1)} Mbps ` +
      `(expected > 5 Mbps); upload speed: ${diag.upstreamMbps.toFixed(1)} Mbps (expected > 1 Mbps). ` +
      `Packet loss over the probe window: ${lossPct(samples)}%. ` +
      `Average latency: ${avgLatency(samples) ?? "n/a"} ms. ` +
      `Bufferbloat grade: ${diag.bufferbloat.grade}.`
    );
  },

  general: (samples, diag) => {
    return (
      `Network quality has degraded below acceptable thresholds. ` +
      `Average latency: ${avgLatency(samples) ?? "n/a"} ms; ` +
      `packet loss: ${lossPct(samples)}%; ` +
      `download: ${diag.downstreamMbps.toFixed(1)} Mbps; ` +
      `upload: ${diag.upstreamMbps.toFixed(1)} Mbps; ` +
      `bufferbloat grade: ${diag.bufferbloat.grade}.`
    );
  },
};

export function buildSummary(
  samples: ProbeSample[],
  diag: DiagnosticResult,
  suggestion: SelfHealSuggestion | null,
): string {
  const symptom = dominantSymptom(samples, diag);
  const base = TEMPLATES[symptom](samples, diag);
  if (suggestion) {
    return `${base}\n\nAutomated self-heal attempted: ${suggestion.condition}. Action: ${suggestion.message}`;
  }
  return base;
}
