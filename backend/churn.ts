import type { DatabaseSync } from "node:sqlite";

const WINDOW_MS = 7 * 24 * 60 * 60 * 1000; // 7-day rolling window
const CHURN_THRESHOLD = 3;

export interface ChurnEntry {
  ssidHash: string;
  ticketCount: number;
  churnRisk: boolean;
}

interface ChurnRow {
  ssidHash: string;
  cnt: number;
}

// Groups tickets by anonymized ssidHash over a rolling 7-day window.
// Returns an entry per ssidHash that has at least one ticket, flagging churnRisk
// when ≥ 3 tickets were filed — the threshold the spec (§7.1.3) uses to identify
// subscribers at risk of churning due to repeated unresolved faults.
export function getChurnRisk(db: DatabaseSync): ChurnEntry[] {
  const since = Date.now() - WINDOW_MS;

  // json_extract pulls ssidHash out of the stored payload JSON column
  const rows = db
    .prepare(
      `SELECT json_extract(payload, '$.telemetry.ssidHash') AS ssidHash, COUNT(*) AS cnt
       FROM tickets
       WHERE created_at >= ?
       GROUP BY ssidHash
       ORDER BY cnt DESC`,
    )
    .all(since) as unknown as ChurnRow[];

  return rows
    .filter((r) => r.ssidHash && r.ssidHash !== "unknown")
    .map((r) => ({
      ssidHash: r.ssidHash,
      ticketCount: Number(r.cnt),
      churnRisk: Number(r.cnt) >= CHURN_THRESHOLD,
    }));
}
