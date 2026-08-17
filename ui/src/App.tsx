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
          <li>
            <NavLink to="/" end>
              <span aria-hidden="true">⊙</span> Dashboard
            </NavLink>
          </li>
          <li>
            <NavLink to="/history">
              <span aria-hidden="true">⊞</span> History
            </NavLink>
          </li>
          <li>
            <NavLink to="/tickets">
              <span aria-hidden="true">🎫</span> Tickets
            </NavLink>
          </li>
          <li>
            <NavLink to="/isp">
              <span aria-hidden="true">🏢</span> ISP View
            </NavLink>
          </li>
          <li>
            <NavLink to="/settings">
              <span aria-hidden="true">⚙</span> Settings
            </NavLink>
          </li>
        </ul>

        <span
          title={connected ? `Status: ${status}` : "Not connected"}
          aria-label={connected ? `Network status: ${status}` : "Agent disconnected"}
        >
          <StatusDot status={connected ? status : "unknown"} />
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
