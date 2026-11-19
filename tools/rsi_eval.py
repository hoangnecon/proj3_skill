#!/usr/bin/env python3
"""Reproducible RSI benchmark suite for story-video-skills.

Evaluates a suite directory (or git ref of it) in isolated /tmp/rsi_eval_* sandboxes:
  Test 1: Historical Defect Catch Rate (D01..D10 injected one-by-one into huy-hieu)
  Test 2: False-Positive Rate on clean episodes (huy-hieu v2 & sieu-nang-luc-cua-ban)
  Test 3: 3-shot QA Fix Cycle Speed (legacy 5-command vs single-bundle qa.mjs pass changed)
  Test 4: Suite Integrity (tools/validate_skills.py)

Usage:
  python3 tools/rsi_eval.py --suite /Users/hoangnguyen142/Work/PROJ3/story-video-skills-rsi [--git-ref 1cec1f9] [--skip-qa-speed] [--json out.json]
"""
from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

HUY_HIEU_REF = Path("/Users/hoangnguyen142/Work/PROJ3/huy-hieu-khong-bao-gio-sai")
SIEU_NANG_LUC_REF = Path("/Users/hoangnguyen142/Work/PROJ3/sieu-nang-luc-cua-ban")
VENV_BIN = "/Users/Shared/Tools/VieNeu-TTS/.venv/bin"


def make_env() -> dict[str, str]:
    env = os.environ.copy()
    env["PATH"] = f"{VENV_BIN}:{env.get('PATH', '')}"
    return env


def run_cmd(cmd: list[str], cwd: Path, env: dict[str, str], stream: bool = False) -> tuple[int, float, str]:
    t0 = time.monotonic()
    if stream:
        proc = subprocess.run(cmd, cwd=cwd, env=env, text=True)
        dt = time.monotonic() - t0
        return proc.returncode, dt, ""
    proc = subprocess.run(cmd, cwd=cwd, env=env, capture_output=True, text=True)
    dt = time.monotonic() - t0
    out = (proc.stdout or "") + ("\n" + proc.stderr if proc.stderr else "")
    return proc.returncode, dt, out


def extract_suite_if_ref(suite_dir: Path, git_ref: str | None, tmp_root: Path) -> Path:
    if not git_ref:
        return suite_dir
    out_dir = tmp_root / "suite_ref"
    out_dir.mkdir(parents=True, exist_ok=True)
    archive = subprocess.run(
        ["git", "-C", str(suite_dir), "archive", git_ref],
        capture_output=True,
        check=True,
    )
    subprocess.run(["tar", "-x", "-C", str(out_dir)], input=archive.stdout, check=True)
    return out_dir


def copy_episode_sandbox(src_ep: Path, dst_ep: Path, suite_dir: Path) -> None:
    """Copy reference episode into dst_ep (symlinking node_modules, omitting out/), swap suite engine scripts & design."""
    shutil.copytree(
        src_ep,
        dst_ep,
        symlinks=True,
        ignore=shutil.ignore_patterns("node_modules", "out"),
    )
    nm_src = Path(os.path.realpath(src_ep / "node_modules"))
    os.symlink(nm_src, dst_ep / "node_modules")

    # Swap in <suite-dir>/engine/scripts/* and <suite-dir>/engine/src/design/*
    src_scripts = suite_dir / "engine" / "scripts"
    dst_scripts = dst_ep / "scripts"
    for f in src_scripts.iterdir():
        if f.is_file():
            shutil.copy2(f, dst_scripts / f.name)

    src_design = suite_dir / "engine" / "src" / "design"
    dst_design = dst_ep / "src" / "design"
    dst_design.mkdir(parents=True, exist_ok=True)
    for f in src_design.iterdir():
        if f.is_file():
            shutil.copy2(f, dst_design / f.name)


