import assert from "node:assert/strict";
import test from "node:test";
import {
  bytesEqual,
  createSyntheticBlobs,
  getBlob,
  isDigest,
  putBlob,
  runRestoreDrill,
  sha256Hex,
} from "./restore-drill.mjs";

test("rejects mismatched blob digests", () => {
  const store = new Map();
  const body = Uint8Array.from([1, 2, 3, 4]);
  assert.throws(() => putBlob(store, "a".repeat(64), body), { status: 409 });
});

test("stores and returns opaque blobs by sha256", () => {
  const store = new Map();
  const body = Uint8Array.from([9, 8, 7, 6]);
  const digest = sha256Hex(body);
  const uploaded = putBlob(store, digest, body);
  assert.equal(uploaded.status, 201);
  assert.equal(isDigest(uploaded.sha256), true);
  assert.equal(bytesEqual(getBlob(store, digest), body), true);
});

test("restore drill survives total loss of one replica", () => {
  const receipt = runRestoreDrill({ blobCount: 3, blobBytes: 128 });
  assert.equal(receipt.ok, true);
  assert.equal(receipt.blobs, 3);
  assert.equal(receipt.byteEqual, true);
  assert.equal(receipt.lostReplica, "a");
  assert.equal(receipt.survivingReplica, "b");
  assert.equal(receipt.manifest.length, 3);
  assert.equal(receipt.steps.every((step) => step.ok), true);
  assert.equal("body" in receipt.manifest[0], false);
});

test("synthetic blobs stay ciphertext-sized and digested", () => {
  const blobs = createSyntheticBlobs(2, 64);
  assert.equal(blobs.length, 2);
  for (const blob of blobs) {
    assert.equal(blob.size, 64);
    assert.equal(blob.digest, sha256Hex(blob.body));
  }
});
