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
