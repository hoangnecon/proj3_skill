#!/usr/bin/env python3
"""Unified Dual-Format Quality & Speed Benchmark CLI (RSI v4.4.0).

Runs a clean, read-only regression & speed benchmark across the suite and
representative 9:16 Short + 16:9 Long-Form projects inside isolated temporary
sandboxes (source episode directories are never modified):

  1. Suite integrity: tools/validate_skills.py (skills, lint rules, errors, warnings, ms)
  2. Script syntax:   node --check on engine/scripts/*.mjs + py_compile on engine/scripts/*.py
  3. 9:16 Short:      lint.mjs all, qa.mjs layout, voice.py --preflight, sv_doctor.py --stage all
  4. 16:9 Long-Form:  lint.mjs shots, qa.mjs layout, qa.mjs place <set>, sv_doctor.py --stage G5
  5. Optional render: --render-frames N (timed Remotion frame render inside temp sandbox)

Usage:
  python3 tools/benchmark_suite.py [--short <dir>] [--long <dir>] [--render-frames 90] [--overlay|--no-overlay] [--json [out.json]]

Exits 0 if all executed checks pass (0 suite errors, 0 syntax errors, 0 Short errors,
0 Long-Form shot errors); exits 1 otherwise.
"""
from __future__ import annotations

import argparse
import json
import os
import py_compile
import re
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

SUITE_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SHORT = Path("/Users/hoangnguyen142/Work/PROJ3/bench-v39-loop2")
DEFAULT_LONG = Path("/Users/hoangnguyen142/Work/PROJ3-2/v42-showcase-5a")
VENV_PYTHON = Path("/Users/Shared/Tools/VieNeu-TTS/.venv/bin/python")
VENV_BIN = "/Users/Shared/Tools/VieNeu-TTS/.venv/bin"


def resolve_python() -> str:
    env_py = os.environ.get("SV_PYTHON")
    if env_py and Path(env_py).exists():
        return env_py
    if VENV_PYTHON.exists():
        return str(VENV_PYTHON)
    return sys.executable


def make_env() -> dict[str, str]:
    env = os.environ.copy()
    if Path(VENV_BIN).is_dir():
        env["PATH"] = f"{VENV_BIN}:{env.get('PATH', '')}"
    return env


def run_cmd(cmd: list[str], cwd: Path, env: dict[str, str], timeout_s: float = 120.0) -> tuple[int, float, str, str]:
    t0 = time.perf_counter()
    try:
        proc = subprocess.run(
            cmd,
            cwd=cwd,
            env=env,
            capture_output=True,
            text=True,
            timeout=timeout_s,
        )
        dt = time.perf_counter() - t0
        return proc.returncode, dt, proc.stdout or "", proc.stderr or ""
    except subprocess.TimeoutExpired:
        dt = time.perf_counter() - t0
        return 124, dt, "", f"timeout after {timeout_s:.0f}s"
    except FileNotFoundError as exc:
        dt = time.perf_counter() - t0
        return 127, dt, "", str(exc)


