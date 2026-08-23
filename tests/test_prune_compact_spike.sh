#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKDIR="${TMPDIR:-/tmp}/nostrborg-prune-test-$$"
LOG="${TMPDIR:-/tmp}/nostrborg-prune-test-$$.log"
trap 'rm -rf "$WORKDIR" "$LOG" "$LOG.refusal" "$LOG.symlink" "$WORKDIR-nonempty" "$WORKDIR-symlink"' EXIT

mkdir -p "$WORKDIR"
NONEMPTY="$WORKDIR-nonempty"
mkdir -p "$NONEMPTY"
printf 'do not delete me\n' > "$NONEMPTY/important.txt"
if "$ROOT/scripts/prune-compact-proof.sh" "$NONEMPTY" >"$LOG.refusal" 2>&1; then
  echo "prune-compact-proof.sh accepted a non-empty workdir" >&2
  exit 1
fi
test -f "$NONEMPTY/important.txt"

SYMLINK="$WORKDIR-symlink"
ln -s "$NONEMPTY" "$SYMLINK"
if "$ROOT/scripts/prune-compact-proof.sh" "$SYMLINK" >"$LOG.symlink" 2>&1; then
  echo "prune-compact-proof.sh accepted a symlink workdir" >&2
  exit 1
fi
test -f "$NONEMPTY/important.txt"

"$ROOT/scripts/prune-compact-proof.sh" "$WORKDIR" >"$LOG"

grep -q "snapshot-1-before-prune-restore=ok" "$LOG"
grep -q "snapshot-2-after-compact-restore=ok" "$LOG"
grep -q "snapshot-1-after-prune-missing=ok" "$LOG"
grep -q "orphaned-cas-blobs=" "$LOG"
grep -q "NOSTRBORG_PRUNE_COMPACT_PROOF_PASS" "$LOG"

orphans="$(awk -F= '/orphaned-cas-blobs=/{print $2}' "$LOG")"
test "$orphans" -gt 0

test -f "$WORKDIR/restored-after-compact/source/notes.txt"
! borg list "$WORKDIR/reassembled-after-compact::snapshot-1" >/dev/null 2>&1
grep -q "kept version" "$WORKDIR/restored-after-compact/source/notes.txt"
cmp "$WORKDIR/expected-snapshot-2/source/kept.txt" "$WORKDIR/restored-after-compact/source/kept.txt"
