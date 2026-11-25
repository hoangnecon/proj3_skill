#!/usr/bin/env python3
"""Validate the story-video-skills v6.0.0 repository (see CONVENTIONS.md).

Checks:
  0. layout: known top-level folders & files only; strict per-folder extension rules
  1. 3-track skills (`sv-core-*`, `sv-short-*`, `sv-long-*`): frontmatter name == dir,
     description 150-1024 chars without < >, <= 500 lines, every references/ file cited
  2. every lint ID written in docs (XX-NN) exists in lint.mjs, script_lint.py, or sv_log_lint.py
  3. every `scripts/<file>` named in docs exists in engine/scripts/, every `tools/<file>` in tools/
  4. required suite files exist (engine, split standards, hooks, roles, schemas, starter, examples, tools)
  5. version parity across plugin.json, .claude-plugin/plugin.json, and newest CHANGELOG.md entry
  6. E18 anti-drift guard: zero stale conflicting speed/budget literals in SKILL.md or rules/AGENTS.md

Usage: python tools/validate_skills.py [repo_root]     exit 1 on any error
"""
from __future__ import annotations

import json
import pathlib
import re
import subprocess
import sys

for _st in (sys.stdout, sys.stderr):
    if hasattr(_st, "reconfigure"):
        _st.reconfigure(encoding="utf-8", errors="replace")

ROOT = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else pathlib.Path(__file__).resolve().parents[1])
SK = ROOT / "skills"
ENG = ROOT / "engine"
errors: list[str] = []
warns: list[str] = []
err = errors.append
warn = warns.append

# ---------------------------------------------------------------- 0. layout
TOP = {
    "skills", "standards", "engine", "starter", "examples", "tools",
    "docs", ".claude-plugin", "rules", "hooks", "roles", "schemas", "tests",
}
TOP_FILES = {"README.md", "CHANGELOG.md", "CONVENTIONS.md", ".gitignore", "plugin.json", "hooks.json"}
KINDS = {
    "skills": {".md"},
    "standards": {".json"},
    "engine": {".py", ".mjs", ".ts", ".tsx", ".json"},
    "starter": {".md", ".json", ".ts", ".tsx", ".gitignore"},
    "examples": {".json", ".ts", ".tsx", ".txt"},
    "tools": {".py", ".sh", ".ps1"},
    "docs": {".md", ".png", ".jpg"},
    ".claude-plugin": {".json"},
    "rules": {".md"},
    "hooks": {".py", ".sh"},
    "roles": {".md"},
    "schemas": {".json"},
    "tests": {".py"},
}

try:
    tracked = subprocess.run(["git", "ls-files"], cwd=ROOT, capture_output=True, text=True).stdout.split("\n")
    tracked = [t for t in tracked if t]
except FileNotFoundError:
    tracked = []
    warn("W01 git not available — tracked-file checks skipped")

for t in tracked:
    if not (ROOT / t).exists():
        continue  # deleted locally, not yet committed
    parts = t.split("/")
    if len(parts) == 1:
        if t not in TOP_FILES:
            err(f"E16 stray file at the top level: {t} (see CONVENTIONS.md)")
        continue
    if parts[0] not in TOP:
        err(f"E16 unknown top-level folder: {parts[0]}/ ({t})")
        continue
    suf = pathlib.PurePath(t).suffix or pathlib.PurePath(t).name
    if suf not in KINDS[parts[0]]:
        err(f"E17 {t}: a {suf} file does not belong in {parts[0]}/")
    if parts[0] == "skills" and len(parts) > 2 and parts[2] not in ("SKILL.md", "references"):
        err(f"E17 {t}: a skill folder holds only SKILL.md and references/")
    if parts[0] == "engine" and t.endswith(".json") and parts[1] in ("scripts", "src"):
        err(f"E17 {t}: data in engine/ — standards go to standards/, episode data to starter/")

# Also verify disk top-level entries (catches stray new files before git add)
IGNORE_TOP = {".git", "__pycache__", ".pytest_cache", ".DS_Store"}
for item in sorted(ROOT.iterdir()):
    if item.name in IGNORE_TOP:
        continue
    if item.is_dir() and item.name not in TOP:
        err(f"E16 unknown top-level folder on disk: {item.name}/")
    elif item.is_file() and item.name not in TOP_FILES:
        err(f"E16 stray top-level file on disk: {item.name}")

