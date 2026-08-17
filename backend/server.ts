import express, { type Express } from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openDb } from "./db.ts";
import { ZendeskAdapter } from "./adapters/zendesk.ts";
import { ticketsRouter } from "./routes/tickets.ts";
import { speedtestRouter } from "./routes/speedtest.ts";
import { agentviewRouter } from "./routes/agentview.ts";
import type { TicketingAdapter } from "./adapters/ticketing.ts";
import type { DatabaseSync } from "node:sqlite";

export function createApp(adapter: TicketingAdapter, db: DatabaseSync): Express {
  const app = express();
  // The dashboard (ISPAgentView/Tickets) fetches this backend directly from a different
  // origin — both in Vite dev (:5173 -> :4000) and once packaged, since the agent serves the
  // UI from its own origin (:4100) while this backend stays on :4000. Without this, every
  // cross-origin request is silently blocked by the browser.
  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }
    next();
  });
  app.use(express.json());
  app.use(ticketsRouter(adapter));
  app.use(speedtestRouter());
  app.use(agentviewRouter(db));
  return app;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  const PORT = Number(process.env.PORT) || 4000;
  const db = openDb();
  const adapter = new ZendeskAdapter(db);
  createApp(adapter, db).listen(PORT, () => console.log(`mock ISP backend listening on :${PORT}`));
}