def clone_prepared_sandbox(base_ep: Path, dst_ep: Path) -> None:
    """Fast copy of an already-swapped base sandbox."""
    shutil.copytree(
        base_ep,
        dst_ep,
        symlinks=True,
        ignore=shutil.ignore_patterns("node_modules"),
    )
    nm_src = Path(os.path.realpath(base_ep / "node_modules"))
    os.symlink(nm_src, dst_ep / "node_modules")


def replace_once(path: Path, old: str, new: str) -> None:
    txt = path.read_text(encoding="utf-8")
    cnt = txt.count(old)
    if cnt != 1:
        raise RuntimeError(f"Expected 1 occurrence of target in {path.name}, found {cnt}: {old!r}")
    path.write_text(txt.replace(old, new, 1), encoding="utf-8")


# ---------------- Historical Defect Injectors (D01..D10) ----------------
def inject_d01_toy_bus(ep: Path) -> None:
    p = ep / "src" / "props.tsx"
    replace_once(
        p,
        "export const SchoolBus: React.FC = () => (\n  <g>",
        'export const SchoolBus: React.FC = () => (\n  <g transform="scale(0.35)">',
    )


def inject_d02_toy_truck(ep: Path) -> None:
    p = ep / "src" / "props.tsx"
    replace_once(
        p,
        "export const FireTruck: React.FC<{t?: number; choco?: boolean}> = ({t = 0, choco = false}) => {\n  const pulse = 0.45 + 0.45 * Math.abs(Math.sin(t * 7));\n  return (\n    <g>",
        'export const FireTruck: React.FC<{t?: number; choco?: boolean}> = ({t = 0, choco = false}) => {\n  const pulse = 0.45 + 0.45 * Math.abs(Math.sin(t * 7));\n  return (\n    <g transform="scale(0.35)">',
    )


def inject_d03_toy_kart(ep: Path) -> None:
    p = ep / "src" / "props.tsx"
    replace_once(
        p,
        "export const GoKart: React.FC = () => (\n  <g>",
        'export const GoKart: React.FC = () => (\n  <g transform="scale(0.4)">',
    )


def inject_d04_cart_wheel_text(ep: Path) -> None:
    p = ep / "src" / "props.tsx"
    replace_once(
        p,
        '    <g transform="translate(115 -56)">',
        '    <g transform="translate(0 -162)">',
    )


def inject_d05_plate_sign_clip(ep: Path) -> None:
    p = ep / "src" / "episode" / "sets.tsx"
    st = p.stat()
    replace_once(
        p,
        "    plateCam: [1120, 1180, 0.62],\n    plateOpts: {fenceBroken: 1},",
        "    plateCam: [1310, 1180, 0.62],\n    plateOpts: {fenceBroken: 1},",
    )
    # Preserve sets.tsx mtime so SE-13 plate-age check does not fire spuriously alongside SE-14
    os.utime(p, (st.st_atime, st.st_mtime))


def inject_d06_shot_sign_clip(ep: Path) -> None:
    p = ep / "src" / "episode" / "shotlist.ts"
    replace_once(
        p,
        "    name: 'cửa trạm cứu hỏa bị khóa chặt',\n    set: 'tramCuuHoa',\n    cam: [720, 1140, 0.86],\n    cam2: [700, 1140, 0.92],",
        "    name: 'cửa trạm cứu hỏa bị khóa chặt',\n    set: 'tramCuuHoa',\n    cam: [1270, 1140, 0.86],\n    cam2: [1270, 1140, 0.92],",
    )


def inject_d07_actor_over_sign(ep: Path) -> None:
    p = ep / "src" / "episode" / "shotlist.ts"
    replace_once(
        p,
        "      {id: 'dpB', look: 'ongNam', x: 1280, y: STREET_Y + 20, s: 0.88, prop: 'badgeHeroAdult', p: 'clap', e: 'joy'},",
        "      {id: 'dpB', look: 'ongNam', x: 1060, y: STREET_Y + 70, s: 0.88, prop: 'badgeHeroAdult', p: 'clap', e: 'joy'},",
    )


