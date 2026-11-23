#!/usr/bin/env python3
"""Validate the story-video-skills repository (see CONVENTIONS.md).

Checks
  0. layout: only the known top-level folders, and each holds only its own kind of file
     (skills: .md; standards: .json; engine: code + project config; ...)
  1. every skills/sv-*/SKILL.md: frontmatter name == directory, description 150-1024 chars without < >,
     <= 500 lines, every references/ file mentioned in its SKILL.md
  2. every lint ID written in the docs (XX-NN) exists in engine/scripts/lint.mjs or script_lint.py —
     docs never promise a check that does not exist
  3. every `scripts/<file>` named in the docs exists in engine/scripts/, every `tools/<file>` in tools/
  4. engine/standards/starter/examples have their required files; no generated output tracked by git
  5. plugin.json version matches the newest CHANGELOG entry

Usage: python3 tools/validate_skills.py [repo_root]     exit 1 on any error
"""
from __future__ import annotations

import json
import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else pathlib.Path(__file__).resolve().parents[1])
SK = ROOT / "skills"
ENG = ROOT / "engine"
errors: list[str] = []
warns: list[str] = []
err = errors.append
warn = warns.append

# ---------------------------------------------------------------- 0. layout
TOP = {"skills", "standards", "engine", "starter", "examples", "tools", "docs", ".claude-plugin"}
TOP_FILES = {"README.md", "CHANGELOG.md", "CONVENTIONS.md", ".gitignore", "plugin.json"}
KINDS = {  # folder -> allowed file suffixes (relative path regex for exceptions)
    "skills": {".md"},
    "standards": {".json"},
    "engine": {".py", ".mjs", ".ts", ".tsx", ".json"},
    "starter": {".md", ".json", ".ts", ".tsx", ".gitignore"},
    "examples": {".json", ".ts", ".tsx", ".txt"},
    "tools": {".py", ".sh", ".ps1"},
    "docs": {".md", ".png", ".jpg"},
    ".claude-plugin": {".json"},
}
try:
    tracked = subprocess.run(["git", "ls-files"], cwd=ROOT, capture_output=True, text=True).stdout.split("\n")
    tracked = [t for t in tracked if t]
except FileNotFoundError:
    tracked = []
    warn("W01 git not available — layout and tracked-file checks skipped")
for t in tracked:
    parts = t.split("/")
    if len(parts) == 1:
        if t not in TOP_FILES:
            err(f"E16 stray file at the top level: {t} (see CONVENTIONS.md, Repository layout)")
        continue
    if parts[0] not in TOP:
        err(f"E16 unknown top-level folder: {parts[0]}/ ({t})")
        continue
    suf = pathlib.PurePath(t).suffix or pathlib.PurePath(t).name
    if suf not in KINDS[parts[0]]:
        err(f"E17 {t}: a {suf} file does not belong in {parts[0]}/")
    if parts[0] == "skills" and len(parts) > 2 and parts[2] not in ("SKILL.md", "references"):
        err(f"E17 {t}: a skill folder holds only SKILL.md and references/ (code goes to engine/ or tools/)")
    if parts[0] == "engine" and t.endswith(".json") and parts[1] in ("scripts", "src"):
        err(f"E17 {t}: data in engine/ — standards go to standards/, episode data to starter/")

# ---------------------------------------------------------------- 1. skills
NAME_RE = re.compile(r"^sv-\d\d-[a-z0-9]+(?:-[a-z0-9]+)*$")
skill_dirs = sorted(p for p in SK.iterdir() if p.is_dir()) if SK.exists() else []
if not skill_dirs:
    err("E01 no skills/ directories")
docs: dict[pathlib.Path, str] = {}
for d in skill_dirs:
    if not NAME_RE.match(d.name):
        err(f"E02 {d.name}: directory name must be sv-<TT>-<slug>")
    f = d / "SKILL.md"
    if not f.exists():
        err(f"E03 {d.name}: SKILL.md missing")
        continue
    txt = f.read_text()
    m = re.match(r"^---\n(.*?)\n---\n", txt, re.S)
    if not m:
        err(f"E04 {d.name}: no YAML frontmatter")
        continue
    fm = dict(re.findall(r"^(\w+):\s*(.*)$", m.group(1), re.M))
    if fm.get("name") != d.name:
        err(f"E05 {d.name}: frontmatter name '{fm.get('name')}' != directory")
    desc = fm.get("description", "")
    if not 150 <= len(desc) <= 1024:
        err(f"E06 {d.name}: description is {len(desc)} chars (150-1024)")
    if "<" in desc or ">" in desc:
        err(f"E07 {d.name}: description contains < or >")
    if txt.count("\n") > 500:
        err(f"E08 {d.name}: SKILL.md has {txt.count(chr(10))} lines (max 500)")
    for sub in ("references",):
        for rf in sorted((d / sub).glob("*")) if (d / sub).exists() else []:
            if rf.is_file() and rf.name not in txt:
                err(f"E09 {d.name}: {sub}/{rf.name} is not mentioned in SKILL.md")
    docs[f] = txt
    for rf in (d / "references").glob("*.md") if (d / "references").exists() else []:
        docs[rf] = rf.read_text()