def prepare_sandbox(
    src_ep: Path,
    dst_ep: Path,
    suite_dir: Path,
    overlay: bool = True,
    writable_out: bool = False,
) -> None:
    """Create a fast, isolated copy of src_ep without mutating source files.

    Heavy read-only directories (node_modules, audio, public, cached frames/snaps)
    are symlinked; mutable config/code/qa JSON files are copied preserving mtimes.
    """
    dst_ep.mkdir(parents=True, exist_ok=True)
    symlink_top = {"node_modules", "audio", "public"}
    if not writable_out:
        symlink_top.add("out")

    for entry in src_ep.iterdir():
        name = entry.name
        dst = dst_ep / name
        if name in symlink_top:
            os.symlink(Path(os.path.realpath(entry)), dst)
        elif name == "out" and writable_out:
            dst.mkdir(parents=True, exist_ok=True)
        elif name == "qa" and entry.is_dir():
            dst.mkdir(parents=True, exist_ok=True)
            heavy_qa = {"snap", "_f", ".bundle_cache", "cards", "crops", "strips"}
            for qentry in entry.iterdir():
                qdst = dst / qentry.name
                if qentry.name in heavy_qa and qentry.is_dir():
                    os.symlink(Path(os.path.realpath(qentry)), qdst)
                elif qentry.is_dir():
                    shutil.copytree(qentry, qdst, symlinks=True)
                else:
                    shutil.copy2(qentry, qdst)
        elif entry.is_dir():
            shutil.copytree(entry, dst, symlinks=True)
        else:
            shutil.copy2(entry, dst)

    if overlay:
        src_scripts = suite_dir / "engine" / "scripts"
        dst_scripts = dst_ep / "scripts"
        dst_scripts.mkdir(parents=True, exist_ok=True)
        for f in src_scripts.iterdir():
            if f.is_file():
                shutil.copy2(f, dst_scripts / f.name)

        # Ensure legacy v3.x episodes have subjects registry stub expected by v4.2+ entry.tsx
        subj_ep = dst_ep / "src" / "episode" / "subjects.tsx"
        if not subj_ep.exists():
            src_subj_ep = suite_dir / "engine" / "src" / "episode" / "subjects.tsx"
            subj_ep.parent.mkdir(parents=True, exist_ok=True)
            if src_subj_ep.exists():
                shutil.copy2(src_subj_ep, subj_ep)
            else:
                subj_ep.write_text("export const SUBJECTS = {};\n", encoding="utf-8")

        subj_types = dst_ep / "src" / "subjects.ts"
        if not subj_types.exists():
            src_subj_types = suite_dir / "engine" / "src" / "subjects.ts"
            if src_subj_types.exists():
                shutil.copy2(src_subj_types, subj_types)


def check_validate_skills(suite_dir: Path, env: dict[str, str]) -> dict:
    rc, dt, out, err = run_cmd(
        [sys.executable, str(suite_dir / "tools" / "validate_skills.py"), str(suite_dir)],
        suite_dir,
        env,
        timeout_s=30.0,
    )
    combined = (out + "\n" + err).strip()
    m = re.search(
        r"(\d+)\s+skills,\s*(\d+)\s+lint rules implemented,\s*(\d+)\s+errors,\s*(\d+)\s+warnings",
        combined,
    )
    skills = int(m.group(1)) if m else 0
    lint_rules = int(m.group(2)) if m else 0
    errors = int(m.group(3)) if m else (1 if rc != 0 else 0)
    warns = int(m.group(4)) if m else 0
    return {
        "passed": rc == 0 and errors == 0,
        "rc": rc,
        "elapsed_ms": round(dt * 1000, 1),
        "elapsed_s": round(dt, 3),
        "skills": skills,
        "lint_rules": lint_rules,
        "errors": errors,
        "warnings": warns,
        "summary": combined.splitlines()[-1] if combined else "",
        "output": combined if rc != 0 else "",
    }


def check_syntax(suite_dir: Path, env: dict[str, str]) -> dict:
    scripts_dir = suite_dir / "engine" / "scripts"
    mjs_files = sorted(scripts_dir.glob("*.mjs"))
    py_files = sorted(scripts_dir.glob("*.py"))

    t0 = time.perf_counter()
    mjs_failures: list[dict] = []
    for f in mjs_files:
        rc, _, _, err = run_cmd(["node", "--check", str(f)], suite_dir, env, timeout_s=15.0)
        if rc != 0:
            mjs_failures.append({"file": f.name, "error": err.strip()[:240]})
    mjs_dt = time.perf_counter() - t0

    t1 = time.perf_counter()
    py_failures: list[dict] = []
    for f in py_files:
        try:
            py_compile.compile(str(f), doraise=True)
        except py_compile.PyCompileError as exc:
            py_failures.append({"file": f.name, "error": str(exc)[:240]})
    py_dt = time.perf_counter() - t1

    total_errors = len(mjs_failures) + len(py_failures)
    return {
        "passed": total_errors == 0,
        "mjs_checked": len(mjs_files),
        "mjs_failed": mjs_failures,
        "mjs_ms": round(mjs_dt * 1000, 1),
        "py_checked": len(py_files),
        "py_failed": py_failures,
        "py_ms": round(py_dt * 1000, 1),
        "errors": total_errors,
        "elapsed_ms": round((mjs_dt + py_dt) * 1000, 1),
        "elapsed_s": round(mjs_dt + py_dt, 3),
    }


