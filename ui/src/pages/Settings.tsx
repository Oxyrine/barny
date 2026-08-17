import { useState, useEffect } from "react";
import type { AppConfig } from "../../../shared/types.ts";

interface Toast { id: number; type: "success" | "error"; message: string; }

function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    <div className="toast-container" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.type}`}>
          <span aria-hidden="true">{t.type === "success" ? "✓" : "✕"}</span>
          {t.message}
          <button
            onClick={() => onDismiss(t.id)}
            style={{ marginLeft: "auto", background: "none", border: "none", color: "inherit", cursor: "pointer", fontSize: "1rem" }}
            aria-label="Dismiss"
          >×</button>
        </div>
      ))}
    </div>
  );
}

const DEFAULT_CONFIG: AppConfig = {
  thresholds: { latencyMs: 150, latencyConsecutive: 3, packetLossPct: 5, dnsMs: 300 },
  probeIntervalIdleMs: 15000,
  probeIntervalSuspectMs: 5000,
  triggerCooldownMs: 60000,
};

type FieldErrors = Partial<Record<string, string>>;

function validate(cfg: AppConfig): FieldErrors {
  const e: FieldErrors = {};
  if (cfg.thresholds.latencyMs <= 0) e.latencyMs = "Must be > 0";
  if (cfg.thresholds.latencyConsecutive < 1) e.latencyConsecutive = "Must be ≥ 1";
  if (cfg.thresholds.packetLossPct < 0 || cfg.thresholds.packetLossPct > 100) e.packetLossPct = "0–100%";
  if (cfg.thresholds.dnsMs <= 0) e.dnsMs = "Must be > 0";
  if (cfg.probeIntervalIdleMs < 1000) e.probeIntervalIdleMs = "Min 1000 ms";
  if (cfg.probeIntervalSuspectMs < 1000) e.probeIntervalSuspectMs = "Min 1000 ms";
  if (cfg.triggerCooldownMs < 1000) e.triggerCooldownMs = "Min 1000 ms";
  return e;
}

function Field({
  id, label, hint, value, error, onChange,
}: {
  id: string; label: string; hint: string; value: number; error?: string; onChange: (v: number) => void;
}) {
  return (
    <div className="form-group">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={error ? "error" : ""}
        aria-describedby={`${id}-hint${error ? ` ${id}-err` : ""}`}
        aria-invalid={!!error}
      />
      <span id={`${id}-hint`} className="field-hint">{hint}</span>
      {error && <span id={`${id}-err`} className="field-error" role="alert">{error}</span>}
    </div>
  );
}

export default function Settings() {
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [toasts, setToasts] = useState<Toast[]>([]);
  let toastId = 0;

  function addToast(type: "success" | "error", message: string) {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((data) => { setConfig(data as AppConfig); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  function patch<K extends keyof AppConfig>(key: K, value: AppConfig[K]) {
    setConfig((prev) => ({ ...prev, [key]: value }));
  }

  function patchThreshold(key: keyof AppConfig["thresholds"], value: number) {
    setConfig((prev) => ({ ...prev, thresholds: { ...prev.thresholds, [key]: value } }));
  }

  async function save() {
    const errs = validate(config);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setSaving(true);
    try {
      const res = await fetch("/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      addToast("success", "Configuration saved and applied.");
    } catch (e) {
      addToast("error", `Save failed: ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="stack">
        <h1 className="page-title">Settings</h1>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card">
            <span className="skeleton" style={{ height: 18, width: "40%", display: "block", marginBottom: 8 }} />
            <span className="skeleton" style={{ height: 36, width: "100%", display: "block" }} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="stack">
        <div className="row-between">
          <div>
            <h1 className="page-title">Settings</h1>
            <p className="page-subtitle">Probe thresholds and timing — changes are applied live to the agent.</p>
          </div>
          <button
            id="save-config-btn"
            className="btn btn-primary"
            onClick={save}
            disabled={saving}
            aria-busy={saving}
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>

        <div className="card">
          <h2 className="section-title" style={{ marginBottom: "var(--sp-5)" }}>Thresholds</h2>
          <div className="grid-2">
            <Field id="latencyMs" label="Latency threshold (ms)" hint="Alert after this many consecutive high-latency samples."
              value={config.thresholds.latencyMs} error={errors.latencyMs}
              onChange={(v) => patchThreshold("latencyMs", v)} />
            <Field id="latencyConsecutive" label="Consecutive breaches before alert" hint="Reduces false positives from single-sample spikes."
              value={config.thresholds.latencyConsecutive} error={errors.latencyConsecutive}
              onChange={(v) => patchThreshold("latencyConsecutive", v)} />
            <Field id="packetLossPct" label="Packet loss threshold (%)" hint="Rolling window loss rate to trigger diagnostics."
              value={config.thresholds.packetLossPct} error={errors.packetLossPct}
              onChange={(v) => patchThreshold("packetLossPct", v)} />
            <Field id="dnsMs" label="DNS response threshold (ms)" hint="Flag slow DNS separately from general latency."
              value={config.thresholds.dnsMs} error={errors.dnsMs}
              onChange={(v) => patchThreshold("dnsMs", v)} />
          </div>
        </div>

        <div className="card">
          <h2 className="section-title" style={{ marginBottom: "var(--sp-5)" }}>Probe Intervals</h2>
          <div className="grid-3">
            <Field id="probeIntervalIdleMs" label="Idle interval (ms)" hint="Probe frequency when connection is healthy."
              value={config.probeIntervalIdleMs} error={errors.probeIntervalIdleMs}
              onChange={(v) => patch("probeIntervalIdleMs", v)} />
            <Field id="probeIntervalSuspectMs" label="Suspect interval (ms)" hint="Faster probing when degradation is detected."
              value={config.probeIntervalSuspectMs} error={errors.probeIntervalSuspectMs}
              onChange={(v) => patch("probeIntervalSuspectMs", v)} />
            <Field id="triggerCooldownMs" label="Trigger cooldown (ms)" hint="Minimum time between diagnostic runs."
              value={config.triggerCooldownMs} error={errors.triggerCooldownMs}
              onChange={(v) => patch("triggerCooldownMs", v)} />
          </div>
        </div>

        <div className="card" style={{ borderColor: "hsl(210,40%,22%)", background: "hsl(210,20%,10%)" }}>
          <div className="row" style={{ gap: "var(--sp-3)", color: "hsl(210,80%,70%)", fontSize: "0.875rem" }}>
            <span aria-hidden="true">ℹ</span>
            <div>
              <strong>SNR unavailable on Windows.</strong>{" "}
              <code>netsh</code> reports no noise floor. SNR is shown as n/a — this is correct, not a bug.
              macOS <code>airport -I</code> derives real SNR.
            </div>
          </div>
        </div>
      </div>
      <ToastContainer toasts={toasts} onDismiss={(id) => setToasts((p) => p.filter((t) => t.id !== id))} />
    </>
  );
}
