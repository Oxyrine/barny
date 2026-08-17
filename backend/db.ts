import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_DB_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "tickets.db");

// Whole TicketPayload is stored as JSON in one column — status/severity/created_at get
// their own columns for filtering/ordering. A hand-normalized relational schema buys
// nothing at this scale and would just be more surface to keep in sync with shared/types.ts.
export function openDb(dbPath: string = DEFAULT_DB_PATH): DatabaseSync {
  const db = new DatabaseSync(dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS tickets (
      id TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL,
      status TEXT NOT NULL,
      severity TEXT NOT NULL,
      payload TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS ticket_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id TEXT NOT NULL,
      at INTEGER NOT NULL,
      event TEXT NOT NULL
    );
  `);
  return db;
}
