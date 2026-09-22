"use client";

import { captureEvent } from "@/components/PostHogPageview";
import { useEffect, useState } from "react";

type HistoryRecord = {
  id: string;
  at: string;
  ok: boolean;
  blobs: number;
  elapsedMs: number;
  lostReplica?: string;
  survivingReplica?: string;
};

export function DrillHistory({ refreshToken = 0 }: { refreshToken?: number }) {
  const [drills, setDrills] = useState<HistoryRecord[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/history", { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json()) as { ok?: boolean; drills?: HistoryRecord[]; error?: string };
        if (!response.ok || !payload.ok) {
          throw new Error(payload.error || "Could not load drill history.");
        }
        return payload.drills ?? [];
      })
      .then((rows) => {
        if (!cancelled) setDrills(rows);
      })
      .catch((loadError: Error) => {
        if (!cancelled) {
          setDrills([]);
          setError(loadError.message);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [refreshToken]);

  if (drills === null) {
    return (
      <section className="card">
        <h2 style={{ marginTop: 0 }}>Saved drills</h2>
        <p style={{ color: "var(--muted)", marginBottom: 0 }}>Loading history…</p>
      </section>
    );
  }

  return (
    <section className="card">
      <h2 style={{ marginTop: 0 }}>Saved drills</h2>
      <p style={{ color: "var(--muted)" }}>
        Only pass/fail metadata is stored. Ciphertext, recovery keys, and Borg repositories stay off this host.
      </p>
      {error ? <p style={{ color: "var(--danger)" }}>{error}</p> : null}
      {!drills.length ? (
        <p style={{ color: "var(--muted)", marginBottom: 0 }}>No saved drills yet. Run one below or on the home page.</p>
      ) : (
        <ol className="step-list">
          {drills.map((drill) => (
            <li key={drill.id}>
              <span aria-hidden="true">{drill.ok ? "✓" : "!"}</span>
              <span>
                <strong>{drill.ok ? "Pass" : "Fail"}</strong> · {drill.blobs} blobs · {drill.elapsedMs}ms
                <br />
                <span className="mono" style={{ color: "var(--muted)", fontSize: 13 }}>
                  {new Date(drill.at).toLocaleString()}
                </span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function PaidIntent() {
  const [sent, setSent] = useState(false);

  function markIntent(variant: string) {
    captureEvent("paid_intent", { variant });
    setSent(true);
  }

  return (
    <section className="card">
      <h2 style={{ marginTop: 0 }}>Would you pay?</h2>
      <p style={{ color: "var(--muted)" }}>
        The validation question is whether operators will pay for managed replica storage after they see a restore
        survive losing one provider.
      </p>
      {sent ? (
        <p style={{ color: "var(--ok)", marginBottom: 0 }}>Recorded. Thank you — this stays a private intent, not a charge.</p>
      ) : (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="btn btn-primary" onClick={() => markIntent("managed-replicas")}>
            I would pay for managed replicas
          </button>
          <button type="button" className="btn" onClick={() => markIntent("self-host-only")}>
            I would only self-host
          </button>
        </div>
      )}
    </section>
  );
}
