#!/usr/bin/env bash
set -euo pipefail

if [ "${1:-}" ]; then
  WORKDIR="$1"
else
  WORKDIR="$(mktemp -d "${TMPDIR:-/tmp}/nostrborg-cas-spike.XXXXXX")"
fi
PASSPHRASE="nostrborg-synthetic-test-passphrase"

require() {
  command -v "$1" >/dev/null || { echo "missing dependency: $1" >&2; exit 2; }
}

require borg
require shasum

if [ -L "$WORKDIR" ]; then
  echo "refusing symlink workdir: $WORKDIR" >&2
  exit 2
fi
mkdir -p "$WORKDIR"
if find "$WORKDIR" -mindepth 1 -maxdepth 1 | grep -q .; then
  echo "refusing non-empty workdir: $WORKDIR" >&2
  exit 2
fi
mkdir -p "$WORKDIR"/{source,stores,reassembled-repo,restored}
mkdir -p "$WORKDIR/source/nested"
printf 'nostrborg synthetic CAS restore proof\n' > "$WORKDIR/source/notes.txt"
python3 - <<'PY' "$WORKDIR/source/nested/data.bin"
from pathlib import Path
import sys
Path(sys.argv[1]).write_bytes(bytes(range(255, -1, -1)) * 16)
PY

export BORG_PASSPHRASE="$PASSPHRASE"
export BORG_UNKNOWN_UNENCRYPTED_REPO_ACCESS_IS_OK=yes
export BORG_RELOCATED_REPO_ACCESS_IS_OK=yes

PRIMARY="$WORKDIR/primary-repo"
STORE_A="$WORKDIR/stores/blossom-a"
STORE_B="$WORKDIR/stores/blossom-b"
MANIFEST="$WORKDIR/manifest.tsv"
REASSEMBLED="$WORKDIR/reassembled-repo"

borg init --encryption=repokey "$PRIMARY" >/dev/null
borg create --stats "$PRIMARY::snapshot-1" "$WORKDIR/source" >/dev/null
borg check --verify-data "$PRIMARY" >/dev/null

: > "$MANIFEST"
while IFS= read -r -d '' file; do
  rel="${file#"$PRIMARY/"}"
  digest="$(shasum -a 256 "$file" | awk '{print $1}')"
  subdir="${digest:0:2}"
  mkdir -p "$STORE_A/blobs/$subdir" "$STORE_B/blobs/$subdir"
  cp "$file" "$STORE_A/blobs/$subdir/$digest"
  cp "$file" "$STORE_B/blobs/$subdir/$digest"
  printf '%s\t%s\n' "$digest" "$rel" >> "$MANIFEST"
done < <(find "$PRIMARY" -type f -print0 | sort -z)

count="$(wc -l < "$MANIFEST" | tr -d ' ')"
echo "cas-uploaded-files=$count"

rm -rf "$STORE_A"
if [ ! -d "$STORE_A" ] && [ -d "$STORE_B" ]; then
  echo "lost-cas-store-removed=ok"
else
  echo "lost-cas-store-removed=fail" >&2
  exit 1
fi

while IFS=$'\t' read -r digest rel; do
  case "$rel" in
    /*|*../*|../*) echo "unsafe manifest path: $rel" >&2; exit 2 ;;
  esac
  src="$STORE_B/blobs/${digest:0:2}/$digest"
  test -f "$src"
  test "$(shasum -a 256 "$src" | awk '{print $1}')" = "$digest"
  mkdir -p "$REASSEMBLED/$(dirname "$rel")"
  cp "$src" "$REASSEMBLED/$rel"
done < "$MANIFEST"

borg check --verify-data "$REASSEMBLED" >/dev/null
echo "reassembled-repo-borg-check=ok"

(
  cd "$WORKDIR/restored"
  borg extract "$REASSEMBLED::snapshot-1"
)

cmp "$WORKDIR/source/notes.txt" "$WORKDIR/restored/$WORKDIR/source/notes.txt" >/dev/null
cmp "$WORKDIR/source/nested/data.bin" "$WORKDIR/restored/$WORKDIR/source/nested/data.bin" >/dev/null

mkdir -p "$WORKDIR/restored-flat"
cp -R "$WORKDIR/restored/$WORKDIR/source" "$WORKDIR/restored-flat/source"
rm -rf "$WORKDIR/restored"
mv "$WORKDIR/restored-flat" "$WORKDIR/restored"

echo "NOSTRBORG_CAS_RESTORE_PROOF_PASS"
