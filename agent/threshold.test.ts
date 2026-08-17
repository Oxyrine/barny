import { test } from "node:test";
import assert from "node:assert/strict";
import { ThresholdTracker } from "./threshold.ts";
import type { ProbeSample, AppConfig } from "../shared/types.ts";

const CONFIG: AppConfig = {
  thresholds: { latencyMs: 150, latencyConsecutive: 3, packetLossPct: 5, dnsMs: 300 },
  probeIntervalIdleMs: 15000,
  probeIntervalSuspectMs: 5000,
  triggerCooldownMs: 60000,
};

function sample(overrides: Partial<ProbeSample> = {}): ProbeSample {
  return {
    timestamp: Date.now(),
    latencyMs: 50,
    packetLoss: false,
    dnsMs: 20,
    httpOk: true,
    cpuPercent: 1,
    ...overrides,
  };
}

test("stays good and never fires under healthy samples", () => {
  const tracker = new ThresholdTracker();
  const history: ProbeSample[] = [];
  let result;
  for (let i = 0; i < 10; i++) {
    history.push(sample());
    result = tracker.record(history, CONFIG, i * 1000);
  }
  assert.equal(result!.status, "good");
  assert.equal(result!.fired, false);
});

test("fires exactly once when latency breaches for the configured consecutive count, then holds off in cooldown", () => {
  const tracker = new ThresholdTracker();
  const history: ProbeSample[] = [];
  const fires: boolean[] = [];

  // 5 consecutive high-latency samples, threshold requires 3 consecutive to fire
  for (let i = 0; i < 5; i++) {
    history.push(sample({ latencyMs: 500 }));
    fires.push(tracker.record(history, CONFIG, i * 1000).fired);
  }

  assert.deepEqual(fires, [false, false, true, false, false]);
});

test("re-arms and fires again after the cooldown elapses", () => {
  const tracker = new ThresholdTracker();
  const history: ProbeSample[] = [];
  let last: ReturnType<ThresholdTracker["record"]> | undefined;

  // record() is called once per newly-arrived sample, same as probe.ts's loop
  for (let i = 0; i < 3; i++) {
    history.push(sample({ latencyMs: 500 }));
    last = tracker.record(history, CONFIG, i * 100);
  }
  assert.equal(last!.fired, true); // fires on the 3rd consecutive breach

  // still within cooldown
  history.push(sample({ latencyMs: 500 }));
  const stillCooling = tracker.record(history, CONFIG, 30_000);
  assert.equal(stillCooling.fired, false);

  // cooldown elapsed, still breaching (consecutive count keeps climbing)
  history.push(sample({ latencyMs: 500 }));
  const refired = tracker.record(history, CONFIG, 61_000);
  assert.equal(refired.fired, true);
});

test("a good sample resets the consecutive-latency counter", () => {
  const tracker = new ThresholdTracker();
  const history: ProbeSample[] = [];

  history.push(sample({ latencyMs: 500 }));
  history.push(sample({ latencyMs: 500 }));
  tracker.record(history, CONFIG, 0); // 2 consecutive, not yet at 3

  history.push(sample({ latencyMs: 20 })); // resets
  tracker.record(history, CONFIG, 1000);

  history.push(sample({ latencyMs: 500 }));
  history.push(sample({ latencyMs: 500 }));
  const result = tracker.record(history, CONFIG, 2000); // only 2 consecutive again

  assert.equal(result.status, "good");
  assert.equal(result.fired, false);
});

test("packet loss over the rolling window breaches independently of latency", () => {
  const tracker = new ThresholdTracker();
  const history: ProbeSample[] = [];

  for (let i = 0; i < 20; i++) {
    const lossy = i % 2 === 0; // 50% loss, well above the 5% threshold
    history.push(sample({ packetLoss: lossy, latencyMs: lossy ? null : 50 }));
  }
  const result = tracker.record(history, CONFIG, 0);
  assert.equal(result.status, "critical"); // 50% loss is well over 2x the 5% threshold
  assert.equal(result.fired, true);
});

test("a null-latency (timeout) sample counts as a breach, not a crash", () => {
  const tracker = new ThresholdTracker();
  const history: ProbeSample[] = [];
  let result: ReturnType<ThresholdTracker["record"]> | undefined;
  for (let i = 0; i < 3; i++) {
    history.push(sample({ latencyMs: null }));
    result = tracker.record(history, CONFIG, i * 100);
  }
  assert.equal(result!.fired, true);
});
