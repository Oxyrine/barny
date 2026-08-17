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
    const targetMbps = Number(req.query.mbps) || 12; // Simulate a 12 Mbps connection by default
    const bytesPerSec = (targetMbps * 1_000_000) / 8;
    
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Content-Length", String(bytes));
    const chunk = randomBytes(Math.min(CHUNK_SIZE, bytes));

    let sent = 0;
    const writeMore = () => {
      if (sent >= bytes) {
        res.end();
        return;
      }
      
      const remaining = bytes - sent;
      const toSend = remaining < chunk.length ? chunk.subarray(0, remaining) : chunk;
      
      const startWrite = performance.now();
      const canWriteMore = res.write(toSend);
      sent += toSend.length;
      
      const expectedMs = (toSend.length / bytesPerSec) * 1000;
      const elapsedMs = performance.now() - startWrite;
      const delayMs = Math.max(0, expectedMs - elapsedMs);

      if (canWriteMore) {
        setTimeout(writeMore, delayMs);
      } else {
        res.once("drain", () => setTimeout(writeMore, delayMs));
      }
    };
    writeMore();
  });

  router.post("/speedtest/up", (req, res) => {
    let bytes = 0;
    const start = Date.now();
    const targetMbps = Number(req.query.mbps) || 12;
    
    req.on("data", (chunk: Buffer) => {
      bytes += chunk.length;
    });
    
    req.on("end", () => {
      const elapsedMs = Date.now() - start;
      const expectedMs = (bytes * 8 * 1000) / (targetMbps * 1_000_000);
      const delayMs = Math.max(0, expectedMs - elapsedMs);
      
      setTimeout(() => {
        res.json({ bytesReceived: bytes, elapsedMs: Date.now() - start });
      }, delayMs);
    });
  });

  return router;
}
