import { EventEmitter } from "node:events";
import net from "node:net";
import dns from "node:dns/promises";
import type { ProbeSample, ProbeState, AppConfig } from "../shared/types.ts";
import { getWifiInfo } from "./wifi.ts";
import { anonymizeWifi, getOrCreateSalt } from "./anonymize.ts";

const PROBE_HOST = "1.1.1.1";
const PROBE_PORT = 443;
const DNS_HOSTNAME = "example.com";
const HTTP_PROBE_URL = "http://clients3.google.com/generate_204";
const CONNECT_TIMEOUT_MS = 3000;
const HISTORY_LIMIT = 500;

export async function measureLatency(): Promise<{ latencyMs: number | null; packetLoss: boolean }> {
  const start = performance.now();
  return new Promise((resolve) => {
    const socket = net.connect({ host: PROBE_HOST, port: PROBE_PORT, timeout: CONNECT_TIMEOUT_MS });
    const finish = (ok: boolean) => {
      socket.destroy();
      resolve(ok ? { latencyMs: performance.now() - start, packetLoss: false } : { latencyMs: null, packetLoss: true });
    };
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
  });
}

async function measureDns(): Promise<number | null> {
  const start = performance.now();
  try {
    // dns.lookup() goes through the OS resolver (getaddrinfo), not a direct c-ares query —
    // it's what actually reflects what a subscriber's apps experience, and it works behind
    // resolvers/proxies that only answer OS-level lookups rather than raw DNS-over-UDP.
    await dns.lookup(DNS_HOSTNAME);
    return performance.now() - start;
  } catch {
    return null;
  }
}

async function measureHttp(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CONNECT_TIMEOUT_MS);
    const res = await fetch(HTTP_PROBE_URL, { method: "HEAD", signal: controller.signal });
    clearTimeout(timer);
    return res.ok || res.status === 204;
  } catch {
    return false;
  }
}

// Pure so it's testable without mocking process.cpuUsage()'s microsecond deltas.
export function computeCpuPercent(cpuDeltaUserUs: number, cpuDeltaSystemUs: number, wallDeltaMs: number): number {
  if (wallDeltaMs <= 0) return 0;
  const cpuDeltaMs = (cpuDeltaUserUs + cpuDeltaSystemUs) / 1000;
  return Math.min(100, (cpuDeltaMs / wallDeltaMs) * 100);
}

export class Prober extends EventEmitter {
  private state: ProbeState = { status: "good", lastSample: null, history: [], wifi: null };
  private timer: NodeJS.Timeout | null = null;
  private prevCpu = process.cpuUsage();
  private prevCpuAt = performance.now();
  private salt = getOrCreateSalt();
  private suspect = false;
  private running = false;
  private config: AppConfig;

  constructor(config: AppConfig) {
    super();
    this.config = config;
  }

  getState(): ProbeState {
    return this.state;
  }

  start() {
    this.running = true;
    this.loop();
  }

  stop() {
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
  }

  setSuspect(suspect: boolean) {
    this.suspect = suspect;
  }

  private async loop() {
    if (!this.running) return;

    const sample = await this.takeSample();
    const rawWifi = await getWifiInfo();
    this.state.wifi = anonymizeWifi(rawWifi, this.salt);
    this.state.lastSample = sample;
    this.state.history.push(sample);
    if (this.state.history.length > HISTORY_LIMIT) this.state.history.shift();

    this.emit("sample", this.state);

    if (!this.running) return;
    const interval = this.suspect ? this.config.probeIntervalSuspectMs : this.config.probeIntervalIdleMs;
    this.timer = setTimeout(() => this.loop(), interval);
  }

  private async takeSample(): Promise<ProbeSample> {
    const [{ latencyMs, packetLoss }, dnsMs, httpOk] = await Promise.all([
      measureLatency(),
      measureDns(),
      measureHttp(),
    ]);

    const wallDeltaMs = performance.now() - this.prevCpuAt;
    const cpuDelta = process.cpuUsage(this.prevCpu);
    const cpuPercent = computeCpuPercent(cpuDelta.user, cpuDelta.system, wallDeltaMs);
    this.prevCpu = process.cpuUsage();
    this.prevCpuAt = performance.now();

    return { timestamp: Date.now(), latencyMs, packetLoss, dnsMs, httpOk, cpuPercent };
  }
}
