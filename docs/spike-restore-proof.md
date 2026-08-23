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

## Follow-up result: local HTTP CAS + protected manifest proof

The third proof now also passes: two local Blossom-like HTTP blob stores accept `PUT /upload` with `X-SHA-256` and serve `GET /<sha256>`. The local server rejects mismatched hashes, unsupported transfer encodings, and invalid `Content-Length` headers. The manifest is encrypted with OpenSSL and HMAC-verified before decryption/use. After deleting one HTTP store, the script downloads every blob from the surviving store, reassembles the Borg repo, runs `borg check --verify-data`, restores, and byte-compares source files.

This supports another narrow premise: the local CAS reassembly model survives an HTTP blob-store boundary and can keep the repo-path manifest out of plaintext at rest for the eventual coordination layer.

## Follow-up result: incremental sync proof

The fourth proof now also passes: after `snapshot-1` is synced into CAS, `snapshot-2` changes/adds source files and the second sync uploads only new/changed Borg repository-file digests. Reassembling the first manifest restores snapshot 1, and reassembling the second manifest restores both snapshot 1 and snapshot 2. Borg cache/security state is isolated per reassembled repository so the proof tests repository bytes rather than local cache history.

This supports the next premise: Borg's ordinary multi-generation repository updates can map to content-addressed blob storage without re-uploading every repo file each backup cycle.

## Follow-up result: prune/compact proof

The fifth proof now also passes: after two snapshots are synced into CAS, snapshot 1 is deleted and `borg compact` rewrites the repository. The new manifest identifies CAS blobs no longer referenced by the compacted repository, snapshot 1 is no longer restorable from the compacted manifest, and snapshot 2 still restores byte-correctly.

This supports the deletion-lifecycle premise: NostrBorg can model prune/compact as a new manifest generation, while treating blobs referenced by older manifests but not newer ones as garbage-collection candidates only after retention policy allows.

## Remaining boundary

The spike still does not prove a production CAS garbage-collection policy, concurrent writers/locking, compatibility with a real Blossom server implementation, or Nostr relay event handling. Those are the next risks and should use synthetic data only.
