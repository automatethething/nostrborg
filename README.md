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

Run:

```bash
./tests/test_restore_spike.sh
./tests/test_cas_restore_spike.sh
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
```

## What this does not prove yet

- Real Blossom HTTP upload/download semantics.
- Nostr manifest coordination/encryption.
- Concurrent writers or lock handling.
- Partial sharding / erasure coding.
- Real user backup safety.

ponytail: full-replica loss first; sharding is later only if full replication works and users reject the storage cost.
