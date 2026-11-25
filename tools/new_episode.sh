#!/usr/bin/env bash
# Assemble a new v6.0 episode project from the suite (delegates to cross-platform tools/new_episode.py).
#   bash tools/new_episode.sh <dest-dir> [--track short|long] [--demo] [--in-place] [--node-modules <dir>]
set -euo pipefail
SUITE="$(cd "$(dirname "$0")/.." && pwd)"
exec python3 "$SUITE/tools/new_episode.py" "$@"