def parse_lint_result(ep: Path, rc: int, dt: float, out: str, err: str) -> dict:
    lint_json = ep / "qa" / "lint.json"
    errors_list: list[str] = []
    warns_list: list[str] = []
    strips = 0
    if lint_json.is_file():
        try:
            data = json.loads(lint_json.read_text(encoding="utf-8"))
            errors_list = data.get("errors") or []
            warns_list = data.get("warns") or []
            strips = int(data.get("strips") or 0)
        except Exception:
            pass
    if rc != 0 and not errors_list:
        msg = (err.strip() or out.strip() or f"exit {rc}").splitlines()[-1]
        errors_list = [msg[:200]]
    return {
        "passed": rc == 0 and len(errors_list) == 0,
        "rc": rc,
        "elapsed_s": round(dt, 3),
        "errors": len(errors_list),
        "warnings": len(warns_list),
        "strips": strips,
        "sample_errors": errors_list[:5],
        "sample_warnings": warns_list[:5],
    }


def parse_layout_result(ep: Path, rc: int, dt: float, out: str, err: str) -> dict:
    m = re.search(
        r"layout:\s*(\d+)\s+shots\s*·\s*overcrowded=(\d+)\s*·\s*scaleErr=(\d+)\s*·\s*cutoffErr=(\d+)",
        out,
    )
    shots = int(m.group(1)) if m else 0
    overcrowded = int(m.group(2)) if m else 0
    scale_err = int(m.group(3)) if m else 0
    cutoff_err = int(m.group(4)) if m else 0

    max_occ = 0.0
    mean_occ = 0.0
    lr_path = ep / "qa" / "layout_report.json"
    if lr_path.is_file():
        try:
            rows = json.loads(lr_path.read_text(encoding="utf-8"))
            occs = [
                float(r["gridLayout"]["occupancyFrac"])
                for r in rows
                if isinstance(r, dict) and isinstance(r.get("gridLayout"), dict)
                and isinstance(r["gridLayout"].get("occupancyFrac"), (int, float))
            ]
            if occs:
                max_occ = round(max(occs) * 100.0, 1)
                mean_occ = round((sum(occs) / len(occs)) * 100.0, 1)
        except Exception:
            pass

    return {
        "passed": rc == 0 and overcrowded == 0 and scale_err == 0 and cutoff_err == 0,
        "rc": rc,
        "elapsed_s": round(dt, 3),
        "shots": shots,
        "overcrowded": overcrowded,
        "scale_err": scale_err,
        "cutoff_err": cutoff_err,
        "mean_occ_pct": mean_occ,
        "max_occ_pct": max_occ,
        "error": (err.strip()[:200] if rc != 0 else ""),
    }


def parse_voice_preflight(rc: int, dt: float, out: str, err: str) -> dict:
    combined = (out + "\n" + err).strip()
    m_err = re.search(r"(\d+)\s+error", combined, re.I)
    m_warn = re.search(r"(\d+)\s+warn", combined, re.I)
    errs = int(m_err.group(1)) if m_err else (1 if rc != 0 else 0)
    warns = int(m_warn.group(1)) if m_warn else 0
    last_line = combined.splitlines()[-1] if combined else ""
    return {
        "passed": rc == 0 and errs == 0,
        "rc": rc,
        "elapsed_s": round(dt, 3),
        "errors": errs,
        "warnings": warns,
        "summary": last_line[:160],
    }


