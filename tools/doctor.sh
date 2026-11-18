#!/usr/bin/env bash
# story-video-skills doctor: check the tools an episode needs BEFORE the first helper spends a turn on a missing one.
# Usage: tools/doctor.sh [episode_dir]   (new_episode.sh runs it; exit 1 lists what to fix)
set -u
EP="${1:-.}"; bad=0
ok()   { printf '  ok   %s\n' "$1"; }
miss() { printf '  MISS %s — %s\n' "$1" "$2"; bad=1; }
TTSPY=/Users/Shared/Tools/VieNeu-TTS/.venv/bin/python
command -v node   >/dev/null && ok "node $(node -v)"       || miss node "install Node 20+"
command -v ffmpeg >/dev/null && ok "ffmpeg"                || miss ffmpeg "brew install ffmpeg"
command -v ffprobe >/dev/null && ok "ffprobe"              || miss ffprobe "brew install ffmpeg"
python3 -c "import PIL, numpy" 2>/dev/null && ok "python3 PIL+numpy (tile/contact sheets)" || miss "python3 PIL/numpy" "python3 -m pip install pillow numpy"
if [ -x "$TTSPY" ]; then
  "$TTSPY" -c "import soundfile, scipy, numpy" 2>/dev/null && ok "TTS venv (soundfile, scipy)" || miss "TTS venv packages" "$TTSPY -m pip install soundfile scipy"
else miss "TTS venv" "$TTSPY not found — voice.py / mix.py / audio_qa.py run with it, never with system python3"; fi
if [ -f "$EP/package.json" ]; then
  [ -d "$EP/node_modules/remotion" ] && ok "episode node_modules" || miss "episode node_modules" "cd $EP && npm install"
fi
free=$(df -k /private/var/folders | awk 'NR==2{print int($4/1024/1024)}')
[ "$free" -ge 8 ] && ok "disk ${free} GB free" || miss "disk" "only ${free} GB free in the temp volume — renders need ~8 GB"
[ $bad = 0 ] && echo "doctor: all good" || { echo "doctor: fix the MISS lines first"; exit 1; }
