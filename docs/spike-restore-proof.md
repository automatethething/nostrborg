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

## Follow-up result: local CAS proof

The next proof now also passes: every opaque file in a synthetic encrypted Borg repo is copied into two local SHA-256 content-addressed stores, a manifest records `digest → repo-relative path`, one store is deleted, and the Borg repo is reassembled from the surviving CAS store. The reassembled repo passes `borg check --verify-data` and restores byte-identical source files.

This supports the next narrow premise: a Blossom-like blob layer can store Borg repository files as opaque content-addressed blobs if a safe manifest preserves the repository-relative paths.

## Next technical question

Can the same CAS proof work through a real or locally emulated Blossom HTTP API, while encrypting/signing the manifest payload that would later live on Nostr?
