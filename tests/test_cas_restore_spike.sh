#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKDIR="${TMPDIR:-/tmp}/nostrborg-cas-test-$$"
LOG="${TMPDIR:-/tmp}/nostrborg-cas-test-$$.log"
trap 'rm -rf "$WORKDIR" "$LOG" "$LOG.refusal" "$LOG.symlink" "$WORKDIR-nonempty" "$WORKDIR-symlink"' EXIT

mkdir -p "$WORKDIR"
NONEMPTY="$WORKDIR-nonempty"
mkdir -p "$NONEMPTY"
printf 'do not delete me\n' > "$NONEMPTY/important.txt"
if "$ROOT/scripts/cas-restore-proof.sh" "$NONEMPTY" >"$LOG.refusal" 2>&1; then
  echo "cas-restore-proof.sh accepted a non-empty workdir" >&2
  exit 1
fi
test -f "$NONEMPTY/important.txt"

SYMLINK="$WORKDIR-symlink"
ln -s "$NONEMPTY" "$SYMLINK"
if "$ROOT/scripts/cas-restore-proof.sh" "$SYMLINK" >"$LOG.symlink" 2>&1; then
  echo "cas-restore-proof.sh accepted a symlink workdir" >&2
  exit 1
fi
test -f "$NONEMPTY/important.txt"

"$ROOT/scripts/cas-restore-proof.sh" "$WORKDIR" >"$LOG"

grep -q "cas-uploaded-files=" "$LOG"
grep -q "lost-cas-store-removed=ok" "$LOG"
grep -q "reassembled-repo-borg-check=ok" "$LOG"
grep -q "NOSTRBORG_CAS_RESTORE_PROOF_PASS" "$LOG"
test -f "$WORKDIR/restored/source/notes.txt"
test -f "$WORKDIR/restored/source/nested/data.bin"
cmp "$WORKDIR/source/notes.txt" "$WORKDIR/restored/source/notes.txt"
cmp "$WORKDIR/source/nested/data.bin" "$WORKDIR/restored/source/nested/data.bin"
python3 - <<'PY' "$WORKDIR/manifest.tsv"
from pathlib import Path
import sys
lines = Path(sys.argv[1]).read_text().splitlines()
assert lines, 'manifest should not be empty'
for line in lines:
    digest, rel = line.split('\t', 1)
    assert len(digest) == 64
    assert not rel.startswith('/')
    assert '..' not in Path(rel).parts
PY