# ---------------------------------------------------------------- 1. 3-track skills
NAME_RE = re.compile(r"^sv-(core|short|long)-[a-z0-9]+(?:-[a-z0-9]+)*$")
skill_dirs = sorted(p for p in SK.iterdir() if p.is_dir()) if SK.exists() else []
if not skill_dirs:
    err("E01 no skills/ directories")

track_counts = {"core": 0, "short": 0, "long": 0}
docs: dict[pathlib.Path, str] = {}
for d in skill_dirs:
    m_name = NAME_RE.match(d.name)
    if not m_name:
        err(f"E02 {d.name}: directory name must be sv-(core|short|long)-<slug>")
    else:
        track_counts[m_name.group(1)] += 1
    f = d / "SKILL.md"
    if not f.exists():
        err(f"E03 {d.name}: SKILL.md missing")
        continue
    txt = f.read_text(encoding="utf-8")
    m = re.match(r"^---\r?\n(.*?)\r?\n---\r?\n", txt, re.S)
    if not m:
        err(f"E04 {d.name}: no YAML frontmatter")
        continue
    fm = dict(re.findall(r"^(\w+):\s*(.*)$", m.group(1), re.M))
    if fm.get("name") != d.name:
        err(f"E05 {d.name}: frontmatter name '{fm.get('name')}' != directory")
    desc = fm.get("description", "").strip()
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
        docs[rf] = rf.read_text(encoding="utf-8")

for tr_name, cnt in track_counts.items():
    if cnt < 3:
        err(f"E02 track '{tr_name}' has only {cnt} skill(s) (expected >= 3)")

for extra in ("README.md", "CONVENTIONS.md", "rules/AGENTS.md"):
    p = ROOT / extra
    if p.exists():
        docs[p] = p.read_text(encoding="utf-8")
if (ROOT / "roles").is_dir():
    for rf in sorted((ROOT / "roles").glob("*.md")):
        docs[rf] = rf.read_text(encoding="utf-8")

# ---------------------------------------------------------------- 2. lint IDs
impl = ""
for s in ("scripts/lint.mjs", "scripts/script_lint.py", "scripts/sv_log_lint.py", "scripts/art_direction_lint.py"):
    p = ENG / s
    if p.exists():
        impl += p.read_text(encoding="utf-8")
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
    for s in set(re.findall(r"tools/([a-z_]+\.(?:py|sh|ps1))", txt)):
        if not (ROOT / "tools" / s).exists():
            err(f"E12 {f.relative_to(ROOT)}: names tools/{s} which does not exist")

# ---------------------------------------------------------------- 4. required v6.0 parts
REQUIRED = {
    "engine": [
        "package.json", "remotion.config.ts", "tsconfig.json", "src/index.ts", "src/Root.tsx", "src/engine.ts",
        "src/kit.tsx", "src/chars.tsx", "src/side.tsx", "src/overlays.tsx", "src/props.tsx", "src/Film.tsx",
        "src/math.ts", "src/subjects.ts", "src/design/Sheets.tsx", "src/sets/index.ts", "src/sets/types.ts",
    ] + [
        f"scripts/{x}" for x in (
            "art_direction_lint.py", "audio_qa.py", "audiolib.py", "blind_pack.mjs", "deliver.mjs", "design.mjs", "entry.tsx",
            "geom.mjs", "lint.mjs", "load.mjs", "mix.py", "plate_check.py", "qa.mjs", "script_lint.py",
            "sv_cli.py", "sv_doctor.py", "sv_gate.py", "sv_log.py", "sv_log_lint.py", "theme.py",
            "tile.py", "times.mjs", "voice.py",
        )
    ],
    "standards": [
        "core/voice_standard.json", "core/mix_targets.json",
        "short/pacing.json", "short/script_dna_db.json",
        "long/pacing.json",
    ],
    "hooks": ["sv_guard.py"],
    "roles": ["orchestrator.md", "executor.md", "reviewer.md"],
    "schemas": [
        "cli_envelope.schema.json", "role_log.schema.json", "review_record.schema.json",
        "art_direction.schema.json", "g4_scores.schema.json",
    ],
    "starter": [
        "README.md", ".gitignore", "brief.md", "beats.md", "script.json", "audio.json", "art_direction.json",
        "src/episode/cast.ts", "src/episode/geo.ts", "src/episode/sets.tsx", "src/episode/shotlist.ts",
        "src/data/words.json", "src/data/cues.json", "src/data/events.json",
    ] + [f"gates/G{i}.review.md" for i in range(1, 8)],
    "examples/thang-may": ["geo.ts", "looks.ts", "sets.tsx", "shotlist.ts.txt"],
    "examples/demo": ["script.json", "audio.json", "src/episode/shotlist.ts", "src/data/words.json", "src/data/cues.json"],
    "tools": ["new_episode.py", "new_episode.sh", "new_episode.ps1", "validate_skills.py", "benchmark_suite.py"],
}
for part, files in REQUIRED.items():
    for r in files:
        if not (ROOT / part / r).exists():
            err(f"E13 {part}/{r} missing")