def inject_d08_prop_edge_clip(ep: Path) -> None:
    p = ep / "src" / "episode" / "shotlist.ts"
    replace_once(
        p,
        "    extras: [{k: 'badgeVillainChocoBig', x: 700, y: 1510, s: 0.95}],",
        "    extras: [{k: 'badgeVillainChocoBig', x: 880, y: 1510, s: 0.95}],",
    )


def inject_d09_turnaround_squash(ep: Path) -> None:
    p = ep / "src" / "episode" / "shotlist.ts"
    replace_once(
        p,
        "          [LADDER_TIP.x, LADDER_TIP.y, 's23@rung'],\n          [LADDER_TIP.x, LADDER_TIP.y + 48, 's23@trượt'],",
        "          [LADDER_TIP.x + 12, LADDER_TIP.y, 's23@rung'],\n          [LADDER_TIP.x - 12, LADDER_TIP.y + 48, 's23@trượt'],",
    )


def inject_d10_ch10_handdrawn(ep: Path) -> None:
    p = ep / "src" / "props.tsx"
    txt = p.read_text(encoding="utf-8")
    txt += (
        "\nexport const HandDrawnTestChar: React.FC = () => (\n"
        '  <g><S d={E(0, -180, 48, 48)} f="skin" /><S d={E(0, -210, 50, 22)} f="hair" /></g>\n'
        ");\n"
    )
    p.write_text(txt, encoding="utf-8")


DEFECTS = [
    ("D01_toy_bus", "design", "PR-01", "schoolBus", inject_d01_toy_bus),
    ("D02_toy_truck", "design", "PR-01", "fireTruck", inject_d02_toy_truck),
    ("D03_toy_kart", "design", "PR-01", "goKart", inject_d03_toy_kart),
    ("D04_cart_wheel_text", "design", "PR-02", "iceCreamCart", inject_d04_cart_wheel_text),
    ("D05_plate_sign_clip", "design", "SE-14", "sanDuaSuaXe", inject_d05_plate_sign_clip),
    ("D06_shot_sign_clip", "shots", "GE-10", "KHÓA CHẶT", inject_d06_shot_sign_clip),
    ("D07_actor_over_sign", "shots", "GE-11", "CHỦ TỊCH", inject_d07_actor_over_sign),
    ("D08_prop_edge_clip", "shots", "GE-15", "badgeVillainChocoBig", inject_d08_prop_edge_clip),
    ("D09_turnaround_squash", "shots", "MO-10", "#51", inject_d09_turnaround_squash),
    ("D10_ch10_handdrawn", "design", "CH-10", "HandDrawnTestChar", inject_d10_ch10_handdrawn),
]


def parse_lint_json(ep: Path) -> dict:
    lp = ep / "qa" / "lint.json"
    if not lp.exists():
        return {"errors": [], "warns": []}
    return json.loads(lp.read_text(encoding="utf-8"))


def sync_cache_before_3shot_edit(ep: Path, env: dict[str, str]) -> None:
    """Align qa/cache.json hashes with the swapped suite's engineHash before touching 3 shots,
    so Test 3 always benchmarks a true 3-shot delta (#28, #35, #43) rather than re-rendering all 65 shots
    when engine/src/design/Sheets.tsx differs from the episode's build version."""
    js = r"""
import fs from 'node:fs';
import crypto from 'node:crypto';
import {loadProject} from './scripts/load.mjs';
import {makeShotHash} from './scripts/deps.mjs';
const P = await loadProject();
const rows = P.shotTable();
const DEPS = makeShotHash(rows, P.SHOTS);
const hashes = Object.fromEntries(rows.map((r) => [r.i, DEPS.hashOf(r)]));
const sha = (s) => crypto.createHash('sha1').update(s).digest('hex').slice(0, 12);
const shotOf = (s) => rows.find((r) => s.t0 >= r.t0 - 0.01 && s.t0 < r.t1) ?? rows[0];
const cache = JSON.parse(fs.readFileSync('qa/cache.json', 'utf8'));
cache.contact = {...hashes};
cache.cards = {...hashes};
const need = fs.existsSync('qa/strips_needed.json') ? JSON.parse(fs.readFileSync('qa/strips_needed.json', 'utf8')) : [];
cache.strips = Object.fromEntries(need.map((s) => [s.name, sha(hashes[shotOf(s).i] + JSON.stringify(s))]));
cache.crops = cache.crops ?? {};
for (const k of Object.keys(cache.crops)) if (hashes[k]) cache.crops[k] = hashes[k];
fs.writeFileSync('qa/cache.json', JSON.stringify(cache, null, 1));
"""
    proc = subprocess.run(["node", "--input-type=module", "-e", js], cwd=ep, env=env, capture_output=True, text=True, check=True)


