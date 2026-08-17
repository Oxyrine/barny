import { Router } from "express";
import { randomBytes } from "node:crypto";

const MAX_BYTES = 50_000_000;
const CHUNK_SIZE = 65536;

// Synthetic throughput generator (§4, §6.2) — self-hosted so the demo never depends on
// venue internet or a third-party test server being reachable/fast.
export function speedtestRouter(): Router {
  const router = Router();

  router.get("/speedtest/down", (req, res) => {
    const bytes = Math.min(Number(req.query.bytes) || 8_000_000, MAX_BYTES);
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Length", String(bytes));
    const chunk = randomBytes(Math.min(CHUNK_SIZE, bytes));

    let sent = 0;
    const writeMore = () => {
      while (sent < bytes) {
        const remaining = bytes - sent;
        const toSend = remaining < chunk.length ? chunk.subarray(0, remaining) : chunk;
        sent += toSend.length;
        if (!res.write(toSend)) {
          res.once("drain", writeMore);
          return;
        }
      }
      res.end();
    };
    writeMore();
  });

  router.post("/speedtest/up", (req, res) => {
    let bytes = 0;
    const start = Date.now();
    req.on("data", (chunk: Buffer) => {
      bytes += chunk.length;
    });
    req.on("end", () => {
      res.json({ bytesReceived: bytes, elapsedMs: Date.now() - start });
    });
  });

  return router;
}
