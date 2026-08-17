import { Router } from "express";
import type { TicketingAdapter } from "../adapters/ticketing.ts";
import type { TicketStatus } from "../../shared/types.ts";

export function ticketsRouter(adapter: TicketingAdapter): Router {
  const router = Router();

  router.post("/tickets", (req, res) => {
    const ticket = adapter.createTicket(req.body);
    res.status(201).json(ticket);
  });

  router.get("/tickets/:id", (req, res) => {
    const ticket = adapter.getTicket(req.params.id);
    if (!ticket) {
      res.status(404).json({ error: "not found" });
      return;
    }
    res.json(ticket);
  });

  router.get("/tickets", (req, res) => {
    const status = req.query.status as TicketStatus | undefined;
    res.json(adapter.listTickets(status));
  });

  router.patch("/tickets/:id/status", (req, res) => {
    const ticket = adapter.updateStatus(req.params.id, req.body.status);
    if (!ticket) {
      res.status(404).json({ error: "not found" });
      return;
    }
    res.json(ticket);
  });

  return router;
}
