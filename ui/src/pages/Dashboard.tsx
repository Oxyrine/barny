import { useMemo } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import { useAppContext } from "../App.tsx";
import type { ProbeSample } from "../../../../shared/types.ts";

function StatusCard({ status }: { status: string }) {
  const cfg = {
    good:     { icon: "✓", label: "Good",     className: "good" },
    degraded: { icon: "⚠", label: "Degraded", className: "degraded" },
    critical: { icon: "✕", label: "Critical", className: "critical" },
  }[status] ?? { icon: "–", label: "Connecting…", className: "unknown" };

  return (
    <div className="card" style={{ display: "flex", alignItems: "center", gap: "var(--sp-5)" }}>
      <div
        style={{
          width: 64, height: 64, borderRadius: "50%",
          display: "grid", placeItems: "center", fontSize: "1.75rem", flexShrink: 0,
          background: status === "good" ? "var(--c-good-bg)" : status === "degraded" ? "var(--c-degraded-bg)" : status === "critical" ? "var(--c-critical-bg)" : "var(--c-surface-2)",
          border: `2px solid ${status === "good" ? "var(--c-good)" : status === "degraded" ? "var(--c-degraded)" : status === "critical" ? "var(--c-critical)" : "var(--c-border)"}`,
        }}
        role="img"
        aria-label={`Network status: ${cfg.label}`}
      >
        {cfg.icon}
      </div>
      <div>
        <div className="card-title">Network Status</div>
        <span className={`status-badge ${cfg.className}`} style={{ fontSize: "1rem", padding: "var(--sp-2) var(--sp-4)" }}>
          <span className="badge-icon" aria-hidden="true">{cfg.icon}</span>
          {cfg.label}
        </span>
      </div>
    </div>
  );
}

function MetricCard({ label, value, unit, skeleton }: { label: string; value: string | number | null; unit?: string; skeleton?: boolean }) {
  return (
    <div className="card">
      <div className="card-title">{label}</div>
      {skeleton || value === null ? (
        <span className="skeleton" style={{ height: 36, width: "70%", marginTop: 4 }} />
      ) : (
        <div className="row" style={{ alignItems: "baseline", gap: "var(--sp-1)" }}>
          <span className="card-value">{value}</span>
          {unit && <span className="card-unit">{unit}</span>}
        </div>
      )}
    </div>
  );
}

function WifiStrip({ wifi }: { wifi: ReturnType<typeof useAppContext>["probeState"] extends null ? null : NonNullable<ReturnType<typeof useAppContext>["probeState"]>["wifi"] }) {
  if (!wifi) return null;
  const chips = [
    { label: "RSSI", value: wifi.rssi !== null ? `${wifi.rssi} dBm` : "n/a" },
    { label: "Band", value: wifi.band ?? "n/a" },
    { label: "Channel", value: wifi.channel ?? "n/a" },
    { label: "Radio", value: wifi.radioType ?? "n/a" },
    { label: "SNR", value: wifi.snrSource === "measured" && wifi.snr !== null ? `${wifi.snr} dB` : "n/a (Windows)" },
  ];
  return (
    <div className="card">
      <div className="card-title">Wi-Fi Telemetry</div>
      <div className="telemetry-strip">
        {chips.map((c) => (
          <div key={c.label} className="telemetry-chip">
            <span className="chip-label">{c.label}</span>
            <span className="chip-value">{c.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const CHART_WINDOW = 60;

function chartColor(key: string) {
  return key === "latencyMs" ? "hsl(210,90%,60%)" : key === "dnsMs" ? "hsl(260,80%,65%)" : "hsl(0,80%,60%)";
}

interface ChartPoint {
  t: string;
  latencyMs: number | null;
  dnsMs: number | null;
  loss: number;
}

export default function Dashboard() {
  const { probeState, connected } = useAppContext();
  const history: ProbeSample[] = probeState?.history?.slice(-CHART_WINDOW) ?? [];

  const chartData: ChartPoint[] = useMemo(
    () =>
      history.map((s) => ({
        t: new Date(s.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        latencyMs: s.latencyMs,
        dnsMs: s.dnsMs,
        loss: s.packetLoss ? 1 : 0,
      })),
    [history],
  );

  const last = probeState?.lastSample ?? null;
  const skeleton = !connected && !probeState;

  return (
    <div className="stack">
      <div className="row-between">
        <h1 className="page-title">
          Dashboard
          <span className="page-subtitle"> — live network health</span>
        </h1>
        {last && (
          <span className="cpu-badge" aria-label={`CPU usage: ${last.cpuPercent.toFixed(1)}%`}>
            ⚙ {last.cpuPercent.toFixed(1)}% CPU
          </span>
        )}
      </div>

      {/* Status + quick metrics */}
      <StatusCard status={probeState?.status ?? (connected ? "good" : "unknown")} />

      <div className="grid-4">
        <MetricCard
          label="Latency"
          value={last?.latencyMs !== undefined && last.latencyMs !== null ? Math.round(last.latencyMs) : null}
          unit="ms"
          skeleton={skeleton}
        />
        <MetricCard
          label="Packet Loss"
          value={last ? (last.packetLoss ? "Lost" : "None") : null}
          skeleton={skeleton}
        />
        <MetricCard
          label="DNS Time"
          value={last?.dnsMs !== undefined && last.dnsMs !== null ? Math.round(last.dnsMs) : null}
          unit="ms"
          skeleton={skeleton}
        />
        <MetricCard
          label="HTTP Probe"
          value={last ? (last.httpOk ? "OK" : "Fail") : null}
          skeleton={skeleton}
        />
      </div>

      {/* Wi-Fi telemetry strip */}
      {probeState?.wifi && <WifiStrip wifi={probeState.wifi} />}

      {/* Latency + DNS chart */}
      <div className="card">
        <div className="section-header">
          <h2 className="section-title">Latency &amp; DNS — last {CHART_WINDOW} samples</h2>
        </div>
        {chartData.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon" aria-hidden="true">📊</span>
            <span className="empty-label">Waiting for probe data…</span>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,12%,18%)" />
              <XAxis dataKey="t" tick={{ fill: "hsl(220,10%,55%)", fontSize: 11 }} interval="preserveStartEnd" />
              <YAxis tick={{ fill: "hsl(220,10%,55%)", fontSize: 11 }} unit="ms" />
              <Tooltip
                contentStyle={{ background: "var(--c-surface-2)", border: "1px solid var(--c-border)", borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: "var(--c-text-dim)" }}
              />
              <Legend />
              <Line type="monotone" dataKey="latencyMs" name="Latency (ms)" stroke={chartColor("latencyMs")} dot={false} strokeWidth={2} connectNulls />
              <Line type="monotone" dataKey="dnsMs" name="DNS (ms)" stroke={chartColor("dnsMs")} dot={false} strokeWidth={2} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      {!connected && (
        <div className="card" style={{ borderColor: "var(--c-critical)", background: "var(--c-critical-bg)" }}>
          <div className="row" style={{ gap: "var(--sp-3)", color: "var(--c-critical)" }}>
            <span aria-hidden="true">✕</span>
            <span>
              <strong>Agent disconnected</strong> — make sure <code>npm run dev:agent</code> is running on port 4100.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
