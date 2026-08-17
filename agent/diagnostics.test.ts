import { test } from "node:test";
import assert from "node:assert/strict";
import { gradeBufferbloat, parseTracertWindows, parseTracerouteUnix } from "./diagnostics.ts";

test("gradeBufferbloat grades the increase over idle, not the absolute value", () => {
  assert.equal(gradeBufferbloat(20, 22), "A"); // +2ms
  assert.equal(gradeBufferbloat(20, 40), "B"); // +20ms
  assert.equal(gradeBufferbloat(20, 70), "C"); // +50ms
  assert.equal(gradeBufferbloat(20, 150), "D"); // +130ms
  assert.equal(gradeBufferbloat(20, 500), "F"); // +480ms
});

test("gradeBufferbloat: a high idle baseline with no increase still grades A", () => {
  assert.equal(gradeBufferbloat(300, 302), "A");
});

// Real `tracert -d -h 5 -w 1000 1.1.1.1` output captured from this machine's flaky
// phone-hotspot connection.
const TRACERT_SAMPLE = `
Tracing route to one.one.one.one [1.1.1.1]
over a maximum of 5 hops:

  1     7 ms     4 ms     4 ms  10.102.167.138
  2   170 ms   205 ms   388 ms  192.168.17.10
  3    66 ms    68 ms    83 ms  192.168.16.5
  4    44 ms    77 ms    87 ms  192.168.19.21
  5    78 ms    53 ms    59 ms  192.168.19.33

Trace complete.
`;

test("parseTracertWindows extracts hop number, average RTT, and address from real output", () => {
  const hops = parseTracertWindows(TRACERT_SAMPLE);
  assert.equal(hops.length, 5);
  assert.equal(hops[0].hop, 1);
  assert.equal(hops[0].address, "10.102.167.138");
  assert.equal(hops[0].rttMs, 5); // avg(7,4,4)
  assert.equal(hops[4].hop, 5);
  assert.equal(hops[4].address, "192.168.19.33");
});

test("parseTracertWindows handles a timed-out hop without throwing", () => {
  const raw = "  6     *        *        *     Request timed out.\n";
  const hops = parseTracertWindows(raw);
  assert.equal(hops.length, 1);
  assert.equal(hops[0].hop, 6);
  assert.equal(hops[0].address, null);
  assert.equal(hops[0].rttMs, null);
});

const TRACEROUTE_UNIX_SAMPLE = `
traceroute to 1.1.1.1 (1.1.1.1), 15 hops max, 60 byte packets
 1  10.0.0.1 (10.0.0.1)  1.234 ms  1.111 ms  1.098 ms
 2  * * *
 3  203.0.113.1 (203.0.113.1)  15.234 ms  14.111 ms  15.098 ms
`;

test("parseTracerouteUnix extracts hops and handles a starred-out timeout hop", () => {
  const hops = parseTracerouteUnix(TRACEROUTE_UNIX_SAMPLE);
  assert.equal(hops.length, 3);
  assert.equal(hops[0].address, "10.0.0.1");
  assert.ok(Math.abs(hops[0].rttMs! - 1.148) < 0.01);
  assert.equal(hops[1].address, null);
  assert.equal(hops[1].rttMs, null);
  assert.equal(hops[2].address, "203.0.113.1");
});
