import assert from "node:assert/strict";
import test from "node:test";
import { analyticsCaptureUrl, analyticsEnabled } from "./analytics.mjs";

test("browser captures go through the first-party ingest rewrite", () => {
  assert.equal(analyticsCaptureUrl("https://nostrborg.vercel.app"), "https://nostrborg.vercel.app/ingest/capture/");
});

test("analytics stay off without a configured key", () => {
  assert.equal(analyticsEnabled(""), false);
  assert.equal(analyticsEnabled("phc_test_key"), true);
});
