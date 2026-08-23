#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKDIR="${TMPDIR:-/tmp}/nostrborg-incremental-test-$$"
LOG="${TMPDIR:-/tmp}/nostrborg-incremental-test-$$.log"
trap 'rm -rf "$WORKDIR" "$LOG" "$LOG.refusal" "$LOG.symlink" "$WORKDIR-nonempty" "$WORKDIR-symlink"' EXIT

mkdir -p "$WORKDIR"
NONEMPTY="$WORKDIR-nonempty"
mkdir -p "$NONEMPTY"
printf 'do not delete me\n' > "$NONEMPTY/important.txt"
if "$ROOT/scripts/incremental-sync-proof.sh" "$NONEMPTY" >"$LOG.refusal" 2>&1; then
  echo "incremental-sync-proof.sh accepted a non-empty workdir" >&2
  exit 1
fi
test -f "$NONEMPTY/important.txt"

SYMLINK="$WORKDIR-symlink"
ln -s "$NONEMPTY" "$SYMLINK"
if "$ROOT/scripts/incremental-sync-proof.sh" "$SYMLINK" >"$LOG.symlink" 2>&1; then
  echo "incremental-sync-proof.sh accepted a symlink workdir" >&2
  exit 1
fi
test -f "$NONEMPTY/important.txt"

"$ROOT/scripts/incremental-sync-proof.sh" "$WORKDIR" >"$LOG"

grep -q "sync-1-uploaded-files=" "$LOG"
grep -q "sync-2-uploaded-files=" "$LOG"
grep -q "incremental-upload-smaller-than-full=ok" "$LOG"
grep -q "snapshot-1-restore=ok" "$LOG"
grep -q "snapshot-2-restore=ok" "$LOG"
grep -q "NOSTRBORG_INCREMENTAL_SYNC_PROOF_PASS" "$LOG"

sync1="$(awk -F= '/sync-1-uploaded-files=/{print $2}' "$LOG")"
sync2="$(awk -F= '/sync-2-uploaded-files=/{print $2}' "$LOG")"
manifest2="$(wc -l < "$WORKDIR/manifest-2.tsv" | tr -d ' ')"
test "$sync1" -gt 0
test "$sync2" -gt 0
test "$sync2" -lt "$manifest2"

test -f "$WORKDIR/restored-snapshot-1/source/notes.txt"
test -f "$WORKDIR/restored-snapshot-2/source/notes.txt"
test -f "$WORKDIR/restored-snapshot-2/source/new-file.txt"
! test -f "$WORKDIR/restored-snapshot-1/source/new-file.txt"
grep -q "version one" "$WORKDIR/restored-snapshot-1/source/notes.txt"
cmp "$WORKDIR/expected-snapshot-1/source/nested/data.bin" "$WORKDIR/restored-snapshot-1/source/nested/data.bin"
grep -q "version two" "$WORKDIR/restored-snapshot-2/source/notes.txt"
cmp "$WORKDIR/expected-snapshot-2/source/nested/data.bin" "$WORKDIR/restored-snapshot-2/source/nested/data.bin"
grep -q "changed-tail" "$WORKDIR/restored-snapshot-2/source/nested/data.bin"