# Validate JSON integrity of hooks.json, schemas/*.json, standards/**/*.json
for jp in [
    ROOT / "hooks.json",
    *(sorted((ROOT / "schemas").glob("*.json")) if (ROOT / "schemas").is_dir() else []),
    *(sorted((ROOT / "standards").rglob("*.json")) if (ROOT / "standards").is_dir() else []),
]:
    if not jp.exists():
        err(f"E13 {jp.relative_to(ROOT)} missing")
        continue
    try:
        json.loads(jp.read_text(encoding="utf-8"))
    except Exception as exc:
        err(f"E13 {jp.relative_to(ROOT)} invalid JSON: {exc}")

for t in tracked:
    if not (ROOT / t).exists():
        continue
    if re.search(r"(^|/)(audio|public|qa|out|logs|node_modules)/", t) or t.endswith("gates/log.jsonl"):
        err(f"E14 generated file tracked by git: {t}")

# ---------------------------------------------------------------- 5. version parity
pj_root = ROOT / "plugin.json"
pj_claude = ROOT / ".claude-plugin" / "plugin.json"
cl = ROOT / "CHANGELOG.md"
if pj_root.exists() and pj_claude.exists() and cl.exists():
    v_root = json.loads(pj_root.read_text(encoding="utf-8")).get("version")
    v_claude = json.loads(pj_claude.read_text(encoding="utf-8")).get("version")
    m = re.search(r"^## `v([\d.]+)`", cl.read_text(encoding="utf-8"), re.M)
    v_cl = m.group(1) if m else None
    if v_root != v_claude:
        err(f"E15 plugin.json version ({v_root}) != .claude-plugin/plugin.json ({v_claude})")
    if v_cl != v_root:
        err(f"E15 plugin.json version ({v_root}) != newest CHANGELOG entry ({v_cl})")
else:
    err("E15 plugin.json, .claude-plugin/plugin.json, or CHANGELOG.md missing")

# ---------------------------------------------------------------- 6. E18 anti-drift guard
STALE_DRIFT_RE = re.compile(r"5\.25\s*ups|pitch[_\s=]*1\.02|620[\s–-]860|4\.70\s*ups", re.I)
for target in [*(d / "SKILL.md" for d in skill_dirs if (d / "SKILL.md").exists()), ROOT / "rules" / "AGENTS.md"]:
    if not target.exists():
        continue
    hit = STALE_DRIFT_RE.search(target.read_text(encoding="utf-8"))
    if hit:
        err(f"E18 {target.relative_to(ROOT)}: contains stale/conflicting standard literal '{hit.group(0)}' — cite standards/*.json instead")

for w in warns:
    print("WARN ", w)
for e in errors:
    print("ERROR", e)
print(f"validate_skills: {len(skill_dirs)} skills, {len(have)} lint rules implemented, {len(errors)} errors, {len(warns)} warnings")
sys.exit(1 if errors else 0)
