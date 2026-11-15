#!/usr/bin/env bash
# Create a new episode project from templates/episode-starter.
#   bash new_episode.sh <dest-dir> [node_modules-dir]
# node_modules-dir: an existing Remotion 4.0.250 install to symlink (saves ~1 GB); omit to run npm install.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
TPL="$HERE/../../../templates/episode-starter"
DEST="${1:?usage: new_episode.sh <dest-dir> [node_modules-dir]}"
[ -e "$DEST" ] && { echo "refusing: $DEST already exists"; exit 1; }
mkdir -p "$DEST"
rsync -a --exclude node_modules --exclude qa --exclude out --exclude audio --exclude public --exclude 'gates/log.jsonl' "$TPL/" "$DEST/"
mkdir -p "$DEST"/{audio,public,qa,out}
if [ "${2:-}" != "" ]; then
  ln -s "$(cd "$2" && pwd)" "$DEST/node_modules"
else
  (cd "$DEST" && npm install --no-audit --no-fund)
fi
cd "$DEST"
node scripts/times.mjs
echo
echo "episode project ready: $DEST"
echo "next: read sv-00-pipeline, render the demo to see the bar:  node scripts/design.mjs --exemplar && node scripts/qa.mjs contact"
