#!/usr/bin/env bash
# Assemble a new episode project from the suite (layout: README.md "Repository layout").
#   bash tools/new_episode.sh <dest-dir> [--demo] [--node-modules <dir>]
#
#   engine/      -> <ep>/scripts/, <ep>/src/ (engine code), package.json, tsconfig.json, remotion.config.ts
#   standards/   -> <ep>/standards/            house standards, read-only in an episode
#   examples/thang-may/ -> <ep>/src/exemplar/  reference episode: the bar, never used in episode shots
#   starter/     -> <ep>/                      blank episode files the agent fills in
#   --demo: examples/demo/ on top             a 4-shot demo to render and study (lint fails until replaced)
#   --node-modules <dir>: symlink an existing Remotion 4.0.250 install (saves ~1 GB) instead of npm install
set -euo pipefail
SUITE="$(cd "$(dirname "$0")/.." && pwd)"
DEST="" DEMO=0 NM=""
while [ $# -gt 0 ]; do
  case "$1" in
    --demo) DEMO=1 ;;
    --node-modules) NM="${2:?--node-modules needs a directory}"; shift ;;
    -*) echo "unknown option $1"; exit 2 ;;
    *) if [ -z "$DEST" ]; then DEST="$1"; elif [ -z "$NM" ]; then NM="$1"; else echo "too many arguments"; exit 2; fi ;;
  esac
  shift
done
[ -n "$DEST" ] || { echo "usage: new_episode.sh <dest-dir> [--demo] [--node-modules <dir>]"; exit 2; }
[ -e "$DEST" ] && { echo "refusing: $DEST already exists"; exit 1; }

mkdir -p "$DEST"
rsync -a --exclude node_modules "$SUITE/engine/" "$DEST/"
rsync -a "$SUITE/standards/" "$DEST/standards/"
mkdir -p "$DEST/src/exemplar"
cp "$SUITE/examples/thang-may/geo.ts" "$SUITE/examples/thang-may/looks.ts" "$SUITE/examples/thang-may/sets.tsx" "$DEST/src/exemplar/"
cp "$SUITE/examples/thang-may/shotlist.ts.txt" "$DEST/src/exemplar/shotlist.thang-may.ts.txt"
rsync -a "$SUITE/starter/" "$DEST/"
if [ "$DEMO" = 1 ]; then
  rsync -a "$SUITE/examples/demo/" "$DEST/"
fi
mkdir -p "$DEST"/{audio,public,qa,out}
echo "{\"suite_version\": \"$(python3 -c "import json;print(json.load(open('$SUITE/.claude-plugin/plugin.json'))['version'])")\", \"demo\": $([ $DEMO = 1 ] && echo true || echo false)}" > "$DEST/.suite.json"

if [ -n "$NM" ]; then
  ln -s "$(cd "$NM" && pwd)" "$DEST/node_modules"
else
  (cd "$DEST" && npm install --no-audit --no-fund)
fi
cd "$DEST"
node scripts/times.mjs
"$(dirname "$0")/doctor.sh" "$DEST" || echo "WARNING: fix the doctor MISS lines before starting the helpers"
echo
echo "episode project ready: $DEST$([ $DEMO = 1 ] && echo '  (with the demo)')"
echo "next: read skills/sv-00-pipeline; see the bar: node scripts/design.mjs --exemplar"