for extra in ("README.md", "CONVENTIONS.md"):
    if (ROOT / extra).exists():
        docs[ROOT / extra] = (ROOT / extra).read_text()

# ---------------------------------------------------------------- 2. lint IDs
impl = ""
for s in ("scripts/lint.mjs", "scripts/script_lint.py"):
    p = ENG / s
    if p.exists():
        impl += p.read_text()
    else:
        err(f"E10 engine/{s} missing")
have = set(re.findall(r"['\"]([A-Z]{2}-\d\d)['\"]", impl))
for f, txt in docs.items():
    for a, lo, hi in re.findall(r"\b([A-Z]{2})-(\d\d)(?:\.\.(\d\d))?\b", txt):
        ids = [f"{a}-{n:02d}" for n in range(int(lo), int(hi) + 1)] if hi else [f"{a}-{lo}"]
        for i in ids:
            if i not in have and a in {x[:2] for x in have}:
                err(f"E11 {f.relative_to(ROOT)}: rule {i} is documented but not implemented")

# ---------------------------------------------------------------- 3. scripts named in docs
for f, txt in docs.items():
    for s in set(re.findall(r"(?<![\w/])scripts/([a-z_]+\.(?:py|mjs|sh))", txt)):
        if not (ENG / "scripts" / s).exists():
            err(f"E12 {f.relative_to(ROOT)}: names scripts/{s} which does not exist in engine/scripts/")
    for s in set(re.findall(r"tools/([a-z_]+\.(?:py|sh))", txt)):
        if not (ROOT / "tools" / s).exists():
            err(f"E12 {f.relative_to(ROOT)}: names tools/{s} which does not exist")

# ---------------------------------------------------------------- 4. parts of an episode
REQUIRED = {
    "engine": ["package.json", "remotion.config.ts", "tsconfig.json", "src/index.ts", "src/Root.tsx", "src/engine.ts",
               "src/kit.tsx", "src/chars.tsx", "src/side.tsx", "src/overlays.tsx", "src/props.tsx", "src/Film.tsx",
               "src/math.ts", "src/design/Sheets.tsx", "src/sets/index.ts", "src/sets/types.ts"]
              + [f"scripts/{x}" for x in ("audio_qa.py", "audiolib.py", "deliver.mjs", "design.mjs", "entry.tsx", "lint.mjs",
                                          "load.mjs", "mix.py", "plate_check.py", "qa.mjs", "script_lint.py", "sv_gate.py",
                                          "theme.py", "tile.py", "times.mjs", "voice.py")],
    "standards": ["voice_standard.json", "pacing.json", "mix_targets.json"],
    "starter": ["README.md", ".gitignore", "brief.md", "beats.md", "script.json", "audio.json", "src/episode/cast.ts",
                "src/episode/geo.ts", "src/episode/sets.tsx", "src/episode/shotlist.ts", "src/data/words.json",
                "src/data/cues.json", "src/data/events.json"] + [f"gates/G{i}.review.md" for i in range(1, 8)],
    "examples/thang-may": ["geo.ts", "looks.ts", "sets.tsx", "shotlist.ts.txt"],
    "examples/demo": ["script.json", "audio.json", "src/episode/shotlist.ts", "src/data/words.json", "src/data/cues.json"],
    "tools": ["new_episode.sh", "validate_skills.py"],
}
for part, files in REQUIRED.items():
    for r in files:
        if not (ROOT / part / r).exists():
            err(f"E13 {part}/{r} missing")
for t in tracked:
    if re.search(r"(^|/)(audio|public|qa|out|node_modules)/", t) or t.endswith("gates/log.jsonl"):
        err(f"E14 generated file tracked by git: {t}")

# ---------------------------------------------------------------- 5. version
pj = ROOT / ".claude-plugin" / "plugin.json"
cl = ROOT / "CHANGELOG.md"
if pj.exists() and cl.exists():
    v = json.loads(pj.read_text()).get("version")
    m = re.search(r"^## `v([\d.]+)`", cl.read_text(), re.M)
    if not m or m.group(1) != v:
        err(f"E15 plugin.json version {v} != newest CHANGELOG entry {m.group(1) if m else None}")

for w in warns:
    print("WARN ", w)
for e in errors:
    print("ERROR", e)
print(f"validate_skills: {len(skill_dirs)} skills, {len(have)} lint rules implemented, {len(errors)} errors, {len(warns)} warnings")
sys.exit(1 if errors else 0)
