import { test } from "node:test";
import assert from "node:assert/strict";
import { computeCpuPercent } from "./probe.ts";

test("computeCpuPercent: half a core busy for the whole interval is 50%", () => {
  // 500ms of CPU time (user+system) spent over a 1000ms wall-clock window
  const pct = computeCpuPercent(300_000, 200_000, 1000);
  assert.equal(pct, 50);
});

test("computeCpuPercent: zero CPU time is 0%", () => {
  assert.equal(computeCpuPercent(0, 0, 1000), 0);
});

test("computeCpuPercent: clamps at 100 even if usage exceeds wall time", () => {
  assert.equal(computeCpuPercent(2_000_000, 0, 1000), 100);
});

test("computeCpuPercent: zero or negative wall delta is treated as 0%", () => {
  assert.equal(computeCpuPercent(100_000, 0, 0), 0);
  assert.equal(computeCpuPercent(100_000, 0, -5), 0);
});
