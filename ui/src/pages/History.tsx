import { useState, useMemo } from "react";
import { useAppContext } from "../App.tsx";
import type { DiagnosticResult } from "../../../../shared/types.ts";

type SortKey = "timestamp" | "downstreamMbps" | "upstreamMbps" | "grade";
type SortDir = "asc" | "desc";

function GradeBadge({ grade }: { grade: string }) {
  return (
    <span className={`grade grade-${grade}`} aria-label={`Bufferbloat grade ${grade}`}>
      {grade}
    </span>
  );
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleString([], {
    month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <span style={{ color: "var(--c-border)", marginLeft: 4 }}>⇅</span>;
  return <span style={{ color: "var(--c-accent)", marginLeft: 4 }}>{dir === "asc" ? "↑" : "↓"}</span>;
}

export default function History() {
  const { diagnostics } = useAppContext();
  const [sortKey, setSortKey] = useState<SortKey>("timestamp");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [filterGrade, setFilterGrade] = useState<string>("all");

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const GRADE_ORDER: Record<string, number> = { A: 0, B: 1, C: 2, D: 3, F: 4 };

  const sorted = useMemo(() => {
    const filtered = filterGrade === "all" ? diagnostics : diagnostics.filter((d) => d.bufferbloat.grade === filterGrade);
    return [...filtered].sort((a, b) => {
      let diff = 0;
      if (sortKey === "timestamp") diff = a.timestamp - b.timestamp;
      else if (sortKey === "downstreamMbps") diff = a.downstreamMbps - b.downstreamMbps;
      else if (sortKey === "upstreamMbps") diff = a.upstreamMbps - b.upstreamMbps;
      else if (sortKey === "grade") diff = GRADE_ORDER[a.bufferbloat.grade] - GRADE_ORDER[b.bufferbloat.grade];
      return sortDir === "asc" ? diff : -diff;
    });
  }, [diagnostics, sortKey, sortDir, filterGrade]);

  return (
    <div className="stack">
      <div className="row-between">
        <div>
          <h1 className="page-title">History</h1>
          <p className="page-subtitle">{diagnostics.length} diagnostic run(s) recorded this session</p>
        </div>
        <div className="row">
          <label htmlFor="filter-grade" style={{ color: "var(--c-text-dim)", fontSize: "0.8125rem" }}>Grade:</label>
          <select
            id="filter-grade"
            value={filterGrade}
            onChange={(e) => setFilterGrade(e.target.value)}
            style={{
              background: "var(--c-surface-2)", border: "1px solid var(--c-border)",
              color: "var(--c-text)", borderRadius: "var(--r-sm)", padding: "var(--sp-1) var(--sp-3)",
              fontSize: "0.875rem",
            }}
          >
            <option value="all">All</option>
            {["A","B","C","D","F"].map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {sorted.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon" aria-hidden="true">📋</span>
            <span className="empty-label">No diagnostics yet — they run automatically when a threshold is breached.</span>
          </div>
        ) : (
          <div className="table-wrap">
            <table aria-label="Diagnostic history">
              <thead>
                <tr>
                  <th onClick={() => toggleSort("timestamp")} scope="col">
                    Time <SortIcon active={sortKey === "timestamp"} dir={sortDir} />
                  </th>
                  <th onClick={() => toggleSort("downstreamMbps")} scope="col">
                    Download <SortIcon active={sortKey === "downstreamMbps"} dir={sortDir} />
                  </th>
                  <th onClick={() => toggleSort("upstreamMbps")} scope="col">
                    Upload <SortIcon active={sortKey === "upstreamMbps"} dir={sortDir} />
                  </th>
                  <th onClick={() => toggleSort("grade")} scope="col">
                    Bufferbloat <SortIcon active={sortKey === "grade"} dir={sortDir} />
                  </th>
                  <th scope="col">Idle Latency</th>
                  <th scope="col">Loaded Latency</th>
                  <th scope="col">Hops</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((d) => (
                  <tr key={d.timestamp}>
                    <td className="mono">{formatDate(d.timestamp)}</td>
                    <td className="mono">{d.downstreamMbps.toFixed(1)} Mbps</td>
                    <td className="mono">{d.upstreamMbps.toFixed(1)} Mbps</td>
                    <td>
                      <div className="row" style={{ gap: "var(--sp-2)" }}>
                        <GradeBadge grade={d.bufferbloat.grade} />
                        <span className="mono" style={{ color: "var(--c-text-dim)", fontSize: "0.75rem" }}>
                          +{Math.round(d.bufferbloat.loadedLatencyMs - d.bufferbloat.idleLatencyMs)} ms
                        </span>
                      </div>
                    </td>
                    <td className="mono">{Math.round(d.bufferbloat.idleLatencyMs)} ms</td>
                    <td className="mono">{Math.round(d.bufferbloat.loadedLatencyMs)} ms</td>
                    <td className="mono">{d.traceroute.length}</td>
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
