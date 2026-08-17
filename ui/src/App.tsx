import { useState } from "react";
import { NavLink, Outlet, useOutletContext } from "react-router-dom";
import { useSSE } from "./hooks/useSSE.ts";
import type { ProbeState, DiagnosticResult, TicketPayload } from "../../shared/types.ts";

export type AppContext = {
  probeState: ProbeState | null;
  diagnostics: DiagnosticResult[];
  tickets: TicketPayload[];
  connected: boolean;
};

function StatusDot({ status }: { status: string }) {
  const cls = status === "good" ? "good" : status === "degraded" ? "degraded" : status === "critical" ? "critical" : "unknown";
  return <span className={`nav-status-dot ${cls}`} aria-hidden="true" />;
}

export default function App() {
  const { probeState, diagnostics, tickets, connected } = useSSE();
  const status = probeState?.status ?? "unknown";

  return (
    <div className="app-shell">
      <nav className="nav" role="navigation" aria-label="Main navigation">
        <NavLink to="/" className="nav-brand" aria-label="NetWatch home">
          <span className="logo-icon" aria-hidden="true">📡</span>
          <span className="logo-text">NetWatch</span>
        </NavLink>

        <ul className="nav-links" role="list">
          <li><NavLink to="/dashboard" end>Dashboard</NavLink></li>
          <li><NavLink to="/dashboard/tickets">Tickets</NavLink></li>
          <li><NavLink to="/dashboard/history">History</NavLink></li>
          <li><NavLink to="/dashboard/isp">ISP View</NavLink></li>
          <li><NavLink to="/dashboard/settings">Settings</NavLink></li>
        </ul>

        <span
          className="row"
          style={{ gap: "var(--sp-2)", flexShrink: 0 }}
          title={connected ? `Status: ${status}` : "Not connected"}
          aria-label={connected ? `Network status: ${status}` : "Agent disconnected"}
        >
          <StatusDot status={connected ? status : "unknown"} />
          <span style={{ fontSize: "0.8125rem", color: "var(--c-text-dim)" }}>
            {connected ? "Connected" : "Disconnected"}
          </span>
        </span>
      </nav>

      <main id="main-content" tabIndex={-1}>
        <Outlet context={{ probeState, diagnostics, tickets, connected } satisfies AppContext} />
      </main>
    </div>
  );
}

export function useAppContext() {
  return useOutletContext<AppContext>();
}
