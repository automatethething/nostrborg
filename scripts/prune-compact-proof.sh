#!/usr/bin/env bash
set -euo pipefail

if [ "${1:-}" ]; then
  WORKDIR="$1"
else
  WORKDIR="$(mktemp -d "${TMPDIR:-/tmp}/nostrborg-prune-spike.XXXXXX")"
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
mkdir -p "$WORKDIR"/{source,cas,reassembled-before-prune,reassembled-after-compact,restored-before-prune,restored-after-compact,expected-snapshot-2/source}

export BORG_PASSPHRASE="$PASSPHRASE"
export BORG_UNKNOWN_UNENCRYPTED_REPO_ACCESS_IS_OK=yes
export BORG_RELOCATED_REPO_ACCESS_IS_OK=yes

PRIMARY="$WORKDIR/primary-repo"
CAS="$WORKDIR/cas"
MANIFEST_BEFORE="$WORKDIR/manifest-before-prune.tsv"
MANIFEST_AFTER="$WORKDIR/manifest-after-compact.tsv"

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

mkdir -p "$WORKDIR/source"
printf 'old version\n' > "$WORKDIR/source/notes.txt"
borg init --encryption=repokey "$PRIMARY" >/dev/null
borg create --stats "$PRIMARY::snapshot-1" "$WORKDIR/source" >/dev/null
printf 'kept version\n' > "$WORKDIR/source/notes.txt"
printf 'kept file\n' > "$WORKDIR/source/kept.txt"
cp -R "$WORKDIR/source/." "$WORKDIR/expected-snapshot-2/source/"
borg create --stats "$PRIMARY::snapshot-2" "$WORKDIR/source" >/dev/null
borg check --verify-data "$PRIMARY" >/dev/null
sync_repo_to_cas "$PRIMARY" "$MANIFEST_BEFORE" >/dev/null

reassemble_from_manifest "$MANIFEST_BEFORE" "$WORKDIR/reassembled-before-prune"
borg_isolated "$WORKDIR/borg-base-check-before" check --verify-data "$WORKDIR/reassembled-before-prune" >/dev/null
extract_archive_flat "$WORKDIR/reassembled-before-prune" snapshot-1 "$WORKDIR/restored-before-prune"
grep -q 'old version' "$WORKDIR/restored-before-prune/source/notes.txt"
echo "snapshot-1-before-prune-restore=ok"

borg delete "$PRIMARY::snapshot-1" >/dev/null
borg compact "$PRIMARY" >/dev/null
borg check --verify-data "$PRIMARY" >/dev/null
sync_repo_to_cas "$PRIMARY" "$MANIFEST_AFTER" >/dev/null

before_digests="$WORKDIR/before-digests.txt"
after_digests="$WORKDIR/after-digests.txt"
cut -f1 "$MANIFEST_BEFORE" | sort -u > "$before_digests"
cut -f1 "$MANIFEST_AFTER" | sort -u > "$after_digests"
orphans="$(comm -23 "$before_digests" "$after_digests" | wc -l | tr -d ' ')"
echo "orphaned-cas-blobs=$orphans"

reassemble_from_manifest "$MANIFEST_AFTER" "$WORKDIR/reassembled-after-compact"
borg_isolated "$WORKDIR/borg-base-check-after" check --verify-data "$WORKDIR/reassembled-after-compact" >/dev/null
if borg_isolated "$WORKDIR/borg-base-list-pruned" list "$WORKDIR/reassembled-after-compact::snapshot-1" >/dev/null 2>&1; then
  echo "snapshot-1-after-prune-missing=fail" >&2
  exit 1
fi
echo "snapshot-1-after-prune-missing=ok"
extract_archive_flat "$WORKDIR/reassembled-after-compact" snapshot-2 "$WORKDIR/restored-after-compact"
diff -r "$WORKDIR/expected-snapshot-2/source" "$WORKDIR/restored-after-compact/source" >/dev/null
echo "snapshot-2-after-compact-restore=ok"

if [ "$orphans" -le 0 ]; then
  echo "expected compact/prune to orphan at least one old CAS blob" >&2
  exit 1
fi

echo "NOSTRBORG_PRUNE_COMPACT_PROOF_PASS"
