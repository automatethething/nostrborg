import { finalizeEvent, generateSecretKey } from "npm:nostr-tools@2.23.3";

const base = Deno.env.get("BLOSSOM_SERVER_URL") ?? "http://127.0.0.1:38765";
if (!base.startsWith("http://127.0.0.1:")) throw new Error("loopback URL required");

const body = new TextEncoder().encode("nostrborg-local-authenticated-synthetic-ciphertext\0");
const digest = [...new Uint8Array(await crypto.subtle.digest("SHA-256", body))]
  .map((byte) => byte.toString(16).padStart(2, "0"))
  .join("");
const secretKey = generateSecretKey();

function authorization(verb: string, hashes: string[] = []) {
  const event = finalizeEvent({
    kind: 24242,
    content: "NostrBorg local synthetic test",
    tags: [["t", verb], ...hashes.map((hash) => ["x", hash]), ["expiration", String(Math.floor(Date.now() / 1000) + 60)]],
    created_at: Math.floor(Date.now() / 1000),
  }, secretKey);
  return `Nostr ${btoa(JSON.stringify(event))}`;
}

async function request(path: string, init: RequestInit = {}) {
  return fetch(`${base}${path}`, {
    ...init,
    headers: { ...(init.headers ?? {}), Authorization: authorization("upload") },
  });
}

const preflight = await request("/upload", {
  method: "HEAD",
  headers: {
    "X-Content-Length": String(body.length),
    "X-Content-Type": "application/octet-stream",
    "X-SHA-256": digest,
  },
});
if (preflight.status !== 200) throw new Error(`preflight=${preflight.status}`);

const upload = await request("/upload", {
  method: "PUT",
  body,
  headers: { "Content-Type": "application/octet-stream", "Content-Length": String(body.length) },
});
if (![200, 201].includes(upload.status)) throw new Error(`upload=${upload.status}`);

const download = await fetch(`${base}/${digest}`);
if (download.status !== 200) throw new Error(`download=${download.status}`);
const restored = new Uint8Array(await download.arrayBuffer());
if (restored.length !== body.length || restored.some((byte, i) => byte !== body[i])) throw new Error("byte equality failed");

const deleteAuth = authorization("delete", [digest]);
const deletion = await fetch(`${base}/${digest}`, { method: "DELETE", headers: { Authorization: deleteAuth } });
if (deletion.status !== 204) throw new Error(`delete=${deletion.status}`);

console.log("bud-11-upload-auth=ok");
console.log("bud-02-upload-get-byte-equality=ok");
console.log("bud-02-delete-auth=ok");
console.log("NOSTRBORG_LOCAL_BLOSSOM_AUTH_PROOF_PASS");
