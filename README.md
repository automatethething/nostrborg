# NostrBorg

Research spike for a sovereign encrypted Borg replication product.

## Current proofs

`./scripts/restore-proof.sh` proves the smallest useful thing:

1. create a synthetic encrypted Borg repository;
2. fully replicate the opaque repository to two local stores;
3. delete one store entirely;
4. run `borg check --verify-data` on the surviving replica;
5. restore and byte-compare the recovered files.

`./scripts/cas-restore-proof.sh` proves the next useful thing:

1. create the same kind of synthetic encrypted Borg repository;
2. upload every opaque repository file into two local content-addressed stores keyed by SHA-256;
3. write a minimal manifest of `digest → repo-relative path`;
4. delete one CAS store;
5. reassemble the Borg repository from the surviving CAS store and manifest;
6. run `borg check --verify-data`, restore, and byte-compare.

`./scripts/http-cas-restore-proof.sh` proves the same flow through a localhost HTTP blob API:

1. start two local Blossom-like HTTP blob stores;
2. upload each opaque Borg repo file with `PUT /upload` plus `X-SHA-256`, and download with `GET /<sha256>`;
3. encrypt the manifest with OpenSSL and verify its HMAC before use;
4. delete one HTTP store;
5. download blobs from the survivor, reassemble the Borg repo, `borg check`, restore, and byte-compare.

`./scripts/incremental-sync-proof.sh` proves Borg's normal multi-generation flow can stay delta-efficient over the CAS layer:

1. create `snapshot-1` and sync repo files into CAS;
2. change/add source files and create `snapshot-2`;
3. sync again, uploading only new/changed repo-file digests;
4. reassemble both generation manifests;
5. restore `snapshot-1` and `snapshot-2` byte-correctly from CAS.

`./scripts/prune-compact-proof.sh` proves the deletion lifecycle boundary:

1. create two snapshots and sync the repo into CAS;
2. verify the pre-prune manifest restores snapshot 1;
3. delete snapshot 1 and run `borg compact`;
4. sync the compacted repo and count CAS blobs orphaned by the new manifest;
5. verify snapshot 1 is gone and snapshot 2 still restores.

`tests/test_local_relay_manifest_spike.py` proves the local Nostr relay shape:

1. encrypt/authenticate a synthetic manifest payload;
2. wrap it in a deterministic NIP-01-shaped replaceable event;
3. publish to a localhost WebSocket relay stub;
4. fetch by event id;
5. decrypt and verify the manifest bytes.

Run:

```bash
./tests/test_restore_spike.sh
./tests/test_cas_restore_spike.sh
./tests/test_http_cas_restore_spike.sh
./tests/test_incremental_sync_spike.sh
./tests/test_prune_compact_spike.sh
python3 -m unittest tests/test_local_relay_manifest_spike.py -v
```

Passing output includes:

```text
lost-replica-removed=ok
surviving-replica-borg-check=ok
NOSTRBORG_RESTORE_PROOF_PASS
cas-uploaded-files=<n>
lost-cas-store-removed=ok
reassembled-repo-borg-check=ok
NOSTRBORG_CAS_RESTORE_PROOF_PASS
http-cas-uploaded-files=<n>
lost-http-cas-store-removed=ok
manifest-hmac-verified=ok
manifest-decrypted=ok
http-reassembled-repo-borg-check=ok
NOSTRBORG_HTTP_CAS_RESTORE_PROOF_PASS
sync-1-uploaded-files=<n>
sync-2-uploaded-files=<n>
incremental-upload-smaller-than-full=ok
snapshot-1-restore=ok
snapshot-2-restore=ok
NOSTRBORG_INCREMENTAL_SYNC_PROOF_PASS
snapshot-1-before-prune-restore=ok
snapshot-1-after-prune-missing=ok
snapshot-2-after-compact-restore=ok
orphaned-cas-blobs=<n>
NOSTRBORG_PRUNE_COMPACT_PROOF_PASS
local relay manifest publish/fetch unit tests pass
```

## Local protocol checkpoint

The official `hzrd149/blossom-server` reference implementation was built from a clean public clone and started on loopback with auth and local storage enabled. BUD-01/BUD-02/BUD-06 routes were present; landing-page and CORS probes returned 200, missing blobs returned 404, and unauthenticated upload preflight returned 401. A separate auth-disabled, loopback-only staging run uploaded one bounded synthetic ciphertext, verified `PUT` 201 → `GET` 200 byte equality, and verified `DELETE` 204 → `GET` 404. No public upload was sent.

Run the complete local rehearsal with:

```bash
./scripts/local-rehearsal.sh
```

With the official loopback server running, `deno run --allow-net --allow-env scripts/local-blossom-auth-proof.ts` also proves real BUD-11 signed upload auth, BUD-02 upload/download byte equality, and signed delete cleanup. The test generates its Nostr key in memory and uses only synthetic ciphertext.

The disposable Finland ingress test used `scripts/public-blossom-auth-proof.ts` against the owner-controlled HTTPS hostname. It is hard-coded to that hostname, generates one fixed 64 KiB random synthetic ciphertext in memory, performs one authenticated upload/download/delete cycle, and does not publish to Nostr.

## What this does not prove yet

- Public Blossom server compatibility, retention, or terms.
- Real Nostr relay policy, NIP-11 behavior, and event-size limits.
- Real Nostr key/signature handling; the local relay proof uses synthetic unsigned events.
- CAS garbage collection policy after prune/compact identifies orphans.
- Concurrent writers or lock handling.
- Partial sharding / erasure coding.
- Real user backup safety.

ponytail: full-replica loss first; sharding is later only if full replication works and users reject the storage cost.
