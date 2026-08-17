import { test } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { createApp } from "../server.ts";
import { openDb } from "../db.ts";
import { ZendeskAdapter } from "../adapters/zendesk.ts";

function startServer() {
  const adapter = new ZendeskAdapter(openDb(":memory:"));
  const server = createApp(adapter).listen(0);
  const { port } = server.address() as AddressInfo;
  return { server, base: `http://127.0.0.1:${port}` };
}

test("GET /speedtest/down streams exactly the requested byte count", async () => {
  const { server, base } = startServer();
  try {
    const res = await fetch(`${base}/speedtest/down?bytes=123456`);
    const buf = await res.arrayBuffer();
    assert.equal(buf.byteLength, 123456);
  } finally {
    server.close();
  }
});

test("GET /speedtest/down caps requested size at the server max", { timeout: 30_000 }, async () => {
  const { server, base } = startServer();
  try {
    const res = await fetch(`${base}/speedtest/down?bytes=999999999999`);
    const buf = await res.arrayBuffer();
    assert.equal(buf.byteLength, 50_000_000);
  } finally {
    server.close();
  }
});

test("POST /speedtest/up reports the exact number of bytes received", async () => {
  const { server, base } = startServer();
  try {
    const payload = new Uint8Array(50_000).fill(7);
    const res = await fetch(`${base}/speedtest/up`, { method: "POST", body: payload }).then((r) => r.json());
    assert.equal(res.bytesReceived, 50_000);
    assert.ok(typeof res.elapsedMs === "number");
  } finally {
    server.close();
  }
});
