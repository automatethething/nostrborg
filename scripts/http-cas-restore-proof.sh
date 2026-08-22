#!/usr/bin/env bash
set -euo pipefail

if [ "${1:-}" ]; then
  WORKDIR="$1"
else
  WORKDIR="$(mktemp -d "${TMPDIR:-/tmp}/nostrborg-http-cas-spike.XXXXXX")"
fi
PASSPHRASE="nostrborg-synthetic-test-passphrase"
MANIFEST_KEY="nostrborg-synthetic-manifest-key"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PIDS=""

cleanup() {
  for pid in $PIDS; do
    kill "$pid" 2>/dev/null || true
  done
}
trap cleanup EXIT

require() {
  command -v "$1" >/dev/null || { echo "missing dependency: $1" >&2; exit 2; }
}

require borg
require curl
require openssl
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
printf 'nostrborg synthetic HTTP CAS restore proof\n' > "$WORKDIR/source/notes.txt"
python3 - <<'PY' "$WORKDIR/source/nested/data.bin"
from pathlib import Path
import sys
Path(sys.argv[1]).write_bytes(b'http-cas-proof\0' * 300)
PY

export BORG_PASSPHRASE="$PASSPHRASE"
export BORG_UNKNOWN_UNENCRYPTED_REPO_ACCESS_IS_OK=yes
export BORG_RELOCATED_REPO_ACCESS_IS_OK=yes

PRIMARY="$WORKDIR/primary-repo"
STORE_A="$WORKDIR/stores/blossom-a"
STORE_B="$WORKDIR/stores/blossom-b"
PORT_A_FILE="$WORKDIR/store-a.port"
PORT_B_FILE="$WORKDIR/store-b.port"
MANIFEST="$WORKDIR/manifest.tsv"
MANIFEST_ENC="$WORKDIR/manifest.enc"
MANIFEST_HMAC="$WORKDIR/manifest.hmac"
MANIFEST_DEC="$WORKDIR/manifest.dec.tsv"
REASSEMBLED="$WORKDIR/reassembled-repo"

python3 "$SCRIPT_DIR/http_blob_store.py" --root "$STORE_A" --port-file "$PORT_A_FILE" &
PIDS="$PIDS $!"
python3 "$SCRIPT_DIR/http_blob_store.py" --root "$STORE_B" --port-file "$PORT_B_FILE" &
PIDS="$PIDS $!"
for _ in $(seq 1 50); do
  [ -s "$PORT_A_FILE" ] && [ -s "$PORT_B_FILE" ] && break
  sleep 0.1
done
PORT_A="$(cat "$PORT_A_FILE")"
PORT_B="$(cat "$PORT_B_FILE")"
URL_A="http://127.0.0.1:$PORT_A"
URL_B="http://127.0.0.1:$PORT_B"

borg init --encryption=repokey "$PRIMARY" >/dev/null
borg create --stats "$PRIMARY::snapshot-1" "$WORKDIR/source" >/dev/null
borg check --verify-data "$PRIMARY" >/dev/null

: > "$MANIFEST"
while IFS= read -r -d '' file; do
  rel="${file#"$PRIMARY/"}"
  digest="$(shasum -a 256 "$file" | awk '{print $1}')"
  curl -fsS -X PUT --data-binary "@$file" "$URL_A/blobs/$digest" >/dev/null
  curl -fsS -X PUT --data-binary "@$file" "$URL_B/blobs/$digest" >/dev/null
  printf '%s\t%s\n' "$digest" "$rel" >> "$MANIFEST"
done < <(find "$PRIMARY" -type f -print0 | sort -z)

count="$(wc -l < "$MANIFEST" | tr -d ' ')"
echo "http-cas-uploaded-files=$count"

openssl enc -aes-256-cbc -pbkdf2 -salt -pass "pass:$MANIFEST_KEY" -in "$MANIFEST" -out "$MANIFEST_ENC"
openssl dgst -sha256 -hmac "$MANIFEST_KEY" -binary "$MANIFEST_ENC" > "$MANIFEST_HMAC"
openssl dgst -sha256 -hmac "$MANIFEST_KEY" -binary "$MANIFEST_ENC" > "$WORKDIR/manifest.verify.hmac"
cmp "$MANIFEST_HMAC" "$WORKDIR/manifest.verify.hmac" >/dev/null
echo "manifest-hmac-verified=ok"
openssl enc -d -aes-256-cbc -pbkdf2 -pass "pass:$MANIFEST_KEY" -in "$MANIFEST_ENC" -out "$MANIFEST_DEC"
cmp "$MANIFEST" "$MANIFEST_DEC" >/dev/null
echo "manifest-decrypted=ok"

rm -rf "$STORE_A"
if [ ! -d "$STORE_A" ] && [ -d "$STORE_B" ]; then
  echo "lost-http-cas-store-removed=ok"
else
  echo "lost-http-cas-store-removed=fail" >&2
  exit 1
fi

while IFS=$'\t' read -r digest rel; do
  case "$rel" in
    /*|*../*|../*) echo "unsafe manifest path: $rel" >&2; exit 2 ;;
  esac
  mkdir -p "$REASSEMBLED/$(dirname "$rel")"
  curl -fsS "$URL_B/blobs/$digest" -o "$REASSEMBLED/$rel"
  test "$(shasum -a 256 "$REASSEMBLED/$rel" | awk '{print $1}')" = "$digest"
done < "$MANIFEST_DEC"

borg check --verify-data "$REASSEMBLED" >/dev/null
echo "http-reassembled-repo-borg-check=ok"

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

echo "NOSTRBORG_HTTP_CAS_RESTORE_PROOF_PASS"