def parse_doctor_result(rc: int, dt: float, out: str, err: str) -> dict:
    data = None
    try:
        data = json.loads(out)
    except Exception:
        # Try extracting JSON block if extra lines exist
        idx = out.find("{")
        if idx != -1:
            try:
                data = json.loads(out[idx:])
            except Exception:
                data = None

    if not isinstance(data, dict):
        return {
            "passed": rc == 0,
            "rc": rc,
            "elapsed_s": round(dt, 3),
            "ready": False,
            "errors": 1 if rc != 0 else 0,
            "warnings": 0,
            "error": (err.strip() or out.strip())[:200],
        }

    stages = data.get("stages") or {}
    blocking = sum(len(st.get("blocking") or []) for st in stages.values() if isinstance(st, dict))
    warns = sum(len(st.get("warnings") or []) for st in stages.values() if isinstance(st, dict))
    stage_summary = {
        k: {
            "status": v.get("status"),
            "errors": len(v.get("blocking") or []),
            "warnings": len(v.get("warnings") or []),
        }
        for k, v in stages.items()
        if isinstance(v, dict)
    }
    return {
        "passed": rc == 0 and bool(data.get("ready")) and blocking == 0,
        "rc": rc,
        "elapsed_s": round(dt, 3),
        "ready": bool(data.get("ready")),
        "within_sla": bool(data.get("within_sla")),
        "sla_budget_min": data.get("sla_budget_min"),
        "est_remaining_min": (data.get("estimated_remaining_min") or {}).get("total"),
        "errors": blocking,
        "warnings": warns,
        "stages": stage_summary,
    }


def detect_place_set_id(ep: Path) -> str | None:
    shots_p = ep / "qa" / "shots.json"
    if shots_p.is_file():
        try:
            rows = json.loads(shots_p.read_text(encoding="utf-8"))
            if isinstance(rows, list):
                for r in rows:
                    sid = r.get("set") if isinstance(r, dict) else None
                    if sid and sid != "solid" and not str(sid).startswith("ex-"):
                        return str(sid)
        except Exception:
            pass

    vs_p = ep / "qa" / "design" / "visual_spec.json"
    if vs_p.is_file():
        try:
            vs = json.loads(vs_p.read_text(encoding="utf-8"))
            sets = vs.get("sets")
            if isinstance(sets, dict):
                for sid, meta in sets.items():
                    if not (isinstance(meta, dict) and meta.get("insert")):
                        return str(sid)
                if sets:
                    return next(iter(sets.keys()))
        except Exception:
            pass

    sets_tsx = ep / "src" / "episode" / "sets.tsx"
    if sets_tsx.is_file():
        m = re.search(r"EPISODE_SETS[^=]*=\s*\{[^}]*?([A-Za-z_][A-Za-z0-9_-]*)\s*:", sets_tsx.read_text(encoding="utf-8", errors="ignore"), re.S)
        if m:
            return m.group(1)
    return None


def run_optional_render(ep: Path, frames: int, env: dict[str, str]) -> dict:
    out_mp4 = ep / "out" / "_bench_render.mp4"
    out_mp4.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        "npx",
        "--no-install",
        "remotion",
        "render",
        "src/index.ts",
        "Film",
        str(out_mp4),
        f"--frames=0-{max(0, frames - 1)}",
        "--log=error",
    ]
    rc, dt, out, err = run_cmd(cmd, ep, env, timeout_s=300.0)
    fps = round(frames / dt, 2) if dt > 0 and rc == 0 else 0.0
    size_kb = round(out_mp4.stat().st_size / 1024.0, 1) if out_mp4.is_file() else 0.0
    return {
        "passed": rc == 0 and out_mp4.is_file() and size_kb > 0,
        "rc": rc,
        "frames": frames,
        "elapsed_s": round(dt, 3),
        "fps": fps,
        "size_kb": size_kb,
        "error": (err.strip() or out.strip())[:200] if rc != 0 else "",
    }


