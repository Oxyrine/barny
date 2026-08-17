import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type { TicketingAdapter } from "./ticketing.ts";
import type { TicketPayload, TicketStatus } from "../../shared/types.ts";

interface TicketRow {
  payload: string;
}

export class ZendeskAdapter implements TicketingAdapter {
  private db: DatabaseSync;

  constructor(db: DatabaseSync) {
    this.db = db;
  }

  createTicket(payload: TicketPayload): TicketPayload {
    // A freshly created ticket is always open, regardless of what the client sent —
    // the ISP backend is authoritative on status, not the reporting client.
    const createdAt = Date.now();
    const ticket: TicketPayload = { ...payload, id: randomUUID(), createdAt, status: "open" };

    this.db
      .prepare("INSERT INTO tickets (id, created_at, status, severity, payload) VALUES (?, ?, ?, ?, ?)")
      .run(ticket.id!, createdAt, ticket.status, ticket.severity, JSON.stringify(ticket));
    this.db
      .prepare("INSERT INTO ticket_events (ticket_id, at, event) VALUES (?, ?, ?)")
      .run(ticket.id!, createdAt, "created");

    return ticket;
  }

  getTicket(id: string): TicketPayload | null {
    const row = this.db.prepare("SELECT payload FROM tickets WHERE id = ?").get(id) as TicketRow | undefined;
    return row ? JSON.parse(row.payload) : null;
  }

  listTickets(status?: TicketStatus): TicketPayload[] {
    const rows = (
      status
        ? this.db.prepare("SELECT payload FROM tickets WHERE status = ? ORDER BY created_at DESC").all(status)
        : this.db.prepare("SELECT payload FROM tickets ORDER BY created_at DESC").all()
    ) as unknown as TicketRow[];
    return rows.map((r) => JSON.parse(r.payload));
  }

  updateStatus(id: string, status: TicketStatus): TicketPayload | null {
    const existing = this.getTicket(id);
    if (!existing) return null;
    const updated: TicketPayload = { ...existing, status };
    this.db.prepare("UPDATE tickets SET status = ?, payload = ? WHERE id = ?").run(status, JSON.stringify(updated), id);
    this.db
      .prepare("INSERT INTO ticket_events (ticket_id, at, event) VALUES (?, ?, ?)")
      .run(id, Date.now(), `status:${status}`);
    return updated;
  }
}
