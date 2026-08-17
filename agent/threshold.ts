import type { ProbeSample, AppConfig, HealthStatus } from "../shared/types.ts";

const LOSS_WINDOW = 20;

export interface ThresholdResult {
  status: HealthStatus;
  fired: boolean;
}

// Fires once per breach, then holds off for triggerCooldownMs — a real degradation that
// persists across many samples must not re-trigger the diagnostic suite every sample.
export class ThresholdTracker {
  private consecutiveLatencyBreaches = 0;
  private lastFiredAt: number | null = null;

  record(history: ProbeSample[], config: AppConfig, now: number): ThresholdResult {
    const sample = history[history.length - 1];
    if (!sample) return { status: "good", fired: false };

    const latencyBad = sample.latencyMs === null || sample.latencyMs > config.thresholds.latencyMs;
    this.consecutiveLatencyBreaches = latencyBad ? this.consecutiveLatencyBreaches + 1 : 0;

    const window = history.slice(-LOSS_WINDOW);
    const lossPct = (window.filter((s) => s.packetLoss).length / window.length) * 100;

    const dnsBad = sample.dnsMs !== null && sample.dnsMs > config.thresholds.dnsMs;
    const latencyBreach = this.consecutiveLatencyBreaches >= config.thresholds.latencyConsecutive;
    const lossBreach = lossPct > config.thresholds.packetLossPct;

    const breach = latencyBreach || lossBreach || dnsBad;
    const severe =
      lossPct > config.thresholds.packetLossPct * 2 ||
      this.consecutiveLatencyBreaches >= config.thresholds.latencyConsecutive * 2;

    const status: HealthStatus = !breach ? "good" : severe ? "critical" : "degraded";

    let fired = false;
    if (breach && (this.lastFiredAt === null || now - this.lastFiredAt >= config.triggerCooldownMs)) {
      fired = true;
      this.lastFiredAt = now;
    }

    return { status, fired };
  }

  resetCooldown(): void {
    this.lastFiredAt = null;
  }
}