def benchmark_short(
    ep_path: Path,
    suite_dir: Path,
    tmp_root: Path,
    env: dict[str, str],
    py_exe: str,
    overlay: bool,
    render_frames: int,
) -> dict:
    if not ep_path.is_dir():
        return {"status": "SKIP", "path": str(ep_path), "reason": "directory not found", "passed": True}

    t_all = time.perf_counter()
    sandbox = tmp_root / "short_9x16"
    prepare_sandbox(ep_path, sandbox, suite_dir, overlay=overlay, writable_out=(render_frames > 0))

    checks: dict[str, dict] = {}
    rc, dt, out, err = run_cmd(["node", "scripts/lint.mjs", "all"], sandbox, env)
    checks["lint_all"] = parse_lint_result(sandbox, rc, dt, out, err)

    rc, dt, out, err = run_cmd(["node", "scripts/qa.mjs", "layout"], sandbox, env)
    checks["qa_layout"] = parse_layout_result(sandbox, rc, dt, out, err)

    rc, dt, out, err = run_cmd([py_exe, "scripts/voice.py", "--preflight"], sandbox, env)
    checks["voice_preflight"] = parse_voice_preflight(rc, dt, out, err)

    rc, dt, out, err = run_cmd([py_exe, "scripts/sv_doctor.py", "--stage", "all", "--json"], sandbox, env)
    checks["sv_doctor_all"] = parse_doctor_result(rc, dt, out, err)

    if render_frames > 0:
        checks["render_frames"] = run_optional_render(sandbox, render_frames, env)

    total_errors = (
        checks["lint_all"]["errors"]
        + checks["voice_preflight"]["errors"]
        + checks["sv_doctor_all"]["errors"]
        + (0 if checks["qa_layout"]["passed"] else 1)
        + (0 if checks.get("render_frames", {"passed": True})["passed"] else 1)
    )
    total_warns = (
        checks["lint_all"]["warnings"]
        + checks["voice_preflight"]["warnings"]
        + checks["sv_doctor_all"]["warnings"]
    )
    passed = all(c["passed"] for c in checks.values())
    return {
        "status": "PASS" if passed else "FAIL",
        "passed": passed,
        "path": str(ep_path),
        "format": "9:16",
        "elapsed_s": round(time.perf_counter() - t_all, 3),
        "errors": total_errors,
        "warnings": total_warns,
        "checks": checks,
    }


