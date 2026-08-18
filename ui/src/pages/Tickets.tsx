import { useState, useEffect } from "react";
import { useAppContext } from "../App.tsx";
import { BACKEND_URL as BACKEND } from "../config.ts";
import type { TicketPayload } from "../../../shared/types.ts";

function formatDate(ts: number) {
  return new Date(ts).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function SlideOver({ ticket, onClose }: { ticket: TicketPayload; onClose: () => void }) {
  const hasHops = ticket.diagnostics?.traceroute?.length > 0;
  return (
    <>
      <div className="overlay" onClick={onClose} aria-hidden="true" />
      <aside className="slideover" role="complementary" aria-label="Ticket details">
        <button className="slideover-close" onClick={onClose} aria-label="Close ticket details">×</button>
        <div className="stack" style={{ marginTop: "var(--sp-4)" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)", flexWrap: "wrap", marginBottom: "var(--sp-4)" }}>
              <span className={`status-badge ${ticket.severity}`}>
                <span className="badge-icon" aria-hidden="true">
                  {ticket.severity === "Critical" ? "✕" : ticket.severity === "Degraded" ? "⚠" : "ℹ"}
                </span>
                {ticket.severity}
              </span>
              <span className={`status-badge ${ticket.status}`}>
                {ticket.status}
              </span>
            </div>
            <p style={{ fontSize: "0.75rem", color: "var(--c-text-dim)", fontFamily: "var(--font-mono)" }}>
              {ticket.id}
            </p>
            <p style={{ fontSize: "0.8125rem", color: "var(--c-text-dim)", marginTop: "var(--sp-1)" }}>
              {formatDate(ticket.createdAt)}
            </p>
          </div>

          <div className="card" style={{ background: "var(--c-surface-2)" }}>
            <div className="card-title">Summary</div>
            <p style={{ fontSize: "0.875rem", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{ticket.summary}</p>
          </div>

          {ticket.diagnostics && (
            <div className="card" style={{ background: "var(--c-surface-2)" }}>
              <div className="card-title">Diagnostics</div>
              <div className="grid-2" style={{ gap: "var(--sp-3)" }}>
                <div>
                  <div style={{ color: "var(--c-text-dim)", fontSize: "0.75rem" }}>Download</div>
                  <div className="mono">{ticket.diagnostics.downstreamMbps.toFixed(1)} Mbps</div>
                </div>
                <div>
                  <div style={{ color: "var(--c-text-dim)", fontSize: "0.75rem" }}>Upload</div>
                  <div className="mono">{ticket.diagnostics.upstreamMbps.toFixed(1)} Mbps</div>
                </div>
                <div>
                  <div style={{ color: "var(--c-text-dim)", fontSize: "0.75rem" }}>Bufferbloat</div>
                  <div className="row" style={{ gap: "var(--sp-2)" }}>
                    <span className={`grade grade-${ticket.diagnostics.bufferbloat.grade}`}>
                      {ticket.diagnostics.bufferbloat.grade}
                    </span>
                    <span className="mono" style={{ fontSize: "0.8125rem" }}>
                      {Math.round(ticket.diagnostics.bufferbloat.idleLatencyMs)} → {Math.round(ticket.diagnostics.bufferbloat.loadedLatencyMs)} ms
                    </span>
                  </div>
                </div>
                <div>
                  <div style={{ color: "var(--c-text-dim)", fontSize: "0.75rem" }}>Traceroute hops</div>
                  <div className="mono">{ticket.diagnostics.traceroute.length}</div>
                </div>
              </div>
              {hasHops && (
                <div style={{ marginTop: "var(--sp-4)" }}>
                  <div className="card-title">Traceroute</div>
                  <div style={{ fontSize: "0.8125rem", fontFamily: "var(--font-mono)", lineHeight: 1.8 }}>
                    {ticket.diagnostics.traceroute.map((h) => (
                      <div key={h.hop} style={{ display: "flex", gap: "var(--sp-3)", color: "var(--c-text-dim)" }}>
                        <span style={{ width: 24, textAlign: "right", flexShrink: 0 }}>{h.hop}</span>
                        <span style={{ flex: 1, color: h.address ? "var(--c-text)" : "var(--c-text-dim)" }}>
                          {h.address ?? "* * *"}
                        </span>
                        <span>{h.rttMs !== null ? `${Math.round(h.rttMs)} ms` : ""}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {ticket.attemptedFix && (
            <div className="card" style={{ background: "var(--c-surface-2)", borderColor: "hsl(40,40%,22%)" }}>
              <div className="card-title">Self-Heal Attempted</div>
              <p style={{ fontSize: "0.875rem", color: "var(--c-degraded)", marginBottom: "var(--sp-2)" }}>
                ⚠ {ticket.attemptedFix.condition}
              </p>
              <p style={{ fontSize: "0.875rem" }}>{ticket.attemptedFix.message}</p>
              <p style={{ marginTop: "var(--sp-3)", fontSize: "0.8125rem", color: "var(--c-text-dim)" }}>
                Resolved: {ticket.fixResolved ? "✓ Yes" : "✕ No"}
              </p>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

export default function Tickets() {
  const { tickets: sseTickets } = useAppContext();
  const [backendTickets, setBackendTickets] = useState<TicketPayload[]>([]);
  const [selected, setSelected] = useState<TicketPayload | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // Fetch all tickets from backend on mount and whenever a new SSE ticket arrives
  useEffect(() => {
    const url = filterStatus === "all" ? `${BACKEND}/tickets` : `${BACKEND}/tickets?status=${filterStatus}`;
    fetch(url)
      .then((r) => r.json())
      .then((data) => setBackendTickets(data as TicketPayload[]))
      .catch(() => {});
  }, [sseTickets.length, filterStatus]);

  function formatDate2(ts: number) {
    return new Date(ts).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  return (
    <>
      <div className="stack">
        <div className="row-between">
          <div>
            <h1 className="page-title">Tickets</h1>
            <p className="page-subtitle">{backendTickets.length} ticket(s) in the ISP backend</p>
          </div>
          <div className="row">
            <label htmlFor="filter-status" style={{ color: "var(--c-text-dim)", fontSize: "0.8125rem" }}>Status:</label>
            <select
              id="filter-status"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              style={{
                background: "var(--c-glass)", border: "1px solid var(--c-border)", backdropFilter: "blur(12px)",
                color: "var(--c-text)", borderRadius: "var(--r-sm)", padding: "var(--sp-1) var(--sp-3)",
                fontSize: "0.875rem", outline: "none"
              }}
            >
              <option value="all" style={{ background: "#0a0a0a" }}>All</option>
              <option value="open" style={{ background: "#0a0a0a" }}>Open</option>
              <option value="in-progress" style={{ background: "#0a0a0a" }}>In Progress</option>
              <option value="resolved" style={{ background: "#0a0a0a" }}>Resolved</option>
            </select>
          </div>
        </div>

        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          {backendTickets.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon" aria-hidden="true">🎫</span>
              <span className="empty-label">No tickets yet — run a simulation or wait for a real degradation event.</span>
            </div>
          ) : (
            <div className="table-wrap">
              <table aria-label="ISP tickets">
                <thead>
                  <tr>
                    <th scope="col">Severity</th>
                    <th scope="col">Status</th>
                    <th scope="col">Summary</th>
                    <th scope="col">Self-Heal</th>
                    <th scope="col">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {backendTickets.map((t) => (
                    <tr
                      key={t.id}
                      onClick={() => setSelected(t)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => e.key === "Enter" && setSelected(t)}
                      aria-label={`View ticket ${t.id}`}
                    >
                      <td>
                        <span className={`status-badge ${t.severity}`}>
                          <span className="badge-icon" aria-hidden="true">
                            {t.severity === "Critical" ? "✕" : t.severity === "Degraded" ? "⚠" : "ℹ"}
                          </span>
                          {t.severity}
                        </span>
                      </td>
                      <td>
                        <span className={`status-badge ${t.status}`}>{t.status}</span>
                      </td>
                      <td style={{ maxWidth: 340, overflow: "hidden", textOverflow: "ellipsis" }}>
                        {t.summary.slice(0, 80)}{t.summary.length > 80 ? "…" : ""}
                      </td>
                      <td>{t.attemptedFix ? <span style={{ color: "var(--c-degraded)", fontSize: "0.8125rem" }}>⚠ {t.attemptedFix.id}</span> : <span style={{ color: "var(--c-text-dim)", fontSize: "0.8125rem" }}>—</span>}</td>
                      <td className="mono" style={{ color: "var(--c-text-dim)" }}>{formatDate2(t.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {selected && <SlideOver ticket={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