def touch_three_shots(ep: Path) -> None:
    p = ep / "src" / "episode" / "shotlist.ts"
    # #28
    replace_once(
        p,
        "    name: 'đội cứu hỏa vẫy tay trên xe hoa',\n    set: 'doiDieuHanh',\n    cam: [680, 1140, 0.72],",
        "    name: 'đội cứu hỏa vẫy tay trên xe hoa',\n    set: 'doiDieuHanh',\n    cam: [682, 1140, 0.72],",
    )
    # #35
    replace_once(
        p,
        "    name: 'đội cứu hỏa kẹt cứng trên xe hoa',\n    set: 'doiDieuHanh',\n    cam: [680, 1140, 0.72],",
        "    name: 'đội cứu hỏa kẹt cứng trên xe hoa',\n    set: 'doiDieuHanh',\n    cam: [682, 1140, 0.72],",
    )
    # #43
    replace_once(
        p,
        "    name: 'Tín nổ máy xe cứu hỏa trong nhà xe',\n    set: 'tramCuuHoa',\n    cam: [1780, 1220, 0.78],",
        "    name: 'Tín nổ máy xe cứu hỏa trong nhà xe',\n    set: 'tramCuuHoa',\n    cam: [1782, 1220, 0.78],",
    )


def main() -> int:
    ap = argparse.ArgumentParser(description="Run reproducible RSI evaluation suite")
    ap.add_argument("--suite", default=str(Path(__file__).resolve().parents[1]), help="Path to story-video-skills suite")
    ap.add_argument("--git-ref", help="Optional git ref to extract from --suite (e.g. 1cec1f9)")
    ap.add_argument("--skip-qa-speed", action="store_true", help="Skip Test 3 QA cycle timing")
    ap.add_argument("--json", help="Write structured results JSON to path")
    args = ap.parse_args()

    env = make_env()
    tmp_root = Path(tempfile.mkdtemp(prefix="rsi_eval_"))
    results: dict = {"suite": args.suite, "git_ref": args.git_ref, "tests": {}}

    try:
        suite_dir = extract_suite_if_ref(Path(args.suite).resolve(), args.git_ref, tmp_root)
        print(f"=== RSI EVAL: suite={suite_dir} (ref={args.git_ref or 'working-tree'}) ===", flush=True)

        # Prepare base huy-hieu sandbox once
        hh_base = tmp_root / "hh_base"
        print("Preparing base huy-hieu sandbox...", flush=True)
        copy_episode_sandbox(HUY_HIEU_REF, hh_base, suite_dir)

        # ---------------- Test 1: Historical Defect Catch Rate ----------------
        print("\n--- Test 1: Historical Defect Catch Rate (D01..D10) ---", flush=True)
        t1_rows = []
        caught_count = 0
        for did, phase, expected_rule, target_needle, injector in DEFECTS:
            ep = tmp_root / f"d_{did}"
            clone_prepared_sandbox(hh_base, ep)
            injector(ep)
            rc, dt, out = run_cmd(["node", "scripts/lint.mjs", phase], ep, env)
            rep = parse_lint_json(ep)
            msgs = rep.get("errors", []) + rep.get("warns", [])
            matched = [m for m in msgs if f"[{expected_rule}]" in m and target_needle in m]
            caught = len(matched) > 0
            if caught:
                caught_count += 1
            status = "CAUGHT" if caught else "MISSED"
            t1_rows.append({
                "id": did,
                "phase": phase,
                "expected_rule": expected_rule,
                "caught": caught,
                "matched": matched[:3],
                "rc": rc,
                "errors": len(rep.get("errors", [])),
                "warns": len(rep.get("warns", [])),
                "dt_s": round(dt, 2),
            })
            detail = matched[0][:100] if matched else f"(rc={rc}, err={len(rep.get('errors',[]))}, warn={len(rep.get('warns',[]))})"
            print(f"  {did:22s} [{expected_rule}] {status:6s} {dt:5.2f}s  {detail}", flush=True)
            shutil.rmtree(ep, ignore_errors=True)
        print(f"Test 1 Score: {caught_count}/{len(DEFECTS)}", flush=True)
        results["tests"]["defect_catch"] = {"caught": caught_count, "total": len(DEFECTS), "cases": t1_rows}

        # ---------------- Test 2: False-Positive Rate on Clean Episodes ----------------
        print("\n--- Test 2: Clean Episode False-Positive Rate ---", flush=True)
        t2_rows = {}
        for name, ref_path in [("huy_hieu_v2", HUY_HIEU_REF), ("sieu_nang_luc", SIEU_NANG_LUC_REF)]:
            ep = tmp_root / f"clean_{name}"
            if name == "huy_hieu_v2":
                clone_prepared_sandbox(hh_base, ep)
            else:
                copy_episode_sandbox(ref_path, ep, suite_dir)
            rc, dt, out = run_cmd(["node", "scripts/lint.mjs", "all"], ep, env)
            rep = parse_lint_json(ep)
            errs = rep.get("errors", [])
            warns = rep.get("warns", [])
            hot_p = ep / "qa" / "hot.json"
            orig_hot_p = ref_path / "qa" / "hot.json"
            hot_data = json.loads(hot_p.read_text(encoding="utf-8")) if hot_p.exists() else {}
            orig_hot_data = json.loads(orig_hot_p.read_text(encoding="utf-8")) if orig_hot_p.exists() else {}
            by_rule: dict[str, int] = {}
            for msg in errs + warns:
                m_r = re.match(r"\[([A-Z]+-\d+)\]", msg)
                rk = m_r.group(1) if m_r else "OTHER"
                by_rule[rk] = by_rule.get(rk, 0) + 1
            t2_rows[name] = {
                "rc": rc,
                "dt_s": round(dt, 2),
                "errors": len(errs),
                "warns": len(warns),
                "by_rule": by_rule,
                "hot_count": len(hot_data),
                "orig_hot_count": len(orig_hot_data),
                "hot_keys": sorted(hot_data.keys(), key=lambda x: int(x) if x.isdigit() else 999),
                "error_msgs": errs,
                "warn_msgs": warns,
            }
            print(f"  {name:15s}: rc={rc} errors={len(errs)} warns={len(warns)} hot={len(hot_data)} (orig={len(orig_hot_data)}) by_rule={by_rule} ({dt:.2f}s)", flush=True)
            for m in errs[:5]:
                print(f"    ERR : {m}", flush=True)
            for m in warns[:8]:
                print(f"    WARN: {m}", flush=True)
            shutil.rmtree(ep, ignore_errors=True)
        results["tests"]["clean_fp"] = t2_rows

        # ---------------- Test 3: 3-Shot QA Fix Cycle Speed ----------------
        if not args.skip_qa_speed:
            print("\n--- Test 3: 3-Shot Fix QA Cycle Speed (#28, #35, #43) ---", flush=True)
            t3 = {}
            # Legacy 5-step cycle
            ep_leg = tmp_root / "qa_legacy"
            clone_prepared_sandbox(hh_base, ep_leg)
            sync_cache_before_3shot_edit(ep_leg, env)
            touch_three_shots(ep_leg)
            rc_l, dt_l, _ = run_cmd(["node", "scripts/lint.mjs", "shots"], ep_leg, env)
            steps_leg = []
            for label, cmd in [
                ("contact", ["node", "scripts/qa.mjs", "contact"]),
                ("strips", ["node", "scripts/qa.mjs", "strips"]),
                ("cards_changed", ["node", "scripts/qa.mjs", "cards", "changed"]),
                ("crops_43", ["node", "scripts/qa.mjs", "crops", "43"]),
                ("carry", ["python3", "scripts/carry.py"]),
            ]:
                rc_s, dt_s, out_s = run_cmd(cmd, ep_leg, env)
                steps_leg.append({"step": label, "rc": rc_s, "dt_s": round(dt_s, 2)})
                print(f"  legacy/{label:14s}: rc={rc_s} {dt_s:6.2f}s", flush=True)
            leg_total = sum(s["dt_s"] for s in steps_leg)
            t3["legacy"] = {"lint_s": round(dt_l, 2), "total_qa_s": round(leg_total, 2), "steps": steps_leg}
            print(f"  legacy TOTAL (5 cmds): {leg_total:.2f}s", flush=True)
            shutil.rmtree(ep_leg, ignore_errors=True)

            # Check if qa.mjs supports `pass` mode
            qa_src = (suite_dir / "engine" / "scripts" / "qa.mjs").read_text(encoding="utf-8")
            has_pass = bool(re.search(r"mode\s*===\s*['\"]pass['\"]", qa_src))
            if has_pass:
                ep_pass = tmp_root / "qa_pass"
                clone_prepared_sandbox(hh_base, ep_pass)
                sync_cache_before_3shot_edit(ep_pass, env)
                touch_three_shots(ep_pass)
                rc_l2, dt_l2, _ = run_cmd(["node", "scripts/lint.mjs", "shots"], ep_pass, env)
                rc_p, dt_p, out_p = run_cmd(["node", "scripts/qa.mjs", "pass", "changed"], ep_pass, env)
                t3["pass_changed"] = {"available": True, "lint_s": round(dt_l2, 2), "rc": rc_p, "total_qa_s": round(dt_p, 2)}
                print(f"  pass changed (1 cmd) : rc={rc_p} {dt_p:6.2f}s", flush=True)
                shutil.rmtree(ep_pass, ignore_errors=True)
            else:
                t3["pass_changed"] = {"available": False}
                print("  pass changed         : not available in this suite", flush=True)
            results["tests"]["qa_speed"] = t3

        # ---------------- Test 4: Suite Integrity ----------------
        print("\n--- Test 4: Suite Integrity (validate_skills.py) ---", flush=True)
        rc_v, dt_v, out_v = run_cmd(["python3", str(suite_dir / "tools" / "validate_skills.py"), str(suite_dir)], suite_dir, env)
        print(out_v.strip(), flush=True)
        m_val = re.search(r"(\d+) skills,\s*(\d+) lint rules implemented,\s*(\d+) errors,\s*(\d+) warnings", out_v)
        results["tests"]["validate_skills"] = {
            "rc": rc_v,
            "dt_s": round(dt_v, 2),
            "skills": int(m_val.group(1)) if m_val else None,
            "lint_rules": int(m_val.group(2)) if m_val else None,
            "errors": int(m_val.group(3)) if m_val else None,
            "warns": int(m_val.group(4)) if m_val else None,
            "output": out_v.strip(),
        }

        if args.json:
            Path(args.json).write_text(json.dumps(results, indent=2), encoding="utf-8")
            print(f"\nWrote JSON results to {args.json}", flush=True)

        return 0
    finally:
        shutil.rmtree(tmp_root, ignore_errors=True)


if __name__ == "__main__":
    raise SystemExit(main())
