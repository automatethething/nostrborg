# NostrBorg

Research spike for a sovereign encrypted Borg replication product.

## Current proof

`./scripts/restore-proof.sh` proves the smallest useful thing:

1. create a synthetic encrypted Borg repository;
2. fully replicate the opaque repository to two local stores;
3. delete one store entirely;
4. run `borg check --verify-data` on the surviving replica;
5. restore and byte-compare the recovered files.

Run:

```bash
./tests/test_restore_spike.sh
```

Passing output includes:

```text
lost-replica-removed=ok
surviving-replica-borg-check=ok
NOSTRBORG_RESTORE_PROOF_PASS
```

## What this does not prove yet

- Blossom upload/download semantics.
- Nostr manifest coordination.
- Concurrent writers or lock handling.
- Partial sharding / erasure coding.
- Real user backup safety.

ponytail: full-replica loss first; sharding is later only if full replication works and users reject the storage cost.
