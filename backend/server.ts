import express, { type Express } from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openDb } from "./db.ts";
import { ZendeskAdapter } from "./adapters/zendesk.ts";
import { ticketsRouter } from "./routes/tickets.ts";
import { speedtestRouter } from "./routes/speedtest.ts";
import type { TicketingAdapter } from "./adapters/ticketing.ts";

export function createApp(adapter: TicketingAdapter): Express {
  const app = express();
  app.use("/tickets", express.json());
  app.use(ticketsRouter(adapter));
  app.use(speedtestRouter());
  return app;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  const PORT = Number(process.env.PORT) || 4000;
  const adapter = new ZendeskAdapter(openDb());
  createApp(adapter).listen(PORT, () => console.log(`mock ISP backend listening on :${PORT}`));
}
