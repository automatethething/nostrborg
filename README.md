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

Run:

```bash
./tests/test_restore_spike.sh
./tests/test_cas_restore_spike.sh
./tests/test_http_cas_restore_spike.sh
./tests/test_incremental_sync_spike.sh
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
```

## What this does not prove yet

- Real Blossom server compatibility.
- Nostr event publishing/relay behavior.
- Prune/compact deletion lifecycle and orphaned blob garbage collection.
- Concurrent writers or lock handling.
- Partial sharding / erasure coding.
- Real user backup safety.

ponytail: full-replica loss first; sharding is later only if full replication works and users reject the storage cost.
