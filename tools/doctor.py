#!/usr/bin/env python3
"""Environment doctor for story-video-skills on Windows, macOS and Linux.

Checks:
  1. System Python (>= 3.10) + Pillow + numpy (used by design.mjs / qa.mjs / carry.py / tile.py / crops.py / plate_check.py)
  2. Node.js (>= 18) + optional episode node_modules/remotion check
  3. FFmpeg + FFprobe (PATH or auto-discovered Windows/macOS toolchain)
  4. VieNeu-TTS Python environment + CUDA GPU + soundfile/scipy + faster-whisper + sea_g2p (Windows Smart App Control check)
  5. Temp/workspace free disk space (>= 8 GB for Remotion renders)

Usage:
  python tools/doctor.py [episode_dir]    # run all checks, exit 1 on blocking issues
  python tools/doctor.py --fix-sea-g2p    # upgrade sea-g2p >= 0.10.0 from official PyPI into VieNeu site-packages
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


def find_ffmpeg_dir() -> str | None:
    bin_name = "ffmpeg.exe" if os.name == "nt" else "ffmpeg"
    env_dir = os.environ.get("SV_FFMPEG_DIR")
    if env_dir and (Path(env_dir) / bin_name).exists():
        return str(Path(env_dir).resolve())
    w = shutil.which("ffmpeg")
    if w:
        return str(Path(w).resolve().parent)
    if os.name == "nt":
        home = Path.home()
        local_app = Path(os.environ.get("LOCALAPPDATA", home / "AppData/Local"))
        for d in (
            home / ".local/bin",
            Path("C:/Work/Tools/ffmpeg/bin"),
            Path("D:/mmo/tools/heo-video-runtime/bin"),
            Path("C:/ffmpeg/bin"),
            Path("C:/Tools/ffmpeg/bin"),
            local_app / "Microsoft/WinGet/Links",
            home / "scoop/shims",
            Path("C:/ProgramData/chocolatey/bin"),
        ):
            if (d / bin_name).exists():
                return str(d.resolve())
    return None


def find_vieneu_python() -> Path | None:
    env_py = os.environ.get("SV_PY")
    if env_py and Path(env_py).exists():
        return Path(env_py).resolve()
    home = Path.home()
    candidates = (
        [
            Path("C:/Work/Tools/VieNeu-TTS/.venv/Scripts/python.exe"),
            Path("D:/mmo/tools/VieNeu-TTS/.venv/Scripts/python.exe"),
            Path("C:/Tools/VieNeu-TTS/.venv/Scripts/python.exe"),
            home / "Tools/VieNeu-TTS/.venv/Scripts/python.exe",
            home / "VieNeu-TTS/.venv/Scripts/python.exe",
        ]
        if os.name == "nt"
        else [
            Path("/Users/Shared/Tools/VieNeu-TTS/.venv/bin/python"),
            home / "Tools/VieNeu-TTS/.venv/bin/python",
            home / "VieNeu-TTS/.venv/bin/python",
        ]
    )
    for c in candidates:
        if c.exists():
            return c.resolve()
    return None


def fix_sea_g2p(vieneu_py: Path) -> None:
    site_pkgs = vieneu_py.parent.parent / "Lib" / "site-packages" if os.name == "nt" else None
    if site_pkgs is None or not site_pkgs.exists():
        r = subprocess.run(
            [str(vieneu_py), "-c", "import site; print(site.getsitepackages()[0])"],
            capture_output=True, text=True, encoding="utf-8", check=True,
        )
        site_pkgs = Path(r.stdout.strip())
    print(f"Upgrading official sea-g2p>=0.10.0 into {site_pkgs} ...")
    # Remove old sea_g2p folder & dist-info cleanly before installing official wheel
    for old in list(site_pkgs.glob("sea_g2p*")):
        if old.is_dir():
            shutil.rmtree(old)
        else:
            old.unlink()
    subprocess.run(
        [sys.executable, "-m", "pip", "install", "--no-deps", "--upgrade", "--target", str(site_pkgs), "sea-g2p>=0.10.0"],
        check=True,
    )
    print("sea-g2p upgrade complete.")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("episode_dir", nargs="?", default=None, help="Optional episode directory to verify node_modules/remotion")
    ap.add_argument("--fix-sea-g2p", action="store_true", help="Upgrade sea-g2p>=0.10.0 from PyPI into VieNeu venv")
    args = ap.parse_args()

    issues: list[str] = []
    report: dict[str, object] = {"platform": sys.platform, "python_sys": sys.executable}

    # 1. System Python + Pillow + numpy (required by tile.py, design.mjs, carry.py, plate_check.py)
    try:
        import PIL  # noqa: F401
        report["pillow"] = "ok"
    except ImportError:
        issues.append(f"Pillow missing in system Python ({sys.executable}) — run: python -m pip install Pillow")
        report["pillow"] = "missing"
    try:
        import numpy  # noqa: F401
        report["numpy"] = "ok"
    except ImportError:
        issues.append(f"numpy missing in system Python ({sys.executable}) — run: python -m pip install numpy")
        report["numpy"] = "missing"

    # 2. Node.js (+ optional episode node_modules)
    node_bin = shutil.which("node")
    if not node_bin:
        issues.append("Node.js not found on PATH")
    else:
        nv = subprocess.run(["node", "-v"], capture_output=True, text=True).stdout.strip()
        report["node"] = nv
    if args.episode_dir:
        ep = Path(args.episode_dir)
        if (ep / "package.json").exists():
            if (ep / "node_modules" / "remotion").exists():
                report["episode_node_modules"] = "ok"
            else:
                report["episode_node_modules"] = "missing"
                issues.append(f"episode node_modules missing in {ep} — run: npm install (or re-run new_episode.py)")

    # 3. FFmpeg / FFprobe
    ff_dir = find_ffmpeg_dir()
    if not ff_dir:
        issues.append("ffmpeg/ffprobe not found on PATH or standard Windows/macOS locations (set SV_FFMPEG_DIR)")
    else:
        report["ffmpeg_dir"] = ff_dir

    # 4. VieNeu-TTS Python + CUDA + soundfile/scipy + sea_g2p
    vpy = find_vieneu_python()
    if vpy is None:
        issues.append("VieNeu-TTS virtualenv not found (set SV_PY to your VieNeu python executable)")
    else:
        report["vieneu_python"] = str(vpy)
        if args.fix_sea_g2p:
            fix_sea_g2p(vpy)
        probe_code = (
            "import json\n"
            "out = {}\n"
            "try:\n"
            "    import sea_g2p, importlib.metadata as im\n"
            "    out['sea_g2p'] = im.version('sea-g2p')\n"
            "except Exception as e:\n"
            "    out['sea_g2p_error'] = str(e)\n"
            "try:\n"
            "    import torch, vieneu, faster_whisper, soundfile, scipy, numpy\n"
            "    out['vieneu'] = True\n"
            "    out['dsp_stack'] = True\n"
            "    out['cuda'] = bool(torch.cuda.is_available())\n"
            "    out['gpu'] = torch.cuda.get_device_name(0) if torch.cuda.is_available() else None\n"
            "except Exception as e:\n"
            "    out['vieneu_error'] = str(e)\n"
            "print(json.dumps(out))\n"
        )
        r = subprocess.run([str(vpy), "-c", probe_code], capture_output=True, text=True, encoding="utf-8", errors="replace")
        if r.returncode != 0:
            issues.append(f"VieNeu Python check failed: {r.stderr.strip()}")
        else:
            info = json.loads(r.stdout.strip().splitlines()[-1])
            report["tts_stack"] = info
            if "sea_g2p_error" in info:
                issues.append(
                    f"sea_g2p failed to load ({info['sea_g2p_error']}). "
                    "On Windows Smart App Control, run: python tools/doctor.py --fix-sea-g2p"
                )
            elif "vieneu_error" in info:
                issues.append(f"vieneu/whisper/dsp failed to load: {info['vieneu_error']}")

    # 5. Free disk space (>= 8 GB in temp dir for Remotion renders, matching doctor.sh)
    import tempfile
    tmp_free_gb = shutil.disk_usage(tempfile.gettempdir()).free / (1024 ** 3)
    report["temp_free_gb"] = round(tmp_free_gb, 1)
    if tmp_free_gb < 8.0:
        issues.append(f"only {tmp_free_gb:.1f} GB free in temp volume ({tempfile.gettempdir()}) — renders need >= 8 GB")

    print(json.dumps(report, indent=2, ensure_ascii=False))
    if issues:
        print("\nDOCTOR FOUND ISSUES:")
        for x in issues:
            print("  -", x)
        sys.exit(1)
    print("\ndoctor: ALL CHECKS GREEN (Windows/cross-platform ready)")


if __name__ == "__main__":
    main()
