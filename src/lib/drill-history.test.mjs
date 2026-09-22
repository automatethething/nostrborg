import assert from "node:assert/strict";
import test from "node:test";
import { appendHistory, createMemoryHistoryStore, isUserId, summarizeReceipt } from "./drill-history.mjs";

test("rejects empty user ids", () => {
  assert.equal(isUserId(""), false);
  assert.equal(isUserId("ck_sub_1"), true);
});

test("summarizeReceipt drops ciphertext and extra fields", () => {
  const summary = summarizeReceipt({
    ok: true,
    blobs: 4,
    blobBytes: 4096,
    lostReplica: "a",
    survivingReplica: "b",
    elapsedMs: 12,
    body: "secret-bytes",
    manifest: [{ path: "config", digest: "abc", body: "nope" }],
    steps: [
      { id: "upload-replicas", ok: true, detail: "uploaded" },
      { id: "unknown", ok: true },
    ],
  }, "2026-09-22T00:00:00.000Z");

  assert.equal(summary.ok, true);
  assert.equal(summary.blobs, 4);
  assert.equal("body" in summary, false);
  assert.equal("manifest" in summary, false);
  assert.equal(summary.steps.length, 1);
  assert.equal(summary.steps[0].id, "upload-replicas");
});

test("appendHistory keeps newest 20 rows", () => {
  const first = summarizeReceipt({ ok: true, blobs: 1, steps: [] });
  let rows = appendHistory([], first);
  for (let i = 0; i < 25; i += 1) {
    rows = appendHistory(rows, summarizeReceipt({ ok: true, blobs: 2, steps: [] }));
  }
  assert.equal(rows.length, 20);
  assert.equal(rows[0].blobs, 2);
});

test("memory store round-trips per user", async () => {
  const store = createMemoryHistoryStore();
  const summary = summarizeReceipt({ ok: true, blobs: 3, lostReplica: "a", survivingReplica: "b", steps: [] });
  await store.set("user-a", appendHistory(await store.get("user-a"), summary));
  assert.equal((await store.get("user-a")).length, 1);
  assert.equal((await store.get("user-b")).length, 0);
});