def benchmark_long(
    ep_path: Path,
    suite_dir: Path,
    tmp_root: Path,
    env: dict[str, str],
    py_exe: str,
    overlay: bool,
    render_frames: int,
) -> dict:
    if not ep_path.is_dir():
        return {"status": "SKIP", "path": str(ep_path), "reason": "directory not found", "passed": True}

    t_all = time.perf_counter()
    sandbox = tmp_root / "long_16x9"
    prepare_sandbox(ep_path, sandbox, suite_dir, overlay=overlay, writable_out=(render_frames > 0))

    checks: dict[str, dict] = {}
    rc, dt, out, err = run_cmd(["node", "scripts/lint.mjs", "shots"], sandbox, env)
    checks["lint_shots"] = parse_lint_result(sandbox, rc, dt, out, err)

    rc, dt, out, err = run_cmd(["node", "scripts/qa.mjs", "layout"], sandbox, env)
    checks["qa_layout"] = parse_layout_result(sandbox, rc, dt, out, err)

    set_id = detect_place_set_id(sandbox)
    if set_id:
        rc, dt, out, err = run_cmd(["node", "scripts/qa.mjs", "place", set_id], sandbox, env)
        m_slots = re.findall(r"\bactor\b|\bid\s*:", out)
        checks["qa_place"] = {
            "passed": rc == 0,
            "rc": rc,
            "set_id": set_id,
            "elapsed_s": round(dt, 3),
            "slots_hint": len(m_slots),
            "summary": (out.strip().splitlines()[0][:140] if out.strip() else ""),
            "error": (err.strip()[:200] if rc != 0 else ""),
        }
    else:
        checks["qa_place"] = {
            "passed": False,
            "rc": 1,
            "set_id": None,
            "elapsed_s": 0.0,
            "error": "could not detect non-insert set id for qa.mjs place",
        }

    rc, dt, out, err = run_cmd([py_exe, "scripts/sv_doctor.py", "--stage", "G5", "--json"], sandbox, env)
    checks["sv_doctor_g5"] = parse_doctor_result(rc, dt, out, err)

    if render_frames > 0:
        checks["render_frames"] = run_optional_render(sandbox, render_frames, env)

    total_errors = (
        checks["lint_shots"]["errors"]
        + checks["sv_doctor_g5"]["errors"]
        + (0 if checks["qa_layout"]["passed"] else 1)
        + (0 if checks["qa_place"]["passed"] else 1)
        + (0 if checks.get("render_frames", {"passed": True})["passed"] else 1)
    )
    total_warns = checks["lint_shots"]["warnings"] + checks["sv_doctor_g5"]["warnings"]
    passed = all(c["passed"] for c in checks.values())
    return {
        "status": "PASS" if passed else "FAIL",
        "passed": passed,
        "path": str(ep_path),
        "format": "16:9",
        "elapsed_s": round(time.perf_counter() - t_all, 3),
        "errors": total_errors,
        "warnings": total_warns,
        "checks": checks,
    }


