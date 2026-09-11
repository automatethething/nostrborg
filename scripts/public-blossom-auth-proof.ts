import { finalizeEvent, generateSecretKey } from "npm:nostr-tools@2.23.3";

const base = Deno.env.get("BLOSSOM_SERVER_URL") ?? "https://blossom.21eyes.com";
const url = new URL(base);
if (url.protocol !== "https:" || url.hostname !== "blossom.21eyes.com" || url.pathname !== "/") {
  throw new Error("refusing any endpoint except https://blossom.21eyes.com");
}

const body = new Uint8Array(64 * 1024);
crypto.getRandomValues(body);
const digest = [...new Uint8Array(await crypto.subtle.digest("SHA-256", body))]
  .map((byte) => byte.toString(16).padStart(2, "0"))
  .join("");
const secretKey = generateSecretKey();

function authorization(verb: string, hashes: string[] = []) {
  const event = finalizeEvent({
    kind: 24242,
    content: "NostrBorg synthetic interoperability test",
    tags: [["t", verb], ...hashes.map((hash) => ["x", hash]), ["expiration", String(Math.floor(Date.now() / 1000) + 60)]],
    created_at: Math.floor(Date.now() / 1000),
  }, secretKey);
  return `Nostr ${btoa(JSON.stringify(event))}`;
}

const preflight = await fetch(`${base}/upload`, {
  method: "HEAD",
  headers: {
    Authorization: authorization("upload"),
    "X-Content-Length": String(body.length),
    "X-Content-Type": "application/octet-stream",
    "X-SHA-256": digest,
  },
});
if (preflight.status !== 200) throw new Error(`preflight=${preflight.status}`);

const upload = await fetch(`${base}/upload`, {
  method: "PUT",
  body,
  headers: {
    Authorization: authorization("upload", [digest]),
    "Content-Type": "application/octet-stream",
    "Content-Length": String(body.length),
  },
});
if (![200, 201].includes(upload.status)) throw new Error(`upload=${upload.status}`);

const download = await fetch(`${base}/${digest}`);
if (download.status !== 200) throw new Error(`download=${download.status}`);
const restored = new Uint8Array(await download.arrayBuffer());
if (restored.length !== body.length || restored.some((byte, i) => byte !== body[i])) throw new Error("byte equality failed");

const deletion = await fetch(`${base}/${digest}`, {
  method: "DELETE",
  headers: { Authorization: authorization("delete", [digest]) },
});
if (deletion.status !== 204) throw new Error(`delete=${deletion.status}`);

const missing = await fetch(`${base}/${digest}`);
if (missing.status !== 404) throw new Error(`post-delete=${missing.status}`);

console.log("public-https-tls-host=ok");
console.log("bud-06-preflight=ok");
console.log("bud-11-upload-auth=ok");
console.log("bud-01-download-byte-equality=ok");
console.log("bud-02-delete-auth-and-404=ok");
console.log("NOSTRBORG_PUBLIC_BLOSSOM_AUTH_PROOF_PASS");
