import assert from "node:assert/strict";
import test from "node:test";
import { stripJwtSecrets, stripSessionSecrets } from "./session-public.mjs";

test("stripSessionSecrets drops bearer credentials from the public session", () => {
  const session = stripSessionSecrets({
    accessToken: "tok_live",
    userInfo: { sub: "ck_sub", extra: true },
    user: { id: "ck_sub", name: "alias", email: "alias@example.com", image: "https://example.test/x" },
    expires: "2026-10-01T00:00:00.000Z",
  });

  assert.equal("accessToken" in session, false);
  assert.equal("userInfo" in session, false);
  assert.deepEqual(session.user, {
    id: "ck_sub",
    name: "alias",
    email: "alias@example.com",
  });
  assert.equal(session.expires, "2026-10-01T00:00:00.000Z");
});

test("stripJwtSecrets removes access tokens from refreshed JWTs", () => {
  const token = stripJwtSecrets({
    id: "ck_sub",
    name: "alias",
    accessToken: "tok_live",
    userInfo: { sub: "ck_sub" },
  });
  assert.equal(token.id, "ck_sub");
  assert.equal("accessToken" in token, false);
  assert.equal("userInfo" in token, false);
});
