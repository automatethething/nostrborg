import { createHash, randomBytes } from "node:crypto";

const DIGEST_RE = /^[0-9a-f]{64}$/;
const DEFAULT_BLOB_COUNT = 4;
const DEFAULT_BLOB_BYTES = 4096;
const MAX_BLOB_COUNT = 8;
const MAX_BLOB_BYTES = 16 * 1024;

export function isDigest(value) {
  return typeof value === "string" && DIGEST_RE.test(value);
}

export function sha256Hex(body) {
  return createHash("sha256").update(body).digest("hex");
}

export function bytesEqual(left, right) {
  if (!left || !right || left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) diff |= left[i] ^ right[i];
  return diff === 0;
}

export function putBlob(store, digest, body) {
  if (!isDigest(digest)) {
    const error = new Error("valid sha256 digest required");
    error.status = 400;
    throw error;
  }
  if (!(body instanceof Uint8Array)) {
    const error = new Error("octet body required");
    error.status = 400;
    throw error;
  }
  const actual = sha256Hex(body);
  if (actual !== digest) {
    const error = new Error("body does not match digest");
    error.status = 409;
    throw error;
  }
  const existed = store.has(digest);
  store.set(digest, Uint8Array.from(body));
  return { status: existed ? 200 : 201, sha256: digest, size: body.length };
}

export function getBlob(store, digest) {
  if (!isDigest(digest)) return null;
  const body = store.get(digest);
  return body ? Uint8Array.from(body) : null;
}

export function deleteBlob(store, digest) {
  if (!isDigest(digest)) return false;
  return store.delete(digest);
}

export function createSyntheticBlobs(blobCount = DEFAULT_BLOB_COUNT, blobBytes = DEFAULT_BLOB_BYTES) {
  const count = clampInt(blobCount, 1, MAX_BLOB_COUNT);
  const size = clampInt(blobBytes, 32, MAX_BLOB_BYTES);
  const blobs = [];
  for (let index = 0; index < count; index += 1) {
    const body = randomBytes(size);
    blobs.push({
      path: repoPath(index),
      digest: sha256Hex(body),
      size: body.length,
      body,
    });
  }
  return blobs;
}

export function runRestoreDrill({ blobCount = DEFAULT_BLOB_COUNT, blobBytes = DEFAULT_BLOB_BYTES } = {}) {
  const started = Date.now();
  const replicaA = new Map();
  const replicaB = new Map();
  const source = createSyntheticBlobs(blobCount, blobBytes);
  const steps = [];

  for (const blob of source) {
    putBlob(replicaA, blob.digest, blob.body);
    putBlob(replicaB, blob.digest, blob.body);
  }
  steps.push({
    id: "upload-replicas",
    ok: true,
    detail: `uploaded ${source.length} opaque blobs to replica-a and replica-b`,
  });

  replicaA.clear();
  steps.push({
    id: "destroy-replica-a",
    ok: replicaA.size === 0,
    detail: "deleted replica-a entirely",
  });

  const restored = [];
  for (const blob of source) {
    const missingA = getBlob(replicaA, blob.digest);
    if (missingA) {
      const error = new Error("destroyed replica still has blob");
      error.status = 500;
      throw error;
    }
    const body = getBlob(replicaB, blob.digest);
    if (!body) {
      const error = new Error("surviving replica missing blob");
      error.status = 500;
      throw error;
    }
    restored.push({ path: blob.path, digest: blob.digest, size: body.length, body });
  }
  steps.push({
    id: "restore-from-replica-b",
    ok: true,
    detail: `reassembled ${restored.length} blobs from replica-b`,
  });

  const byteEqual = source.every((blob, index) => bytesEqual(blob.body, restored[index].body));
  if (!byteEqual) {
    const error = new Error("restored bytes did not match source ciphertext");
    error.status = 500;
    throw error;
  }
  steps.push({
    id: "byte-compare",
    ok: true,
    detail: "restored ciphertext matched source byte-for-byte",
  });

  return {
    ok: true,
    blobs: source.length,
    blobBytes: source[0]?.size ?? 0,
    lostReplica: "a",
    survivingReplica: "b",
    byteEqual: true,
    elapsedMs: Date.now() - started,
    manifest: source.map(({ path, digest, size }) => ({ path, digest, size })),
    steps,
  };
}

function repoPath(index) {
  if (index === 0) return "config";
  if (index === 1) return "nonce";
  return `data/${String(index).padStart(2, "0")}.bin`;
}

function clampInt(value, min, max) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed)) return min;
  return Math.min(max, Math.max(min, parsed));
}
