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
    <div className="app-shell" style={{ position: 'relative', minHeight: '100vh', overflow: 'hidden', background: '#000' }}>
      {/* Animated Video Background - blurred and dimmed for dashboard readability */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0, overflow: 'hidden' }}>
        <video 
          autoPlay 
          muted 
          loop 
          playsInline 
          style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.15, filter: 'blur(8px) contrast(1.2)' }}
        >
          <source
            src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260809_012548_ef22562c-c0ae-4816-ad9d-f8922af4e6a7.mp4"
            type="video/mp4"
          />
        </video>
      </div>

      {/* Ambient Glows */}
      <div style={{ position: 'absolute', top: '-10%', left: '-10%', width: '50vw', height: '50vw', background: 'radial-gradient(circle, hsla(0,0%,100%,0.04) 0%, transparent 60%)', filter: 'blur(60px)', pointerEvents: 'none', zIndex: 0 }} />
      <div style={{ position: 'absolute', bottom: '-20%', right: '-10%', width: '60vw', height: '60vw', background: 'radial-gradient(circle, hsla(0,0%,100%,0.03) 0%, transparent 60%)', filter: 'blur(80px)', pointerEvents: 'none', zIndex: 0 }} />
      
      <div style={{ position: 'relative', zIndex: 1, width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
        <header className="header" style={{ marginTop: 'var(--sp-4)', maxWidth: '1400px', width: '100%', margin: 'var(--sp-4) auto 0' }}>

          <nav className="nav-pill desktop-only">
            <NavLink to="/dashboard" end>Dashboard</NavLink>
            <NavLink to="/dashboard/tickets">Tickets</NavLink>
            <NavLink to="/dashboard/history">History</NavLink>
            <NavLink to="/dashboard/isp">ISP View</NavLink>
            <NavLink to="/dashboard/settings">Settings</NavLink>
          </nav>

          <div className="btn-signin desktop-only" style={{ cursor: "default", display: 'flex', pointerEvents: 'none' }}>
            <span style={{ color: '#fff' }}>{status === 'good' ? 'Connected' : 'Disconnected'}</span>
          </div>
        </header>

      <main id="main-content" tabIndex={-1}>
        <Outlet context={{ probeState, diagnostics, tickets, connected } satisfies AppContext} />
      </main>
      </div>
    </div>
  );
}

export function useAppContext() {
  return useOutletContext<AppContext>();
}
