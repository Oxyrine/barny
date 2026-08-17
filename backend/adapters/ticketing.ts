import type { TicketPayload, TicketStatus } from "../../shared/types.ts";

// Routes never touch a vendor shape directly — every ticketing backend integration goes
// through this interface, so swapping Zendesk for ServiceNow/proprietary is a new adapter,
// not a route rewrite (§8 scalability story).
export interface TicketingAdapter {
  createTicket(payload: TicketPayload): TicketPayload;
  getTicket(id: string): TicketPayload | null;
  listTickets(status?: TicketStatus): TicketPayload[];
  updateStatus(id: string, status: TicketStatus): TicketPayload | null;
}
