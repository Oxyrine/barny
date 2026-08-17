import { useState, useEffect } from "react";
import type { TicketPayload, TicketSeverity } from "../../../../shared/types.ts";

const BACKEND = "http://localhost:4000";

interface QueuedTicket extends TicketPayload {
  severity: TicketSeverity;
  churnRisk: boolean;
}

interface ChurnEntry { ssidHash: string; ticketCount: number; churnRisk: boolean; }

function formatDate(ts: number) {
  return new Date(ts).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function SeverityBadge({ severity }: { severity: TicketSeverity }) {
  const icon = severity === "Critical" ? "✕" : severity === "Degraded" ? "⚠" : "ℹ";
  return (
    <span className={`status-badge ${severity}`}>
      <span className="badge-icon" aria-hidden="true">{icon}</span>
      {severity}
    </span>
  );
}

export default function ISPAgentView() {
  const [queue, setQueue] = useState<QueuedTicket[]>([]);
  const [churnRisk, setChurnRisk] = useState<ChurnEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  async function refresh() {
    try {
      const [qRes, cRes] = await Promise.all([
        fetch(`${BACKEND}/agent/queue`),
        fetch(`${BACKEND}/agent/churn-risk`),
      ]);
      if (!qRes.ok) throw new Error(`Backend returned ${qRes.status}`);
      setQueue((await qRes.json()) as QueuedTicket[]);
      setChurnRisk((await cRes.json()) as ChurnEntry[]);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, [autoRefresh]);

  const critical = queue.filter((t) => t.severity === "Critical");
  const degraded  = queue.filter((t) => t.severity === "Degraded");
  const minor     = queue.filter((t) => t.severity === "Minor");

  return (
    <div className="stack">
      <div className="row-between">
        <div>
          <h1 className="page-title">ISP Agent View</h1>
          <p className="page-subtitle">
            Prioritized ticket queue — re-scored by ISP-side triage. Auto-refreshes every 5s.
          </p>
        </div>
        <div className="row">
          <label style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)", fontSize: "0.875rem", color: "var(--c-text-dim)", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              style={{ accentColor: "var(--c-accent)" }}
            />
            Auto-refresh
          </label>
          <button id="isp-refresh-btn" className="btn btn-ghost btn-sm" onClick={refresh}>↻ Refresh</button>
        </div>
      </div>

      {/* Churn risk summary */}
      {churnRisk.length > 0 && (
        <div className="card" style={{ borderColor: "hsl(0,40%,22%)", background: "var(--c-critical-bg)" }}>
          <div className="row" style={{ gap: "var(--sp-3)", marginBottom: "var(--sp-3)" }}>
            <span style={{ color: "var(--c-critical)", fontSize: "1rem" }} aria-hidden="true">🔴</span>
            <h2 className="section-title" style={{ color: "var(--c-critical)" }}>
              Churn Risk — {churnRisk.length} subscriber(s) with ≥ 3 tickets in 7 days
            </h2>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--sp-2)" }}>
            {churnRisk.map((c) => (
              <div
                key={c.ssidHash}
                className="telemetry-chip"
                style={{ borderColor: "hsl(0,40%,22%)", background: "hsl(0,20%,10%)" }}
              >
                <span className="chip-label">SSID hash</span>
                <span className="chip-value mono" style={{ color: "var(--c-critical)" }}>
                  {c.ssidHash.slice(0, 12)}…
                </span>
                <span className="churn-flag">🔴 {c.ticketCount} tickets</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats row */}
      <div className="grid-3">
        <div className="card" style={{ borderColor: critical.length > 0 ? "hsl(0,40%,22%)" : undefined }}>
          <div className="card-title">Critical</div>
          <div className="card-value" style={{ color: critical.length > 0 ? "var(--c-critical)" : "var(--c-text-dim)" }}>
            {critical.length}
          </div>
        </div>
        <div className="card" style={{ borderColor: degraded.length > 0 ? "hsl(40,40%,22%)" : undefined }}>
          <div className="card-title">Degraded</div>
          <div className="card-value" style={{ color: degraded.length > 0 ? "var(--c-degraded)" : "var(--c-text-dim)" }}>
            {degraded.length}
          </div>
        </div>
        <div className="card">
          <div className="card-title">Minor</div>
          <div className="card-value" style={{ color: "var(--c-text-dim)" }}>{minor.length}</div>
        </div>
      </div>

      {/* Prioritized queue table */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "var(--sp-5) var(--sp-6) var(--sp-4)" }} className="row-between">
          <h2 className="section-title">Ticket Queue</h2>
          {error && (
            <span style={{ color: "var(--c-critical)", fontSize: "0.8125rem" }}>
              ✕ {error} — is the backend running on :4000?
            </span>
          )}
        </div>

        {loading ? (
          <div className="stack" style={{ padding: "var(--sp-6)" }}>
            {Array.from({ length: 4 }).map((_, i) => (
              <span key={i} className="skeleton" style={{ height: 36, display: "block" }} />
            ))}
          </div>
        ) : queue.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon" aria-hidden="true">🏢</span>
            <span className="empty-label">No tickets in the queue. Run the simulation script to generate some.</span>
          </div>
        ) : (
          <div className="table-wrap">
            <table aria-label="ISP agent queue, ordered by severity">
              <thead>
                <tr>
                  <th scope="col">Severity</th>
                  <th scope="col">Status</th>
                  <th scope="col">Churn</th>
                  <th scope="col">Summary</th>
                  <th scope="col">Down</th>
                  <th scope="col">Up</th>
                  <th scope="col">Bufferbloat</th>
                  <th scope="col">Created</th>
                </tr>
              </thead>
              <tbody>
                {queue.map((t) => (
                  <tr key={t.id}>
                    <td><SeverityBadge severity={t.severity} /></td>
                    <td><span className={`status-badge ${t.status}`}>{t.status}</span></td>
                    <td>
                      {t.churnRisk ? (
                        <span className="churn-flag" aria-label="Churn risk: ≥3 tickets in 7 days">🔴 Risk</span>
                      ) : (
                        <span style={{ color: "var(--c-text-dim)", fontSize: "0.8125rem" }}>—</span>
                      )}
                    </td>
                    <td style={{ maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis" }}>
                      {t.summary.slice(0, 70)}{t.summary.length > 70 ? "…" : ""}
                    </td>
                    <td className="mono">{t.diagnostics?.downstreamMbps.toFixed(1)} Mbps</td>
                    <td className="mono">{t.diagnostics?.upstreamMbps.toFixed(1)} Mbps</td>
                    <td>
                      <span className={`grade grade-${t.diagnostics?.bufferbloat?.grade}`}>
                        {t.diagnostics?.bufferbloat?.grade ?? "?"}
                      </span>
                    </td>
                    <td className="mono" style={{ color: "var(--c-text-dim)" }}>{formatDate(t.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
