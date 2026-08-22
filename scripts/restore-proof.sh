#!/usr/bin/env bash
set -euo pipefail

if [ "${1:-}" ]; then
  WORKDIR="$1"
else
  WORKDIR="$(mktemp -d "${TMPDIR:-/tmp}/nostrborg-spike.XXXXXX")"
fi
PASSPHRASE="nostrborg-synthetic-test-passphrase"

require() {
  command -v "$1" >/dev/null || { echo "missing dependency: $1" >&2; exit 2; }
}

require borg
require rsync

if [ -L "$WORKDIR" ]; then
  echo "refusing symlink workdir: $WORKDIR" >&2
  exit 2
fi
mkdir -p "$WORKDIR"
if find "$WORKDIR" -mindepth 1 -maxdepth 1 | grep -q .; then
  echo "refusing non-empty workdir: $WORKDIR" >&2
  exit 2
fi
mkdir -p "$WORKDIR"/{source,stores,restored}
mkdir -p "$WORKDIR/source/nested"
printf 'nostrborg synthetic backup proof\n' > "$WORKDIR/source/notes.txt"
python3 - <<'PY' "$WORKDIR/source/nested/data.bin"
from pathlib import Path
import sys
Path(sys.argv[1]).write_bytes(bytes(range(256)) * 16)
PY

export BORG_PASSPHRASE="$PASSPHRASE"
export BORG_UNKNOWN_UNENCRYPTED_REPO_ACCESS_IS_OK=yes
export BORG_RELOCATED_REPO_ACCESS_IS_OK=yes

PRIMARY="$WORKDIR/primary-repo"
REPLICA_A="$WORKDIR/stores/blossom-a/repo"
REPLICA_B="$WORKDIR/stores/blossom-b/repo"

borg init --encryption=repokey "$PRIMARY" >/dev/null
borg create --stats "$PRIMARY::snapshot-1" "$WORKDIR/source" >/dev/null
borg check --verify-data "$PRIMARY" >/dev/null

mkdir -p "$(dirname "$REPLICA_A")" "$(dirname "$REPLICA_B")"
rsync -a --delete "$PRIMARY/" "$REPLICA_A/"
rsync -a --delete "$PRIMARY/" "$REPLICA_B/"

rm -rf "$(dirname "$REPLICA_A")"
if [ ! -d "$REPLICA_A" ] && [ -d "$REPLICA_B" ]; then
  echo "lost-replica-removed=ok"
else
  echo "lost-replica-removed=fail" >&2
  exit 1
fi

borg check --verify-data "$REPLICA_B" >/dev/null
echo "surviving-replica-borg-check=ok"

(
  cd "$WORKDIR/restored"
  borg extract "$REPLICA_B::snapshot-1"
)

cmp "$WORKDIR/source/notes.txt" "$WORKDIR/restored/$WORKDIR/source/notes.txt" >/dev/null
cmp "$WORKDIR/source/nested/data.bin" "$WORKDIR/restored/$WORKDIR/source/nested/data.bin" >/dev/null

# Flatten restore path for easier test inspection.
mkdir -p "$WORKDIR/restored-flat"
cp -R "$WORKDIR/restored/$WORKDIR/source" "$WORKDIR/restored-flat/source"
rm -rf "$WORKDIR/restored"
mv "$WORKDIR/restored-flat" "$WORKDIR/restored"

echo "NOSTRBORG_RESTORE_PROOF_PASS"