def render_scorecard(report: dict) -> str:
    lines: list[str] = []
    verdict = "PASS" if report["passed"] else "FAIL"
    lines.append(f"# story-video-skills Dual-Format Benchmark Scorecard (`v{report['suite_version']}`)")
    lines.append("")
    lines.append(
        f"- **Overall Verdict:** `{verdict}` · **Total Elapsed:** `{report['total_elapsed_s']:.2f}s` · "
        f"**Overlay Mode:** `{'on' if report['overlay'] else 'off'}`"
    )
    lines.append("")
    lines.append("| Stage / Check | Status | Elapsed | Errors | Warnings | Key Metrics |")
    lines.append("|---|---|---:|---:|---:|---|")

    vs = report["validate_skills"]
    lines.append(
        f"| Suite `validate_skills.py` | {'PASS' if vs['passed'] else 'FAIL'} | "
        f"{vs['elapsed_ms']:.0f} ms | {vs['errors']} | {vs['warnings']} | "
        f"{vs['skills']} skills, {vs['lint_rules']} lint rules |"
    )

    sx = report["syntax"]
    lines.append(
        f"| Syntax (`node --check` + `py_compile`) | {'PASS' if sx['passed'] else 'FAIL'} | "
        f"{sx['elapsed_ms']:.0f} ms | {sx['errors']} | 0 | "
        f"{sx['mjs_checked']} `.mjs` ({sx['mjs_ms']:.0f} ms) + {sx['py_checked']} `.py` ({sx['py_ms']:.0f} ms) |"
    )

    sh = report["short_9x16"]
    if sh["status"] == "SKIP":
        lines.append(f"| 9:16 Short (`{Path(sh['path']).name}`) | SKIP | — | 0 | 0 | {sh['reason']} |")
    else:
        sc = sh["checks"]
        la = sc["lint_all"]
        ly = sc["qa_layout"]
        vp = sc["voice_preflight"]
        dr = sc["sv_doctor_all"]
        lines.append(
            f"| 9:16 Short · `lint.mjs all` | {'PASS' if la['passed'] else 'FAIL'} | "
            f"{la['elapsed_s']:.2f} s | {la['errors']} | {la['warnings']} | "
            f"strips={la['strips']} |"
        )
        lines.append(
            f"| 9:16 Short · `qa.mjs layout` | {'PASS' if ly['passed'] else 'FAIL'} | "
            f"{ly['elapsed_s']:.2f} s | {ly['overcrowded'] + ly['scale_err'] + ly['cutoff_err']} | 0 | "
            f"{ly['shots']} shots, over={ly['overcrowded']}, scale={ly['scale_err']}, cut={ly['cutoff_err']}, occ mean/max={ly['mean_occ_pct']}%/{ly['max_occ_pct']}% |"
        )
        lines.append(
            f"| 9:16 Short · `voice.py --preflight` | {'PASS' if vp['passed'] else 'FAIL'} | "
            f"{vp['elapsed_s']:.2f} s | {vp['errors']} | {vp['warnings']} | "
            f"zero-GPU sanity OK |"
        )
        lines.append(
            f"| 9:16 Short · `sv_doctor.py --stage all` | {'PASS' if dr['passed'] else 'FAIL'} | "
            f"{dr['elapsed_s']:.2f} s | {dr['errors']} | {dr['warnings']} | "
            f"SLA {dr.get('sla_budget_min')}m, est_rem={dr.get('est_remaining_min')}m ({'WITHIN' if dr.get('within_sla') else 'OVER'}) |"
        )
        if "render_frames" in sc:
            rf = sc["render_frames"]
            lines.append(
                f"| 9:16 Short · Render `{rf['frames']}f` | {'PASS' if rf['passed'] else 'FAIL'} | "
                f"{rf['elapsed_s']:.2f} s | {0 if rf['passed'] else 1} | 0 | "
                f"{rf['fps']} fps ({rf['size_kb']} KB) |"
            )

    lg = report["long_16x9"]
    if lg["status"] == "SKIP":
        lines.append(f"| 16:9 Long-Form (`{Path(lg['path']).name}`) | SKIP | — | 0 | 0 | {lg['reason']} |")
    else:
        lc = lg["checks"]
        ls = lc["lint_shots"]
        ly = lc["qa_layout"]
        pl = lc["qa_place"]
        dr = lc["sv_doctor_g5"]
        lines.append(
            f"| 16:9 Long · `lint.mjs shots` | {'PASS' if ls['passed'] else 'FAIL'} | "
            f"{ls['elapsed_s']:.2f} s | {ls['errors']} | {ls['warnings']} | "
            f"strips={ls['strips']} |"
        )
        lines.append(
            f"| 16:9 Long · `qa.mjs layout` | {'PASS' if ly['passed'] else 'FAIL'} | "
            f"{ly['elapsed_s']:.2f} s | {ly['overcrowded'] + ly['scale_err'] + ly['cutoff_err']} | 0 | "
            f"{ly['shots']} shots, over={ly['overcrowded']}, scale={ly['scale_err']}, cut={ly['cutoff_err']}, occ mean/max={ly['mean_occ_pct']}%/{ly['max_occ_pct']}% |"
        )
        lines.append(
            f"| 16:9 Long · `qa.mjs place {pl.get('set_id') or '?'}` | {'PASS' if pl['passed'] else 'FAIL'} | "
            f"{pl['elapsed_s']:.2f} s | {0 if pl['passed'] else 1} | 0 | "
            f"first-try placement solver |"
        )
        lines.append(
            f"| 16:9 Long · `sv_doctor.py --stage G5` | {'PASS' if dr['passed'] else 'FAIL'} | "
            f"{dr['elapsed_s']:.2f} s | {dr['errors']} | {dr['warnings']} | "
            f"G5 ready={dr.get('ready')} |"
        )
        if "render_frames" in lc:
            rf = lc["render_frames"]
            lines.append(
                f"| 16:9 Long · Render `{rf['frames']}f` | {'PASS' if rf['passed'] else 'FAIL'} | "
                f"{rf['elapsed_s']:.2f} s | {0 if rf['passed'] else 1} | 0 | "
                f"{rf['fps']} fps ({rf['size_kb']} KB) |"
            )

    # Show any failure details concisely
    failures: list[str] = []
    if not vs["passed"] and vs.get("output"):
        failures.append(f"- `validate_skills.py`: {vs['output']}")
    for fail in sx["mjs_failed"] + sx["py_failed"]:
        failures.append(f"- syntax `{fail['file']}`: {fail['error']}")
    for label, sec in (("9:16 Short", sh), ("16:9 Long", lg)):
        if sec.get("status") == "FAIL":
            for cname, cdata in sec.get("checks", {}).items():
                if not cdata.get("passed"):
                    detail = (
                        (cdata.get("sample_errors") or [None])[0]
                        or cdata.get("error")
                        or cdata.get("summary")
                        or f"rc={cdata.get('rc')}"
                    )
                    failures.append(f"- {label} `{cname}`: {detail}")
    if failures:
        lines.append("")
        lines.append("### Failures")
        lines.extend(failures)

    return "\n".join(lines)


