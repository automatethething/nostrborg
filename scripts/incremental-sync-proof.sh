#!/usr/bin/env bash
set -euo pipefail

if [ "${1:-}" ]; then
  WORKDIR="$1"
else
  WORKDIR="$(mktemp -d "${TMPDIR:-/tmp}/nostrborg-incremental-spike.XXXXXX")"
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
mkdir -p "$WORKDIR"/{source,cas,reassembled-snapshot-1,reassembled-snapshot-2}
mkdir -p "$WORKDIR/source/nested" "$WORKDIR/expected-snapshot-1/source/nested" "$WORKDIR/expected-snapshot-2/source/nested"
printf 'version one\n' > "$WORKDIR/source/notes.txt"
python3 - <<'PY' "$WORKDIR/source/nested/data.bin"
from pathlib import Path
import sys
Path(sys.argv[1]).write_bytes(b'initial-data\0' * 300)
PY
cp -R "$WORKDIR/source/." "$WORKDIR/expected-snapshot-1/source/"

export BORG_PASSPHRASE="$PASSPHRASE"
export BORG_UNKNOWN_UNENCRYPTED_REPO_ACCESS_IS_OK=yes
export BORG_RELOCATED_REPO_ACCESS_IS_OK=yes

PRIMARY="$WORKDIR/primary-repo"
CAS="$WORKDIR/cas"
MANIFEST_1="$WORKDIR/manifest-1.tsv"
MANIFEST_2="$WORKDIR/manifest-2.tsv"

safe_manifest_path() {
  case "$1" in
    /*|*../*|../*) echo "unsafe manifest path: $1" >&2; exit 2 ;;
  esac
}

sync_repo_to_cas() {
  repo="$1"
  manifest="$2"
  : > "$manifest"
  uploaded=0
  while IFS= read -r -d '' file; do
    rel="${file#"$repo/"}"
    safe_manifest_path "$rel"
    digest="$(shasum -a 256 "$file" | awk '{print $1}')"
    blob="$CAS/${digest:0:2}/$digest"
    if [ ! -f "$blob" ]; then
      mkdir -p "$(dirname "$blob")"
      cp "$file" "$blob"
      uploaded=$((uploaded + 1))
    fi
    printf '%s\t%s\n' "$digest" "$rel" >> "$manifest"
  done < <(find "$repo" -type f -print0 | sort -z)
  echo "$uploaded"
}

reassemble_from_manifest() {
  manifest="$1"
  dest="$2"
  rm -rf "$dest"
  mkdir -p "$dest"
  while IFS=$'\t' read -r digest rel; do
    safe_manifest_path "$rel"
    blob="$CAS/${digest:0:2}/$digest"
    test -f "$blob"
    test "$(shasum -a 256 "$blob" | awk '{print $1}')" = "$digest"
    mkdir -p "$dest/$(dirname "$rel")"
    cp "$blob" "$dest/$rel"
  done < "$manifest"
}

borg_isolated() {
  base="$1"
  shift
  mkdir -p "$base"
  BORG_BASE_DIR="$base" borg "$@"
}

extract_archive_flat() {
  repo="$1"
  archive="$2"
  out="$3"
  raw="$WORKDIR/raw-$archive-$RANDOM"
  rm -rf "$raw" "$out"
  mkdir -p "$raw"
  (cd "$raw" && borg_isolated "$WORKDIR/borg-base-extract-$archive-$RANDOM" extract "$repo::$archive")
  mkdir -p "$out"
  cp -R "$raw/$WORKDIR/source" "$out/source"
}

borg init --encryption=repokey "$PRIMARY" >/dev/null
borg create --stats "$PRIMARY::snapshot-1" "$WORKDIR/source" >/dev/null
borg check --verify-data "$PRIMARY" >/dev/null
sync1="$(sync_repo_to_cas "$PRIMARY" "$MANIFEST_1")"
echo "sync-1-uploaded-files=$sync1"

printf 'version two\n' > "$WORKDIR/source/notes.txt"
printf 'new content\n' > "$WORKDIR/source/new-file.txt"
python3 - <<'PY' "$WORKDIR/source/nested/data.bin"
from pathlib import Path
import sys
Path(sys.argv[1]).write_bytes(b'initial-data\0' * 300 + b'changed-tail')
PY
cp -R "$WORKDIR/source/." "$WORKDIR/expected-snapshot-2/source/"
borg create --stats "$PRIMARY::snapshot-2" "$WORKDIR/source" >/dev/null
borg check --verify-data "$PRIMARY" >/dev/null
sync2="$(sync_repo_to_cas "$PRIMARY" "$MANIFEST_2")"
echo "sync-2-uploaded-files=$sync2"
manifest2_count="$(wc -l < "$MANIFEST_2" | tr -d ' ')"
if [ "$sync2" -gt 0 ] && [ "$sync2" -lt "$manifest2_count" ]; then
  echo "incremental-upload-smaller-than-full=ok"
else
  echo "incremental-upload-smaller-than-full=fail sync2=$sync2 manifest2=$manifest2_count" >&2
  exit 1
fi

REPO_1="$WORKDIR/reassembled-snapshot-1"
REPO_2="$WORKDIR/reassembled-snapshot-2"
reassemble_from_manifest "$MANIFEST_1" "$REPO_1"
reassemble_from_manifest "$MANIFEST_2" "$REPO_2"
borg_isolated "$WORKDIR/borg-base-check-1" check --verify-data "$REPO_1" >/dev/null
borg_isolated "$WORKDIR/borg-base-check-2" check --verify-data "$REPO_2" >/dev/null

extract_archive_flat "$REPO_1" snapshot-1 "$WORKDIR/restored-snapshot-1"
extract_archive_flat "$REPO_2" snapshot-1 "$WORKDIR/restored-snapshot-1-from-latest"
extract_archive_flat "$REPO_2" snapshot-2 "$WORKDIR/restored-snapshot-2"

diff -r "$WORKDIR/expected-snapshot-1/source" "$WORKDIR/restored-snapshot-1/source" >/dev/null
diff -r "$WORKDIR/expected-snapshot-1/source" "$WORKDIR/restored-snapshot-1-from-latest/source" >/dev/null
echo "snapshot-1-restore=ok"
diff -r "$WORKDIR/expected-snapshot-2/source" "$WORKDIR/restored-snapshot-2/source" >/dev/null
grep -q "changed-tail" "$WORKDIR/restored-snapshot-2/source/nested/data.bin"
echo "snapshot-2-restore=ok"

echo "NOSTRBORG_INCREMENTAL_SYNC_PROOF_PASS"
