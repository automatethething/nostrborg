#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

./tests/test_restore_spike.sh
./tests/test_cas_restore_spike.sh
./tests/test_http_cas_restore_spike.sh
./tests/test_incremental_sync_spike.sh
./tests/test_prune_compact_spike.sh
python3 -m unittest tests/test_local_relay_manifest_spike.py -q

printf '%s\n' 'NOSTRBORG_LOCAL_REHEARSAL_PASS'
