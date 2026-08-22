#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKDIR="${TMPDIR:-/tmp}/nostrborg-test-$$"
LOG="${TMPDIR:-/tmp}/nostrborg-test-$$.log"
trap 'rm -rf "$WORKDIR" "$LOG"' EXIT

mkdir -p "$WORKDIR"
NONEMPTY="$WORKDIR-nonempty"
mkdir -p "$NONEMPTY"
printf 'do not delete me\n' > "$NONEMPTY/important.txt"
if "$ROOT/scripts/restore-proof.sh" "$NONEMPTY" >"$LOG.refusal" 2>&1; then
  echo "restore-proof.sh accepted a non-empty workdir" >&2
  exit 1
fi
test -f "$NONEMPTY/important.txt"

SYMLINK="$WORKDIR-symlink"
ln -s "$NONEMPTY" "$SYMLINK"
if "$ROOT/scripts/restore-proof.sh" "$SYMLINK" >"$LOG.symlink" 2>&1; then
  echo "restore-proof.sh accepted a symlink workdir" >&2
  exit 1
fi
test -f "$NONEMPTY/important.txt"

"$ROOT/scripts/restore-proof.sh" "$WORKDIR" >"$LOG"

grep -q "NOSTRBORG_RESTORE_PROOF_PASS" "$LOG"
test -f "$WORKDIR/restored/source/notes.txt"
test -f "$WORKDIR/restored/source/nested/data.bin"
cmp "$WORKDIR/source/notes.txt" "$WORKDIR/restored/source/notes.txt"
cmp "$WORKDIR/source/nested/data.bin" "$WORKDIR/restored/source/nested/data.bin"
grep -q "surviving-replica-borg-check=ok" "$LOG"
grep -q "lost-replica-removed=ok" "$LOG"
