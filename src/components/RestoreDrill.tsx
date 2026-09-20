"use client";

import { captureEvent } from "@/components/PostHogPageview";
import { useState } from "react";

type DrillStep = { id: string; ok: boolean; detail: string };
type DrillReceipt = {
  ok: boolean;
  blobs?: number;
  blobBytes?: number;
  lostReplica?: string;
  survivingReplica?: string;
  byteEqual?: boolean;
  elapsedMs?: number;
  error?: string;
  steps?: DrillStep[];
  manifest?: Array<{ path: string; digest: string; size: number }>;
};

const STORAGE_KEY = "nostrborg-last-drill";

export function RestoreDrill() {
  const [running, setRunning] = useState(false);
  const [receipt, setReceipt] = useState<DrillReceipt | null>(null);

  async function runDrill() {
    setRunning(true);
    setReceipt(null);
    captureEvent("cta_clicked", { page: "/", variant: "run-restore-drill" });
    try {
      const response = await fetch("/api/drill", { method: "POST" });
      const payload = (await response.json()) as DrillReceipt;
      if (!response.ok || !payload.ok) {
        const failed = { ok: false, error: payload.error || "Restore drill failed." };
        setReceipt(failed);
        captureEvent("drill_failed", { status: response.status });
        return;
      }
      setReceipt(payload);
      try {
        sessionStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            ok: payload.ok,
            blobs: payload.blobs,
            elapsedMs: payload.elapsedMs,
            at: new Date().toISOString(),
          })
        );
      } catch {
        // Ignore storage failures; the on-page receipt is the source of truth.
      }
      captureEvent("drill_completed", {
        blobs: payload.blobs ?? 0,
        elapsed_ms: payload.elapsedMs ?? 0,
      });
    } catch {
      setReceipt({ ok: false, error: "Could not reach the restore drill." });
      captureEvent("drill_failed", { status: 0 });
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="card" id="restore-drill" style={{ marginTop: 28 }}>
      <p className="kicker">Production restore drill</p>
      <h2 style={{ margin: "8px 0 8px", fontSize: 28 }}>Destroy one replica. Restore from the other.</h2>
      <p style={{ color: "var(--muted)", marginTop: 0 }}>
        This runs synthetic ciphertext only. It uploads opaque blobs to two in-process replicas, deletes replica A,
        reassembles from replica B, and byte-compares the result. No plaintext and no real Borg repository leave this
        request.
      </p>
      <button type="button" className="btn btn-primary" onClick={runDrill} disabled={running} data-cta="primary" data-variant="run-restore-drill">
        {running ? "Running drill…" : "Run restore drill"}
      </button>

      {receipt ? (
        <div style={{ marginTop: 20 }} aria-live="polite">
          <p style={{ color: receipt.ok ? "var(--ok)" : "var(--danger)", fontWeight: 700 }}>
            {receipt.ok
              ? `Pass: restored ${receipt.blobs} blobs from replica-${receipt.survivingReplica} after deleting replica-${receipt.lostReplica} in ${receipt.elapsedMs}ms.`
              : receipt.error}
          </p>
          {receipt.steps?.length ? (
            <ol className="step-list" style={{ marginTop: 12 }}>
              {receipt.steps.map((step) => (
                <li key={step.id}>
                  <span aria-hidden="true">{step.ok ? "✓" : "!"}</span>
                  <span>
                    <strong className="mono">{step.id}</strong>
                    <br />
                    {step.detail}
                  </span>
                </li>
              ))}
            </ol>
          ) : null}
          {receipt.manifest?.length ? (
            <p className="mono" style={{ color: "var(--muted)", fontSize: 13, overflowWrap: "anywhere" }}>
              {receipt.manifest.map((entry) => `${entry.path} ${entry.digest.slice(0, 12)}…`).join(" · ")}
            </p>
          ) : null}
        </div>
      ) : (
        <p style={{ color: "var(--muted)", marginBottom: 0, marginTop: 16 }}>No drill has been run in this session yet.</p>
      )}
    </section>
  );
}
