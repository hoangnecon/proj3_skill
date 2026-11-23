#!/usr/bin/env python3
"""Cross-platform episode project assembler (Windows PowerShell, macOS, Linux — no bash/rsync needed).

Usage:
  python tools/new_episode.py <dest-dir> [--demo] [--in-place] [--node-modules <dir>]

Options:
  --demo               Overlay the 4-shot engine demo (sandbox only; lint fails until replaced)
  --in-place           Allow assembling into an existing folder that already holds source notes/.md files,
                       preserving any existing files instead of overwriting them
  --node-modules <dir> Link an existing Remotion node_modules (uses NTFS Junction on Windows — no Admin needed)
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
        # NTFS directory junction works on Windows without Administrator / Developer Mode privileges.
        r = subprocess.run(["cmd", "/c", "mklink", "/J", str(dst_nm), str(src_nm)], capture_output=True, text=True)
        if r.returncode != 0:
            raise SystemExit(f"failed to create junction {dst_nm} -> {src_nm}: {r.stderr or r.stdout}")
    else:
        os.symlink(src_nm, dst_nm, target_is_directory=True)


def main() -> None:
    ap = argparse.ArgumentParser(description="Assemble a new story-video episode project (Windows/macOS/Linux).")
    ap.add_argument("dest", help="Destination directory for the episode")
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
    copy_tree(SUITE / "standards", dest / "standards", overwrite=True)

    ex_dst = dest / "src" / "exemplar"
    ex_dst.mkdir(parents=True, exist_ok=True)
    for fn in ("geo.ts", "looks.ts", "sets.tsx"):
        shutil.copy2(SUITE / "examples" / "thang-may" / fn, ex_dst / fn)
    shutil.copy2(SUITE / "examples" / "thang-may" / "shotlist.ts.txt", ex_dst / "shotlist.thang-may.ts.txt")

    copy_tree(SUITE / "starter", dest, overwrite=not args.in_place)
    if args.demo:
        copy_tree(SUITE / "examples" / "demo", dest, overwrite=True)

    for folder in ("audio", "public", "qa", "out"):
        (dest / folder).mkdir(parents=True, exist_ok=True)

    pj = SUITE / ".claude-plugin" / "plugin.json"
    version = json.loads(pj.read_text(encoding="utf-8"))["version"]
    (dest / ".suite.json").write_text(
        json.dumps({"suite_version": version, "demo": bool(args.demo)}, indent=2) + "\n",
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
    print(f"episode project ready: {dest}{'  (with the demo)' if args.demo else ''}")
    print("next: read skills/sv-00-pipeline; see the bar: node scripts/design.mjs --exemplar")


if __name__ == "__main__":
    main()
