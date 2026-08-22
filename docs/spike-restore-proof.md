# Restore proof spike

Date: 2026-08-22

## Decision

Start NostrBorg with a local Borg restore-correctness proof, not Nostr, Blossom, dashboard, billing, or marketplace work.

## Consensus

cmux Claude and cmux agy both recommended the same next action: prove that a Borg backup can be restored after losing one storage replica. Claude recommended the lazier full-replica local-store proof before protocol stubs; agy recommended adding local Blossom/Nostr stubs soon after. The implemented spike follows the shared core recommendation and defers protocol stubs.

## Result

The local spike passes with synthetic data:

- encrypted Borg repository initialized with `repokey`;
- one archive created from synthetic source files;
- repository fully copied to two local replica directories;
- one replica deleted;
- surviving replica passes `borg check --verify-data`;
- archive restores from the survivor;
- restored files byte-compare equal to source files.

## Interpretation

This supports the narrow MVP premise: full opaque Borg repository replication can survive total loss of one storage provider when another provider has a complete replica.

It does **not** prove safe partial sharding, mutable metadata synchronization over Blossom, concurrent writer safety, retention guarantees, or usable recovery UX.

## Next technical question

Can a local Blossom-like content-addressed store reassemble an identical Borg repository from uploaded opaque files without changing Borg behavior?
