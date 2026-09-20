import assert from "node:assert/strict";
import test from "node:test";
import { shouldSuppressInstallPrompt } from "./pwaInstall.mjs";

test("suppresses install prompt in standalone mode", () => {
  assert.equal(
    shouldSuppressInstallPrompt({ isStandalone: true, dismissedAt: null, now: 1000 }),
    true
  );
});

test("suppresses install prompt after recent dismissal", () => {
  const day = 24 * 60 * 60 * 1000;

  assert.equal(
    shouldSuppressInstallPrompt({ isStandalone: false, dismissedAt: 10 * day, now: 20 * day }),
    true
  );
});

test("allows install prompt after dismissal window expires", () => {
  const day = 24 * 60 * 60 * 1000;

  assert.equal(
    shouldSuppressInstallPrompt({ isStandalone: false, dismissedAt: 0, now: 31 * day }),
    false
  );
});
