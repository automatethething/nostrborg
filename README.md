# NostrBorg

Sovereign encrypted Borg replication. Encrypted repository files become opaque content-addressed blobs. Losing one replica must not lose the backup.

Hosted app: `https://nostrborg.flowstate.market`

## Production test

The live product loop is a public restore drill:

1. generate synthetic ciphertext blobs;
2. upload them to two independent replicas;
3. delete replica A;
4. restore from replica B;
5. byte-compare.

```bash
pnpm test
pnpm dev
```

Open `/` and click **Run restore drill**, or:

```bash
curl -sS -X POST http://localhost:3000/api/drill
curl -sS http://localhost:3000/api/health
```

ConsentKeys sign-in is optional and only used for the operator dashboard. Recovery keys never go to the hosted app.

## Local Borg proofs

These still prove a real encrypted Borg repository, not the hosted synthetic drill.

`./scripts/restore-proof.sh` proves the smallest useful thing:

1. create a synthetic encrypted Borg repository;
2. fully replicate the opaque repository to two local stores;
3. delete one store entirely;
4. run `borg check --verify-data` on the surviving replica;
5. restore and byte-compare the recovered files.

`./scripts/cas-restore-proof.sh` proves SHA-256 CAS reassembly after losing one store.

`./scripts/http-cas-restore-proof.sh` proves the same flow through a localhost HTTP blob API.

`./scripts/incremental-sync-proof.sh` proves Borg's multi-generation flow stays delta-efficient over CAS.

`./scripts/prune-compact-proof.sh` proves prune/compact leaves orphaned blobs as GC candidates.

`tests/test_local_relay_manifest_spike.py` proves an encrypted manifest round-trip through a localhost Nostr relay stub.

Run:

```bash
./scripts/local-rehearsal.sh
pnpm test
```

## What this does not prove yet

- Public Blossom provider terms, logging, or retention.
- Real Nostr relay policy, NIP-11 behavior, and event-size limits.
- Concurrent writers or lock handling.
- Partial sharding / erasure coding.
- A managed backup SLA or paid plan.

ponytail: full-replica loss first; sharding is later only if full replication works and users reject the storage cost.
