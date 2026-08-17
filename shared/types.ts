export interface WifiTelemetry {
  ssidHash: string;
  bssidHash: string;
  rssi: number | null;
  snr: number | null;
  snrSource: "measured" | "unavailable";
  channel: number | null;
  band: "2.4GHz" | "5GHz" | "6GHz" | null;
  radioType: string | null;
  platform: string;
  osVersion: string;
  raw?: string;
}

export interface ProbeSample {
  timestamp: number;
  latencyMs: number | null;
  packetLoss: boolean;
  dnsMs: number | null;
  httpOk: boolean;
  cpuPercent: number;
}

export type HealthStatus = "good" | "degraded" | "critical";

export interface ProbeState {
  status: HealthStatus;
  lastSample: ProbeSample | null;
  history: ProbeSample[];
  wifi: WifiTelemetry | null;
}

export interface BufferbloatResult {
  idleLatencyMs: number;
  loadedLatencyMs: number;
  grade: "A" | "B" | "C" | "D" | "F";
}

export interface TracerouteHop {
  hop: number;
  address: string | null;
  rttMs: number | null;
}

export interface DiagnosticResult {
  timestamp: number;
  downstreamMbps: number;
  upstreamMbps: number;
  bufferbloat: BufferbloatResult;
  traceroute: TracerouteHop[];
}

export interface SelfHealSuggestion {
  id: string;
  message: string;
  condition: string;
}

export type TicketSeverity = "Critical" | "Degraded" | "Minor";
export type TicketStatus = "open" | "in-progress" | "resolved";

export interface TicketPayload {
  id?: string;
  createdAt: number;
  status: TicketStatus;
  severity: TicketSeverity;
  probeHistory: ProbeSample[];
  diagnostics: DiagnosticResult;
  telemetry: WifiTelemetry;
  summary: string;
  attemptedFix: SelfHealSuggestion | null;
  fixResolved: boolean;
}

export interface AppConfig {
  thresholds: {
    latencyMs: number;
    latencyConsecutive: number;
    packetLossPct: number;
    dnsMs: number;
  };
  probeIntervalIdleMs: number;
  probeIntervalSuspectMs: number;
  triggerCooldownMs: number;
}
