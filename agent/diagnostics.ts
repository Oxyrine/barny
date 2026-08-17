import { exec } from "node:child_process";
import { promisify } from "node:util";
import { randomBytes } from "node:crypto";
import { measureLatency } from "./probe.ts";
import type { DiagnosticResult, BufferbloatResult, TracerouteHop } from "../shared/types.ts";

const execAsync = promisify(exec);

const DOWNSTREAM_BYTES = 8_000_000;
const UPSTREAM_BYTES = 4_000_000;
const TRACEROUTE_HOST = "1.1.1.1";
const TRACEROUTE_MAX_HOPS = 15;
const IDLE_SAMPLES = 3;
const LOADED_SAMPLE_INTERVAL_MS = 250;
const LOADED_SAMPLES = 6;

async function measureDownstream(backendBaseUrl: string): Promise<number> {
  const start = performance.now();
  const res = await fetch(`${backendBaseUrl}/speedtest/down?bytes=${DOWNSTREAM_BYTES}`);
  const buf = await res.arrayBuffer();
  const elapsedSec = (performance.now() - start) / 1000;
  return (buf.byteLength * 8) / 1_000_000 / elapsedSec;
}

async function measureUpstream(backendBaseUrl: string): Promise<number> {
  const payload = randomBytes(UPSTREAM_BYTES);
  const start = performance.now();
  const res = (await fetch(`${backendBaseUrl}/speedtest/up`, { method: "POST", body: payload }).then((r) =>
    r.json()
  )) as { bytesReceived: number };
  const elapsedSec = (performance.now() - start) / 1000;
  return (res.bytesReceived * 8) / 1_000_000 / elapsedSec;
}

async function measureAverageLatency(samples: number): Promise<number | null> {
  const results = await Promise.all(Array.from({ length: samples }, () => measureLatency()));
  const ok = results.filter((r) => r.latencyMs !== null).map((r) => r.latencyMs as number);
  return ok.length ? ok.reduce((a, b) => a + b, 0) / ok.length : null;
}

// Samples latency repeatedly for a fixed number of ticks while downstream/upstream transfers
// are in flight concurrently — the resulting increase over idle latency is bufferbloat.
async function measureLoadedLatency(): Promise<number | null> {
  const samples: (number | null)[] = [];
  for (let i = 0; i < LOADED_SAMPLES; i++) {
    const { latencyMs } = await measureLatency();
    samples.push(latencyMs);
    if (i < LOADED_SAMPLES - 1) await new Promise((r) => setTimeout(r, LOADED_SAMPLE_INTERVAL_MS));
  }
  const ok = samples.filter((s): s is number => s !== null);
  return ok.length ? ok.reduce((a, b) => a + b, 0) / ok.length : null;
}

// Standard bufferbloat grading (as used by DSLReports-style tests): grade the *increase*
// over idle latency under concurrent load, not the absolute loaded latency.
export function gradeBufferbloat(idleLatencyMs: number, loadedLatencyMs: number): BufferbloatResult["grade"] {
  const increase = loadedLatencyMs - idleLatencyMs;
  if (increase < 5) return "A";
  if (increase < 30) return "B";
  if (increase < 60) return "C";
  if (increase < 200) return "D";
  return "F";
}

// Best-effort parser for `tracert -d` output. Locale-fragile like the wifi parsers —
// unmatched lines are skipped rather than throwing.
export function parseTracertWindows(raw: string): TracerouteHop[] {
  const hops: TracerouteHop[] = [];
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*(\d+)\s+(.*)$/);
    if (!m) continue;
    const hop = Number(m[1]);
    const rest = m[2].trim();
    if (/timed out/i.test(rest)) {
      hops.push({ hop, address: null, rttMs: null });
      continue;
    }
    const times = [...rest.matchAll(/(\d+)\s*ms/g)].map((mm) => Number(mm[1]));
    const addrMatch = rest.match(/(\S+)\s*$/);
    const address = times.length && addrMatch ? addrMatch[1] : null;
    const rttMs = times.length ? times.reduce((a, b) => a + b, 0) / times.length : null;
    hops.push({ hop, address, rttMs });
  }
  return hops;
}

// Best-effort parser for `traceroute -n` output (macOS/Linux) — untested on this Windows
// machine, written thin for cross-platform credibility per the same rationale as wifi.ts.
export function parseTracerouteUnix(raw: string): TracerouteHop[] {
  const hops: TracerouteHop[] = [];
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s*(\d+)\s+(.*)$/);
    if (!m) continue;
    const hop = Number(m[1]);
    const rest = m[2].trim();
    if (/^\*(\s+\*)*$/.test(rest)) {
      hops.push({ hop, address: null, rttMs: null });
      continue;
    }
    const times = [...rest.matchAll(/(\d+(?:\.\d+)?)\s*ms/g)].map((mm) => Number(mm[1]));
    const ipMatch = rest.match(/\(([\d.]+)\)/) ?? rest.match(/^(\S+)/);
    const address = ipMatch ? ipMatch[1] : null;
    const rttMs = times.length ? times.reduce((a, b) => a + b, 0) / times.length : null;
    hops.push({ hop, address, rttMs });
  }
  return hops;
}

async function runTraceroute(): Promise<TracerouteHop[]> {
  const isWin = process.platform === "win32";
  const cmd = isWin
    ? `tracert -d -h ${TRACEROUTE_MAX_HOPS} -w 1000 ${TRACEROUTE_HOST}`
    : `traceroute -n -m ${TRACEROUTE_MAX_HOPS} -w 1 ${TRACEROUTE_HOST}`;
  const parse = isWin ? parseTracertWindows : parseTracerouteUnix;

  try {
    const { stdout } = await execAsync(cmd);
    return parse(stdout);
  } catch (err) {
    // tracert/traceroute exit non-zero on outcomes like "Destination net unreachable" while
    // still producing useful partial hop data on stdout — parse it instead of discarding it.
    const stdout = (err as { stdout?: string }).stdout;
    return stdout ? parse(stdout) : [];
  }
}

// Fired only from a threshold breach, never a timer. Every sub-measurement is I/O-bound
// (network round trips or a child process), so Promise.all gives genuine parallelism
// without worker threads — and none of it touches the renderer/UI process at all.
export async function runDiagnostics(backendBaseUrl: string): Promise<DiagnosticResult> {
  const idleLatencyMs = (await measureAverageLatency(IDLE_SAMPLES)) ?? 0;

  const [downstreamMbps, upstreamMbps, loadedLatencyMs, traceroute] = await Promise.all([
    measureDownstream(backendBaseUrl),
    measureUpstream(backendBaseUrl),
    measureLoadedLatency(),
    runTraceroute(),
  ]);

  const loaded = loadedLatencyMs ?? idleLatencyMs;
  const bufferbloat: BufferbloatResult = {
    idleLatencyMs,
    loadedLatencyMs: loaded,
    grade: gradeBufferbloat(idleLatencyMs, loaded),
  };

  return { timestamp: Date.now(), downstreamMbps, upstreamMbps, bufferbloat, traceroute };
}
