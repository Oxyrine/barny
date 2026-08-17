import { Router } from "express";
import type { DatabaseSync } from "node:sqlite";
import type { TicketPayload } from "../../shared/types.ts";
import { getChurnRisk } from "../churn.ts";
import { triageTicket } from "../triage.ts";

const SEVERITY_ORDER = { Critical: 0, Degraded: 1, Minor: 2 };

interface TicketRow {
  payload: string;
}

export function agentviewRouter(db: DatabaseSync): Router {
  const router = Router();

  // Prioritized queue: Critical first, then Degraded, then Minor; newest-first within each band.
  // Also annotates each ticket with a live churnRisk flag so the ISP agent sees at a glance
  // which subscribers have filed repeated tickets.
  router.get("/agent/queue", (_req, res) => {
    const rows = db
      .prepare("SELECT payload FROM tickets ORDER BY created_at DESC")
      .all() as unknown as TicketRow[];

    const churnMap = new Map(getChurnRisk(db).map((c) => [c.ssidHash, c.churnRisk]));

    const tickets = rows
      .map((r) => {
        const t = JSON.parse(r.payload) as TicketPayload;
        // Re-score severity using ISP-side triage — never trust client-reported value
        const severity = triageTicket(t);
        const churnRisk = churnMap.get(t.telemetry?.ssidHash ?? "") ?? false;
        return { ...t, severity, churnRisk };
      })
      .sort((a, b) => {
        const sev = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
        if (sev !== 0) return sev;
        return b.createdAt - a.createdAt; // newest-first within same severity
      });

    res.json(tickets);
  });

  // Churn risk summary — ssidHashes with ≥ 3 tickets in the rolling 7-day window
  router.get("/agent/churn-risk", (_req, res) => {
    res.json(getChurnRisk(db).filter((c) => c.churnRisk));
  });

  return router;
}
