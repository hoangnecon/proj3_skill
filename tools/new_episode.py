#!/usr/bin/env python3
"""Cross-platform episode project assembler (v6.0.0 · 3-Track Short 9:16 vs Long 16:9).

Usage:
  python tools/new_episode.py <dest-dir> [--track short|long] [--demo] [--in-place] [--node-modules <dir>]

Options:
  --track short|long   Explicit episode track (default: short).
                       short -> 9:16 (1080x1920), standards/core + standards/short
                       long  -> 16:9 (1920x1080), standards/core + standards/long
  --demo               Overlay the 4-shot engine demo (sandbox only; lint fails until replaced)
  --in-place           Allow assembling into an existing folder preserving existing files
  --node-modules <dir> Link an existing Remotion node_modules (NTFS Junction on Windows — no Admin needed)
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

for _st in (sys.stdout, sys.stderr):
    if hasattr(_st, "reconfigure"):
        _st.reconfigure(encoding="utf-8", errors="replace")

SUITE = Path(__file__).resolve().parents[1]


def copy_tree(src: Path, dst: Path, *, overwrite: bool = True, ignore_names: set[str] | None = None) -> None:
    ignore_names = ignore_names or set()
    dst.mkdir(parents=True, exist_ok=True)
    for item in src.iterdir():
        if item.name in ignore_names:
            continue
        target = dst / item.name
        if item.is_dir():
            copy_tree(item, target, overwrite=overwrite, ignore_names=ignore_names)
        else:
            if overwrite or not target.exists():
                shutil.copy2(item, target)


def auto_find_node_modules(dest: Path) -> Path | None:
    env_nm = os.environ.get("SV_NODE_MODULES")
    candidates = [Path(env_nm)] if env_nm else []
    if os.name == "nt":
        candidates += [
            Path("C:/Work/Tools/remotion-runtime/node_modules"),
            Path("D:/mmo/story-series/node_modules"),
            Path("D:/mmo/nhimlalop-runtime/node_modules"),
        ]
    else:
        candidates += [Path.home() / "Work/PROJ3/mua-noi-doi/node_modules"]
    if dest.parent.exists():
        for sib in sorted(dest.parent.iterdir()):
            if sib != dest and sib.is_dir() and (sib / "node_modules/@remotion/renderer").exists():
                candidates.append(sib / "node_modules")
    for c in candidates:
        if c and (c / "@remotion/renderer").exists():
            return c.resolve()
    return None


def link_node_modules(src_nm: Path, dst_nm: Path) -> None:
    src_nm = src_nm.resolve()
    if not src_nm.exists():
        raise SystemExit(f"--node-modules path does not exist: {src_nm}")
    if dst_nm.exists() or dst_nm.is_symlink():
        return
    if os.name == "nt":
        r = subprocess.run(["cmd", "/c", "mklink", "/J", str(dst_nm), str(src_nm)], capture_output=True, text=True)
        if r.returncode != 0:
            raise SystemExit(f"failed to create junction {dst_nm} -> {src_nm}: {r.stderr or r.stdout}")
    else:
        os.symlink(src_nm, dst_nm, target_is_directory=True)


def install_track_standards(dest: Path, track: str) -> None:
    """Copy standards/core/* + standards/<track>/* flat into <dest>/standards/."""
    std_dst = dest / "standards"
    std_dst.mkdir(parents=True, exist_ok=True)
    for sub in ("core", track):
        src_dir = SUITE / "standards" / sub
        if src_dir.is_dir():
            for f in sorted(src_dir.glob("*.json")):
                shutil.copy2(f, std_dst / f.name)
    # Ensure script_dna_db.json is always available for script_lint.py compatibility
    dna_src = SUITE / "standards" / "short" / "script_dna_db.json"
    if dna_src.is_file() and not (std_dst / "script_dna_db.json").exists():
        shutil.copy2(dna_src, std_dst / "script_dna_db.json")


def main() -> None:
    ap = argparse.ArgumentParser(description="Assemble a new v6.0 story-video episode project.")
    ap.add_argument("dest", help="Destination directory for the episode")
    ap.add_argument("--track", choices=("short", "long"), default="short", help="Episode track: short (9:16) or long (16:9)")
    ap.add_argument("--demo", action="store_true", help="Overlay the 4-shot engine demo")
    ap.add_argument("--in-place", action="store_true", help="Assemble into an existing folder without overwriting existing files")
    ap.add_argument("--node-modules", default=None, help="Existing node_modules directory to link/junction")
    args = ap.parse_args()

    dest = Path(args.dest).resolve()
    if dest.exists() and not args.in_place:
        if any(dest.iterdir()):
            raise SystemExit(f"refusing: {dest} already exists and is non-empty (pass --in-place to preserve existing files)")

    dest.mkdir(parents=True, exist_ok=True)
    copy_tree(SUITE / "engine", dest, overwrite=True, ignore_names={"node_modules", "__pycache__"})
    install_track_standards(dest, args.track)

    ex_dst = dest / "src" / "exemplar"
    ex_dst.mkdir(parents=True, exist_ok=True)
    for fn in ("geo.ts", "looks.ts", "sets.tsx"):
        shutil.copy2(SUITE / "examples" / "thang-may" / fn, ex_dst / fn)
    shutil.copy2(SUITE / "examples" / "thang-may" / "shotlist.ts.txt", ex_dst / "shotlist.thang-may.ts.txt")

    script_existed = (dest / "script.json").exists()
    copy_tree(SUITE / "starter", dest, overwrite=not args.in_place)
    if args.demo:
        copy_tree(SUITE / "examples" / "demo", dest, overwrite=True)

    # Pre-configure freshly scaffolded script.json to match selected track
    sc_path = dest / "script.json"
    if sc_path.is_file() and (not args.in_place or not script_existed) and not args.demo:
        try:
            sc_data = json.loads(sc_path.read_text(encoding="utf-8"))
            if isinstance(sc_data, dict):
                sc_data["format"] = "16:9" if args.track == "long" else "9:16"
                if args.track == "long":
                    sc_data["length"] = "long_16x9"
                sc_data["pause_after"] = 0.22
                sc_path.write_text(json.dumps(sc_data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        except Exception:
            pass

    for folder in ("audio", "public", "qa", "out", "logs"):
        (dest / folder).mkdir(parents=True, exist_ok=True)

    pj = SUITE / "plugin.json"
    if not pj.exists():
        pj = SUITE / ".claude-plugin" / "plugin.json"
    version = json.loads(pj.read_text(encoding="utf-8"))["version"]

    ep_meta = {
        "schema_version": "6.0",
        "track": args.track,
        "format": "16:9" if args.track == "long" else "9:16",
        "resolution": [1920, 1080] if args.track == "long" else [1080, 1920],
        "fps": 30,
        "suite_version": version,
        "demo": bool(args.demo),
    }
    (dest / ".episode.json").write_text(json.dumps(ep_meta, indent=2) + "\n", encoding="utf-8")
    (dest / ".suite.json").write_text(
        json.dumps({"suite_version": version, "track": args.track, "demo": bool(args.demo)}, indent=2) + "\n",
        encoding="utf-8",
    )

    nm_src = Path(args.node_modules) if args.node_modules else auto_find_node_modules(dest)
    dst_nm = dest / "node_modules"
    if not dst_nm.exists():
        if nm_src is not None:
            link_node_modules(nm_src, dst_nm)
            print(f"linked node_modules -> {nm_src}")
        else:
            npm_cmd = "npm.cmd" if os.name == "nt" else "npm"
            subprocess.run([npm_cmd, "install", "--no-audit", "--no-fund"], cwd=dest, check=True)

    subprocess.run(["node", "scripts/times.mjs"], cwd=dest, check=True)
    doc = subprocess.run([sys.executable, str(SUITE / "tools" / "doctor.py"), str(dest)])
    if doc.returncode != 0:
        print("WARNING: fix the doctor issues above before starting helpers")
    print()
    print(f"episode project ready: {dest} [track={args.track}, format={ep_meta['format']}]{'  (with the demo)' if args.demo else ''}")
    print("next: read skills/sv-core-router/SKILL.md; run: python scripts/sv_cli.py status")


if __name__ == "__main__":
    main()
