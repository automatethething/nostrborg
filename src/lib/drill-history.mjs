const MAX_HISTORY = 20;
const MAX_USER_ID = 128;
const STEP_IDS = new Set([
  "upload-replicas",
  "destroy-replica-a",
  "restore-from-replica-b",
  "byte-compare",
]);

export function isUserId(value) {
  return typeof value === "string" && value.length > 0 && value.length <= MAX_USER_ID;
}

export function summarizeReceipt(receipt, at = new Date().toISOString()) {
  if (!receipt || typeof receipt !== "object") {
    const error = new Error("receipt required");
    error.status = 400;
    throw error;
  }

  const steps = Array.isArray(receipt.steps)
    ? receipt.steps
        .filter((step) => step && STEP_IDS.has(step.id))
        .slice(0, 8)
        .map((step) => ({ id: step.id, ok: Boolean(step.ok) }))
    : [];

  return {
    id: crypto.randomUUID(),
    at,
    ok: Boolean(receipt.ok),
    blobs: clampInt(receipt.blobs, 0, 8),
    blobBytes: clampInt(receipt.blobBytes, 0, 16 * 1024),
    lostReplica: receipt.lostReplica === "a" ? "a" : "",
    survivingReplica: receipt.survivingReplica === "b" ? "b" : "",
    elapsedMs: clampInt(receipt.elapsedMs, 0, 60_000),
    steps,
  };
}

export function appendHistory(existing, summary) {
  const rows = Array.isArray(existing) ? existing.filter((row) => row && row.id && row.at) : [];
  return [summary, ...rows].slice(0, MAX_HISTORY);
}

export function createMemoryHistoryStore(map = new Map()) {
  return {
    async get(userId) {
      if (!isUserId(userId)) return [];
      const rows = map.get(userId);
      return Array.isArray(rows) ? rows : [];
    },
    async set(userId, rows) {
      if (!isUserId(userId)) {
        const error = new Error("user required");
        error.status = 401;
        throw error;
      }
      map.set(userId, rows);
    },
  };
}

function clampInt(value, min, max) {
  const parsed = Number.parseInt(String(value ?? 0), 10);
  if (!Number.isFinite(parsed)) return min;
  return Math.min(max, Math.max(min, parsed));
}
