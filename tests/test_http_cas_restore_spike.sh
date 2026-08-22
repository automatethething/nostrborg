#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKDIR="${TMPDIR:-/tmp}/nostrborg-http-cas-test-$$"
LOG="${TMPDIR:-/tmp}/nostrborg-http-cas-test-$$.log"
trap 'rm -rf "$WORKDIR" "$LOG" "$LOG.refusal" "$LOG.symlink" "$WORKDIR-nonempty" "$WORKDIR-symlink"' EXIT

mkdir -p "$WORKDIR"
NONEMPTY="$WORKDIR-nonempty"
mkdir -p "$NONEMPTY"
printf 'do not delete me\n' > "$NONEMPTY/important.txt"
if "$ROOT/scripts/http-cas-restore-proof.sh" "$NONEMPTY" >"$LOG.refusal" 2>&1; then
  echo "http-cas-restore-proof.sh accepted a non-empty workdir" >&2
  exit 1
fi
test -f "$NONEMPTY/important.txt"

SYMLINK="$WORKDIR-symlink"
ln -s "$NONEMPTY" "$SYMLINK"
if "$ROOT/scripts/http-cas-restore-proof.sh" "$SYMLINK" >"$LOG.symlink" 2>&1; then
  echo "http-cas-restore-proof.sh accepted a symlink workdir" >&2
  exit 1
fi
test -f "$NONEMPTY/important.txt"

"$ROOT/scripts/http-cas-restore-proof.sh" "$WORKDIR" >"$LOG"

grep -q "http-cas-uploaded-files=" "$LOG"
grep -q "lost-http-cas-store-removed=ok" "$LOG"
grep -q "manifest-hmac-verified=ok" "$LOG"
grep -q "manifest-decrypted=ok" "$LOG"
grep -q "http-reassembled-repo-borg-check=ok" "$LOG"
grep -q "NOSTRBORG_HTTP_CAS_RESTORE_PROOF_PASS" "$LOG"
test -s "$WORKDIR/manifest.enc"
test -s "$WORKDIR/manifest.hmac"
test -f "$WORKDIR/restored/source/notes.txt"
test -f "$WORKDIR/restored/source/nested/data.bin"
cmp "$WORKDIR/source/notes.txt" "$WORKDIR/restored/source/notes.txt"
cmp "$WORKDIR/source/nested/data.bin" "$WORKDIR/restored/source/nested/data.bin"