def main() -> int:
    ap = argparse.ArgumentParser(
        description="Unified Dual-Format Quality & Speed Benchmark Suite (story-video-skills)"
    )
    ap.add_argument("--short", default=str(DEFAULT_SHORT), help=f"9:16 Short episode directory (default: {DEFAULT_SHORT})")
    ap.add_argument("--long", default=str(DEFAULT_LONG), help=f"16:9 Long-Form episode directory (default: {DEFAULT_LONG})")
    ap.add_argument("--render-frames", type=int, default=0, help="Optional timed Remotion render frames per episode (default: 0 = disabled)")
    ap.add_argument(
        "--overlay",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="Overlay latest suite engine/scripts/* into isolated temp sandboxes (default: --overlay)",
    )
    ap.add_argument(
        "--json",
        nargs="?",
        const="-",
        default=None,
        help="Emit JSON summary to stdout (if no path) or write to file path",
    )
    args = ap.parse_args()

    t0 = time.perf_counter()
    env = make_env()
    py_exe = resolve_python()
    plugin_json = SUITE_ROOT / ".claude-plugin" / "plugin.json"
    suite_version = "unknown"
    if plugin_json.is_file():
        try:
            suite_version = json.loads(plugin_json.read_text(encoding="utf-8")).get("version", "unknown")
        except Exception:
            pass

    tmp_root = Path(tempfile.mkdtemp(prefix="sv_bench_suite_"))
    try:
        vs = check_validate_skills(SUITE_ROOT, env)
        sx = check_syntax(SUITE_ROOT, env)
        sh = benchmark_short(
            Path(args.short).expanduser().resolve(),
            SUITE_ROOT,
            tmp_root,
            env,
            py_exe,
            overlay=args.overlay,
            render_frames=max(0, args.render_frames),
        )
        lg = benchmark_long(
            Path(args.long).expanduser().resolve(),
            SUITE_ROOT,
            tmp_root,
            env,
            py_exe,
            overlay=args.overlay,
            render_frames=max(0, args.render_frames),
        )

        passed = vs["passed"] and sx["passed"] and sh["passed"] and lg["passed"]
        report = {
            "suite_root": str(SUITE_ROOT),
            "suite_version": suite_version,
            "overlay": args.overlay,
            "render_frames": max(0, args.render_frames),
            "total_elapsed_s": round(time.perf_counter() - t0, 3),
            "passed": passed,
            "validate_skills": vs,
            "syntax": sx,
            "short_9x16": sh,
            "long_16x9": lg,
        }

        if args.json == "-":
            print(json.dumps(report, indent=2, ensure_ascii=False))
        else:
            print(render_scorecard(report))
            if args.json:
                out_p = Path(args.json)
                out_p.parent.mkdir(parents=True, exist_ok=True)
                out_p.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
                print(f"\nJSON report written: {out_p}")

        return 0 if passed else 1
    finally:
        shutil.rmtree(tmp_root, ignore_errors=True)


if __name__ == "__main__":
    raise SystemExit(main())
