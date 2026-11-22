"""Unified Stage Preflight Doctor & SLA Budget Profiler (RSI v4.3.0).

Zero-browser, zero-GPU, <3s deterministic preflight across G1..G7 for both:
  - 9:16 Shorts     (SLA budget: 15 min)
  - 16:9 Long-Form  (SLA budget: 45 min)

Usage:
  python3 scripts/sv_doctor.py [--stage G1|G2|G3|G4|G5|G6|G7|all] [--json]

Emits qa/stage_budget.json and prints a concise executive table.
Exits 0 if all requested stage(s) have zero blocking issues, 1 otherwise.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
from collections import Counter
from pathlib import Path

_SCRIPT_DIR = Path(__file__).resolve().parent
_SCRIPT_ROOT = _SCRIPT_DIR.parent


def _resolve_root() -> Path:
    markers = ("script.json", "brief.md", "src/episode")
    if any((_SCRIPT_ROOT / m).exists() for m in markers):
        return _SCRIPT_ROOT
    cwd = Path.cwd()
    if any((cwd / m).exists() for m in markers):
        return cwd
    return _SCRIPT_ROOT


ROOT = _resolve_root()

ORDER = ("G1", "G2", "G3", "G4", "G5", "G6", "G7")
STAGE_NAMES = {
    "G1": "premise & brief",
    "G2": "script & beats",
    "G3": "voice pre-TTS sanitizer",
    "G4": "design: cast + sets + subjects",
    "G5": "shots, camera & layout",
    "G6": "audio mix sync",
    "G7": "render & delivery preflight",
}
BRIEF_REQUIRED_SECTIONS = (
    "## Archetype",
    "## Premise",
    "## Spine",
    "## Why it is funny",
    "## Characters",
    "## Locations",
    "## Ending",
    "## Not copying",
)
SENT_SPLIT_RE = re.compile(r"(?<=[.!?…])\s+(?=[^\s])")
TAG_RE = re.compile(r"\[([^\]]+)\]")
EN_TAG_RE = re.compile(r"</?en>", re.I)

# Render intermediate disk estimates (MB per 30fps frame)
JPEG_MB_PER_FRAME = 0.15
PNG_MB_PER_FRAME = 0.55


def sha16(rel_path: str | Path) -> str | None:
    p = ROOT / rel_path
    if not p.is_file():
        return None
    return hashlib.sha256(p.read_bytes()).hexdigest()[:16]


def jload(rel_path: str | Path):
    p = ROOT / rel_path
    if not p.is_file():
        return None
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        return None


def run_cmd(cmd: list[str], timeout_s: float = 15.0) -> tuple[int, str, str]:
    try:
        r = subprocess.run(
            cmd,
            cwd=ROOT,
            capture_output=True,
            text=True,
            timeout=timeout_s,
        )
        return r.returncode, r.stdout, r.stderr
    except subprocess.TimeoutExpired:
        return 124, "", f"command timed out after {timeout_s:.0f}s: {' '.join(cmd)}"
    except FileNotFoundError as exc:
        return 127, "", f"executable not found: {exc}"


def _pick_script(name: str, require_text: str | None = None) -> Path | None:
    local = ROOT / "scripts" / name
    sibling = _SCRIPT_DIR / name
    if local.is_file():
        if not require_text:
            return local
        try:
            if require_text in local.read_text(encoding="utf-8", errors="ignore"):
                return local
        except OSError:
            pass
    if sibling.is_file():
        return sibling
    return local if local.is_file() else None


def _strip_markup(s: str) -> str:
    s = EN_TAG_RE.sub("", s)
    s = TAG_RE.sub(" ", s)
    return " ".join(s.split())


def _episode_profile(script: dict | None) -> dict:
    sc = script or {}
    is_16x9 = sc.get("format") == "16:9" or sc.get("length") == "long_16x9"
    fmt = "16:9" if is_16x9 else "9:16"
    length = sc.get("length") or ("long_16x9" if is_16x9 else "short_9x16")
    sla_min = 45 if is_16x9 else 15
    segs = sc.get("segments") if isinstance(sc.get("segments"), list) else []

    timing = jload("qa/timing.json")
    shots_list = timing if isinstance(timing, list) else (jload("qa/shots.json") or [])
    n_shots = len(shots_list) if isinstance(shots_list, list) else 0

    duration_s = 0.0
    if isinstance(timing, list) and timing:
        try:
            duration_s = max(float(row.get("t1", 0.0)) for row in timing if isinstance(row, dict))
        except Exception:
            duration_s = 0.0
    if duration_s <= 0.0:
        vr = jload("qa/voice_report.json")
        if isinstance(vr, dict) and vr.get("total"):
            duration_s = float(vr["total"])
    if duration_s <= 0.0 and segs:
        total_words = sum(len(_strip_markup(str(s.get("tts_text", s.get("text", "")))).split()) for s in segs if isinstance(s, dict))
        pause_after = float(sc.get("pause_after", 0.18))
        duration_s = round(total_words / 5.25 + len(segs) * pause_after, 1)

    total_frames = max(0, round(duration_s * 30))

    design_cache = jload("qa/design/cache.json")
    design_cached = len(design_cache) if isinstance(design_cache, dict) else 0

    qa_cache = jload("qa/cache.json")
    contact_cached = len(qa_cache.get("contact", {})) if isinstance(qa_cache, dict) and isinstance(qa_cache.get("contact"), dict) else 0

    chunk_dir = ROOT / "out" / "_chunks"
    chunks_cached = 0
    if chunk_dir.is_dir():
        chunks_cached = sum(1 for p in chunk_dir.glob("*.mp4") if p.is_file() and p.stat().st_size > 0)

    hot = jload("qa/hot.json")
    hot_shots = len(hot) if isinstance(hot, dict) else 0

    return {
        "is_16x9": is_16x9,
        "format": fmt,
        "length": length,
        "sla_budget_min": sla_min,
        "counts": {
            "segments": len(segs),
            "shots": n_shots,
            "duration_s": round(duration_s, 2),
            "total_frames": total_frames,
            "design_cached": design_cached,
            "contact_cached": contact_cached,
            "chunks_cached": chunks_cached,
            "hot_shots": hot_shots,
        },
    }


def check_g1() -> dict:
    t0 = time.perf_counter()
    blocking: list[str] = []
    warnings: list[str] = []
    fixes: list[str] = []

    brief_path = ROOT / "brief.md"
    if not brief_path.is_file():
        blocking.append("brief.md is missing")
        fixes.append("Create brief.md with all 8 required sections (Archetype..Not copying)")
        return {
            "name": STAGE_NAMES["G1"],
            "status": "fail",
            "blocking": blocking,
            "warnings": warnings,
            "fixes": fixes,
            "metrics": {"exists": False, "missing_sections": len(BRIEF_REQUIRED_SECTIONS), "todo_count": 0},
            "elapsed_s": round(time.perf_counter() - t0, 3),
        }

    txt = brief_path.read_text(encoding="utf-8", errors="ignore")
    missing = [h for h in BRIEF_REQUIRED_SECTIONS if h not in txt]
    todo_count = len(re.findall(r"\bTODO\b", txt))
    if not txt.strip():
        blocking.append("brief.md is empty")
    if missing:
        blocking.append(f"brief.md missing section(s): {', '.join(missing)}")
    if todo_count > 0:
        blocking.append(f"brief.md still contains {todo_count} TODO placeholder(s)")
    if blocking:
        fixes.append("Fill missing sections and remove all TODO placeholders in brief.md")

    return {
        "name": STAGE_NAMES["G1"],
        "status": "pass" if not blocking else "fail",
        "blocking": blocking,
        "warnings": warnings,
        "fixes": fixes,
        "metrics": {
            "exists": True,
            "sections_present": len(BRIEF_REQUIRED_SECTIONS) - len(missing),
            "sections_required": len(BRIEF_REQUIRED_SECTIONS),
            "missing_sections": missing,
            "todo_count": todo_count,
        },
        "elapsed_s": round(time.perf_counter() - t0, 3),
    }


def check_g2(script: dict | None) -> dict:
    t0 = time.perf_counter()
    blocking: list[str] = []
    warnings: list[str] = []
    fixes: list[str] = []
    metrics: dict = {}

    if not (ROOT / "script.json").is_file():
        blocking.append("script.json is missing")
        fixes.append("Author script.json + beats.md, then run: python3 scripts/script_lint.py")
        return {
            "name": STAGE_NAMES["G2"],
            "status": "fail",
            "blocking": blocking,
            "warnings": warnings,
            "fixes": fixes,
            "metrics": {"script_exists": False},
            "elapsed_s": round(time.perf_counter() - t0, 3),
        }

    lint_script = _pick_script("script_lint.py")
    if lint_script is None:
        blocking.append("scripts/script_lint.py not found")
    else:
        code, out, err = run_cmd([sys.executable, str(lint_script)])
        combined = "\n".join(x for x in (out, err) if x).strip()
        err_lines = [l for l in combined.splitlines() if l.startswith("ERROR")]
        warn_lines = [l for l in combined.splitlines() if l.startswith("WARN")]
        metrics["script_lint_exit"] = code
        metrics["script_lint_errors"] = len(err_lines)
        metrics["script_lint_warnings"] = len(warn_lines)
        if code != 0:
            if err_lines:
                blocking.extend(err_lines[:10])
                if len(err_lines) > 10:
                    blocking.append(f"... +{len(err_lines) - 10} more script_lint error(s)")
            else:
                blocking.append(f"script_lint.py exited {code}: {combined[-240:]}")
            fixes.append("Fix script.json / beats.md errors and re-run: python3 scripts/script_lint.py")
        if warn_lines:
            warnings.extend(warn_lines[:8])
            if len(warn_lines) > 8:
                warnings.append(f"... +{len(warn_lines) - 8} more script_lint warning(s)")

    is_long_16x9 = isinstance(script, dict) and script.get("length") == "long_16x9"
    metrics["requires_story_doctor"] = is_long_16x9
    if is_long_16x9:
        sd = jload("qa/story_doctor.json")
        if not isinstance(sd, dict):
            blocking.append("qa/story_doctor.json missing (required for long_16x9 before passing G2)")
            fixes.append("Run independent Adversarial Story Doctor audit -> qa/story_doctor.json (score >= 80, verdict='pass')")
            metrics["story_doctor_ok"] = False
        else:
            sd_issues: list[str] = []
            cur_sha = sha16("script.json")
            if sd.get("script_sha") != cur_sha:
                sd_issues.append("qa/story_doctor.json script_sha does not match current script.json")
            if sd.get("verdict") != "pass":
                sd_issues.append(f"qa/story_doctor.json verdict={sd.get('verdict')!r} (expected 'pass')")
            try:
                score = float(sd.get("score", 0))
            except (TypeError, ValueError):
                score = 0.0
            if score < 80:
                sd_issues.append(f"qa/story_doctor.json score={score:g} < 80")
            reviewer = str(sd.get("reviewer") or "").strip()
            if not reviewer or reviewer.lower() in ("author", "builder"):
                sd_issues.append("qa/story_doctor.json reviewer missing or is author/builder")
            meandering = sd.get("meandering_stretches", [])
            if not isinstance(meandering, list) or len(meandering) != 0:
                n_m = len(meandering) if isinstance(meandering, list) else "invalid"
                sd_issues.append(f"qa/story_doctor.json has {n_m} unresolved meandering_stretches")
            metrics["story_doctor_ok"] = len(sd_issues) == 0
            metrics["story_doctor_score"] = score
            if sd_issues:
                blocking.extend(sd_issues)
                fixes.append("Tighten script and re-run independent Adversarial Story Doctor -> qa/story_doctor.json")

    return {
        "name": STAGE_NAMES["G2"],
        "status": "pass" if not blocking else "fail",
        "blocking": blocking,
        "warnings": warnings,
        "fixes": list(dict.fromkeys(fixes)),
        "metrics": metrics,
        "elapsed_s": round(time.perf_counter() - t0, 3),
    }


def check_g3(script: dict | None) -> dict:
    t0 = time.perf_counter()
    blocking: list[str] = []
    warnings: list[str] = []
    fixes: list[str] = []
    metrics: dict = {}

    if not (ROOT / "script.json").is_file():
        blocking.append("script.json is missing")
        fixes.append("Author script.json before running pre-TTS sanitizer")
        return {
            "name": STAGE_NAMES["G3"],
            "status": "fail",
            "blocking": blocking,
            "warnings": warnings,
            "fixes": fixes,
            "metrics": {"script_exists": False},
            "elapsed_s": round(time.perf_counter() - t0, 3),
        }

    voice_script = _pick_script("voice.py", require_text="--preflight")
    if voice_script is None:
        blocking.append("voice.py with --preflight not found")
    else:
        code, out, err = run_cmd([sys.executable, str(voice_script), "--preflight", "--json"])
        parsed = None
        try:
            parsed = json.loads(out)
        except Exception:
            parsed = None
        if isinstance(parsed, dict):
            metrics["segments"] = parsed.get("segments", 0)
            metrics["sentences"] = parsed.get("sentences", 0)
            metrics["preflight_errors"] = parsed.get("error_count", 0)
            metrics["preflight_warnings"] = parsed.get("warning_count", 0)
            metrics["unwrapped_english"] = parsed.get("unwrapped_english", [])
            for e in parsed.get("errors", [])[:12]:
                blocking.append(f"[{e.get('seg')}] ({e.get('code')}): {e.get('message')}")
            if len(parsed.get("errors", [])) > 12:
                blocking.append(f"... +{len(parsed['errors']) - 12} more preflight error(s)")
            for w in parsed.get("warnings", [])[:12]:
                warnings.append(f"[{w.get('seg')}] ({w.get('code')}): {w.get('message')}")
            if len(parsed.get("warnings", [])) > 12:
                warnings.append(f"... +{len(parsed['warnings']) - 12} more preflight warning(s)")
            if blocking:
                fixes.append("Fix blocking script.json TTS issues (digits/tags/empty text), then verify: python3 scripts/voice.py --preflight")
            elif warnings:
                fixes.append("Review pre-TTS warnings (wrap English in <en> or 'english', split long sentences >24 words) before TTS")
        elif code != 0:
            blocking.append(f"voice.py --preflight failed (exit {code}): {(err or out)[-240:]}")
            fixes.append("Run python3 scripts/voice.py --preflight to inspect script text")

    # Supplemental >24-word pacing check (25..26 words not already warned by >26 check in voice.py)
    if isinstance(script, dict):
        over_24 = []
        for seg in script.get("segments", []):
            if not isinstance(seg, dict):
                continue
            sid = str(seg.get("id", "?"))
            raw = seg.get("tts_text", seg.get("text", ""))
            parts = [x.strip() for x in SENT_SPLIT_RE.split(re.sub(r"\.{3,}", "…", str(raw).strip())) if x.strip()]
            for j, part in enumerate(parts, 1):
                wc = len(_strip_markup(part).split())
                if 24 < wc <= 26:
                    over_24.append(f"{sid}.{j} ({wc}w)")
        metrics["sentences_25_to_26w"] = len(over_24)
        if over_24:
            warnings.append(f"{len(over_24)} sentence(s) 25-26 words (near breath limit >24w): {', '.join(over_24[:6])}")

    # Voice synthesis sync status (informational for preflight + drives SLA ETA)
    vr = jload("qa/voice_report.json")
    cur_sha = sha16("script.json")
    if isinstance(vr, dict):
        synced = (
            vr.get("script_sha") == cur_sha
            and not vr.get("failed_lines")
            and not vr.get("stale_lines")
            and (ROOT / "audio" / "voice.wav").is_file()
        )
        metrics["voice_generated"] = True
        metrics["voice_synced"] = synced
        if vr.get("script_sha") != cur_sha:
            warnings.append("qa/voice_report.json script_sha is stale vs current script.json — re-run voice.py")
        if vr.get("failed_lines"):
            warnings.append(f"qa/voice_report.json has failed_lines: {list(vr['failed_lines'].keys())[:8]}")
        if vr.get("stale_lines"):
            warnings.append(f"qa/voice_report.json has stale_lines: {vr['stale_lines'][:8]}")
    else:
        metrics["voice_generated"] = False
        metrics["voice_synced"] = False

    return {
        "name": STAGE_NAMES["G3"],
        "status": "pass" if not blocking else "fail",
        "blocking": blocking,
        "warnings": warnings,
        "fixes": list(dict.fromkeys(fixes)),
        "metrics": metrics,
        "elapsed_s": round(time.perf_counter() - t0, 3),
    }


def check_g4() -> dict:
    t0 = time.perf_counter()
    blocking: list[str] = []
    warnings: list[str] = []
    fixes: list[str] = []
    metrics: dict = {}

    has_cast = (ROOT / "src/episode/cast.ts").is_file()
    metrics["has_cast_ts"] = has_cast
    if not has_cast:
        blocking.append("src/episode/cast.ts is missing")
        fixes.append("Author src/episode/cast.ts + sets.tsx, then run: node scripts/lint.mjs design")
    elif (ROOT / "scripts/lint.mjs").is_file():
        code, out, err = run_cmd(["node", "scripts/lint.mjs", "design"])
        combined = "\n".join(x for x in (out, err) if x).strip()
        err_lines = [l for l in combined.splitlines() if l.startswith("ERROR")]
        warn_lines = [l for l in combined.splitlines() if l.startswith("WARN")]
        metrics["design_lint_exit"] = code
        metrics["design_lint_errors"] = len(err_lines)
        metrics["design_lint_warnings"] = len(warn_lines)
        if code != 0:
            if err_lines:
                blocking.extend(err_lines[:10])
                if len(err_lines) > 10:
                    blocking.append(f"... +{len(err_lines) - 10} more design lint error(s)")
            else:
                blocking.append(f"node scripts/lint.mjs design exited {code}: {combined[-240:]}")
            fixes.append("Fix design lint errors and re-run: node scripts/lint.mjs design")
        if warn_lines:
            warnings.extend(warn_lines[:8])
            if len(warn_lines) > 8:
                warnings.append(f"... +{len(warn_lines) - 8} more design lint warning(s)")
    else:
        warnings.append("scripts/lint.mjs not found — skipped static design lint")

    # Inspect qa/design/plate_stats.json for perceptual quality flags
    pstats = jload("qa/design/plate_stats.json")
    if isinstance(pstats, dict) and pstats:
        perceptual_flags = []
        legacy_plates = []
        for sid, info in pstats.items():
            if not isinstance(info, dict):
                continue
            if "clutter_max_3x3" not in info:
                legacy_plates.append(sid)
            qflags = list(info.get("quality_flags") or [])
            if not qflags:
                # Re-check thresholds if fields exist without quality_flags list
                if info.get("clutter_max_3x3", 0) > 16.0:
                    qflags.append(f"clutter_max_3x3={info['clutter_max_3x3']}% > 16.0%")
                if info.get("contrast_std") is not None and info["contrast_std"] < 22.0:
                    qflags.append(f"contrast_std={info['contrast_std']} < 22.0")
                if info.get("lr_balance_delta", 0) > 7.5:
                    qflags.append(f"lr_balance_delta={info['lr_balance_delta']}% > 7.5%")
            for fl in qflags:
                perceptual_flags.append(f"set '{sid}': {fl}")
        metrics["plates_measured"] = len(pstats)
        metrics["plate_perceptual_flags"] = len(perceptual_flags)
        if perceptual_flags:
            warnings.extend(perceptual_flags[:10])
            fixes.append("Rebalance cluttered/flat/lopsided set plate(s) in src/episode/sets.tsx and re-run: node scripts/design.mjs --changed")
        if legacy_plates:
            warnings.append(f"{len(legacy_plates)} plate(s) lack v4.3 perceptual stats — re-run plate_check.py on qa/design/set_*.png")
    else:
        metrics["plates_measured"] = 0
        metrics["plate_perceptual_flags"] = 0
        warnings.append("qa/design/plate_stats.json missing — run node scripts/design.mjs to render & measure set plates")

    # Verify SUBJECTS sheets against qa/design/visual_spec.json
    vs = jload("qa/design/visual_spec.json")
    subjects_spec = vs.get("subjects") if isinstance(vs, dict) else None
    if isinstance(subjects_spec, dict) and subjects_spec:
        missing_subj = [
            sid for sid in sorted(subjects_spec.keys())
            if not (ROOT / "qa/design" / f"subject_{sid}.png").is_file()
        ]
        metrics["subjects_registered"] = len(subjects_spec)
        metrics["subjects_sheets_missing"] = missing_subj
        if missing_subj:
            blocking.append(f"missing SUBJECTS design sheet(s): {', '.join(f'qa/design/subject_{s}.png' for s in missing_subj)}")
            fixes.append("Run: node scripts/design.mjs --only subjects")
    else:
        metrics["subjects_registered"] = 0
        metrics["subjects_sheets_missing"] = []
        if (ROOT / "src/episode/subjects.tsx").is_file():
            try:
                subj_txt = (ROOT / "src/episode/subjects.tsx").read_text(encoding="utf-8", errors="ignore")
                if "SUBJECTS" in subj_txt and not vs:
                    warnings.append("qa/design/visual_spec.json missing — run node scripts/design.mjs to generate SUBJECTS sheets")
            except OSError:
                pass

    # Summarize primary locations & location pack sheets from qa/design/visual_spec.json (informational)
    sets_spec = vs.get("sets") if isinstance(vs, dict) else None
    if isinstance(sets_spec, dict) and sets_spec:
        loc_groups: dict[str, list[str]] = {}
        for sid, info in sets_spec.items():
            if not isinstance(info, dict):
                continue
            if info.get("insert") or info.get("shotScale") == "insert":
                continue
            loc = str(info.get("location") or "").strip()
            if not loc:
                continue
            loc_groups.setdefault(loc, []).append(sid)
        locs_3plus = sum(1 for sids in loc_groups.values() if len(sids) >= 3)
        pack_sheets: list[str] = []
        for loc, sids in sorted(loc_groups.items()):
            if len(sids) < 2:
                continue
            slug_lo = re.sub(r"[^a-z0-9_-]+", "_", loc.lower()).strip("_")
            slug_raw = re.sub(r"[^a-zA-Z0-9_-]+", "_", loc).strip("_")
            for slug in dict.fromkeys(s for s in (slug_lo, slug_raw) if s):
                cand = ROOT / "qa/design" / f"location_{slug}_pack.jpg"
                if cand.is_file():
                    pack_sheets.append(f"qa/design/location_{slug}_pack.jpg")
                    break
        metrics["primary_locations"] = len(loc_groups)
        metrics["locations_with_3plus_angles"] = locs_3plus
        metrics["location_pack_sheets"] = pack_sheets

    return {
        "name": STAGE_NAMES["G4"],
        "status": "pass" if not blocking else "fail",
        "blocking": blocking,
        "warnings": warnings,
        "fixes": list(dict.fromkeys(fixes)),
        "metrics": metrics,
        "elapsed_s": round(time.perf_counter() - t0, 3),
    }


def check_g5() -> dict:
    t0 = time.perf_counter()
    blocking: list[str] = []
    warnings: list[str] = []
    fixes: list[str] = []
    metrics: dict = {}

    has_shotlist = (ROOT / "src/episode/shotlist.ts").is_file()
    metrics["has_shotlist_ts"] = has_shotlist
    if not has_shotlist:
        blocking.append("src/episode/shotlist.ts is missing")
        fixes.append("Author src/episode/shotlist.ts, then run: node scripts/lint.mjs shots")
    elif (ROOT / "scripts/lint.mjs").is_file():
        code, out, err = run_cmd(["node", "scripts/lint.mjs", "shots"])
        combined = "\n".join(x for x in (out, err) if x).strip()
        err_lines = [l for l in combined.splitlines() if l.startswith("ERROR")]
        warn_lines = [l for l in combined.splitlines() if l.startswith("WARN")]
        metrics["shots_lint_exit"] = code
        metrics["shots_lint_errors"] = len(err_lines)
        metrics["shots_lint_warnings"] = len(warn_lines)
        if code != 0:
            if err_lines:
                blocking.extend(err_lines[:10])
                if len(err_lines) > 10:
                    blocking.append(f"... +{len(err_lines) - 10} more shot lint error(s)")
            else:
                blocking.append(f"node scripts/lint.mjs shots exited {code}: {combined[-240:]}")
            fixes.append("Fix shotlist errors and re-run: node scripts/lint.mjs shots")
        if warn_lines:
            warnings.extend(warn_lines[:8])
            if len(warn_lines) > 8:
                warnings.append(f"... +{len(warn_lines) - 8} more shot lint warning(s)")
    else:
        warnings.append("scripts/lint.mjs not found — skipped static shot lint")

    # Parse qa/layout_report.json
    lr = jload("qa/layout_report.json")
    if isinstance(lr, list):
        overcrowded_shots = []
        crowded_shots = []
        scale_err_shots = []
        cutoff_err_shots = []
        max_occ = 0.0
        for row in lr:
            if not isinstance(row, dict):
                continue
            idx = row.get("i")
            gl = row.get("gridLayout") or {}
            oc = gl.get("overcrowdedCells") or []
            cr = gl.get("crowdedCells") or []
            occ = float(gl.get("occupancyFrac") or 0.0)
            if occ > max_occ:
                max_occ = occ
            if oc:
                overcrowded_shots.append(f"#{idx}({','.join(map(str, oc))})")
            if cr:
                crowded_shots.append(f"#{idx}({','.join(map(str, cr))})")
            si = row.get("scaleIssues") or []
            if si:
                scale_err_shots.append(f"#{idx}({len(si)})")
            ci = row.get("creatureCutoffIssues") or []
            if ci:
                cutoff_err_shots.append(f"#{idx}({len(ci)})")
        metrics["layout_shots"] = len(lr)
        metrics["overcrowded_shots"] = len(overcrowded_shots)
        metrics["crowded_shots"] = len(crowded_shots)
        metrics["scale_issue_shots"] = len(scale_err_shots)
        metrics["cutoff_issue_shots"] = len(cutoff_err_shots)
        metrics["max_occupancy_frac"] = round(max_occ, 3)
        if overcrowded_shots:
            warnings.append(f"layout overcrowded cells in {len(overcrowded_shots)} shot(s): {', '.join(overcrowded_shots[:8])}")
        if scale_err_shots:
            warnings.append(f"layout scale issues in {len(scale_err_shots)} shot(s): {', '.join(scale_err_shots[:8])}")
        if cutoff_err_shots:
            warnings.append(f"layout creature cutoff issues in {len(cutoff_err_shots)} shot(s): {', '.join(cutoff_err_shots[:8])}")
    else:
        metrics["layout_shots"] = 0
        warnings.append("qa/layout_report.json missing — run node scripts/lint.mjs shots")

    # Parse qa/hot.json
    hot = jload("qa/hot.json")
    if isinstance(hot, dict):
        rule_counts: Counter = Counter()
        for reasons in hot.values():
            if isinstance(reasons, list):
                rule_counts.update(str(x) for x in reasons)
        metrics["hot_shots"] = len(hot)
        metrics["hot_rules"] = dict(rule_counts.most_common(8))
        if hot:
            top = ", ".join(f"{k}:{v}" for k, v in rule_counts.most_common(6))
            warnings.append(f"qa/hot.json lists {len(hot)} HOT shot(s) requiring crops ({top})")
    else:
        metrics["hot_shots"] = 0
        metrics["hot_rules"] = {}

    return {
        "name": STAGE_NAMES["G5"],
        "status": "pass" if not blocking else "fail",
        "blocking": blocking,
        "warnings": warnings,
        "fixes": list(dict.fromkeys(fixes)),
        "metrics": metrics,
        "elapsed_s": round(time.perf_counter() - t0, 3),
    }


def check_g6() -> dict:
    t0 = time.perf_counter()
    blocking: list[str] = []
    warnings: list[str] = []
    fixes: list[str] = []

    has_audio_plan = (ROOT / "audio.json").is_file()
    has_timing = (ROOT / "qa/timing.json").is_file()
    has_voice_wav = (ROOT / "audio/voice.wav").is_file()

    if not has_audio_plan:
        blocking.append("audio.json is missing")
        fixes.append("Create audio.json (theme/beds/sfx plan)")
    elif jload("audio.json") is None:
        blocking.append("audio.json is not valid JSON")
        fixes.append("Fix JSON syntax in audio.json")

    if not has_timing:
        blocking.append("qa/timing.json is missing")
        fixes.append("Run: node scripts/times.mjs")

    if not has_voice_wav:
        blocking.append("audio/voice.wav is missing")
        fixes.append("Run VieNeu voice synthesis: scripts/voice.py")

    voice_sha = sha16("audio/voice.wav")
    plan_sha = sha16("audio.json")
    timing_sha = sha16("qa/timing.json")
    targets_sha = sha16("standards/mix_targets.json")

    mr = jload("qa/mix_report.json")
    mix_synced = False
    if isinstance(mr, dict):
        inp = mr.get("inputs") or {}
        stale_inputs = []
        if voice_sha and inp.get("voice") != voice_sha:
            stale_inputs.append("audio/voice.wav")
        if plan_sha and inp.get("plan") != plan_sha:
            stale_inputs.append("audio.json")
        if timing_sha and inp.get("timing") and inp.get("timing") != timing_sha:
            stale_inputs.append("qa/timing.json")
        if targets_sha and inp.get("targets") and inp.get("targets") != targets_sha:
            stale_inputs.append("standards/mix_targets.json")
        if stale_inputs:
            blocking.append(f"qa/mix_report.json out of sync with: {', '.join(stale_inputs)}")
            fixes.append("Re-run audio mix: /Users/Shared/Tools/VieNeu-TTS/.venv/bin/python scripts/mix.py")
        else:
            mix_synced = bool(has_audio_plan and has_timing and has_voice_wav)
        qa_checks = (mr.get("qa") or {}).get("checks") or []
        bad_checks = [f"{c.get('group')}.{c.get('check')}={c.get('value')}" for c in qa_checks if not c.get("ok")]
        if bad_checks:
            blocking.append(f"mix QA checks failed: {', '.join(bad_checks[:6])}")
            fixes.append("Adjust audio.json / re-take noisy line and re-run scripts/mix.py")
    else:
        if has_audio_plan and has_timing and has_voice_wav:
            warnings.append("qa/mix_report.json not generated yet — inputs ready for scripts/mix.py")
            fixes.append("Run: /Users/Shared/Tools/VieNeu-TTS/.venv/bin/python scripts/mix.py")

    metrics = {
        "has_audio_json": has_audio_plan,
        "has_timing_json": has_timing,
        "has_voice_wav": has_voice_wav,
        "has_mix_report": isinstance(mr, dict),
        "mix_synced": mix_synced,
    }
    return {
        "name": STAGE_NAMES["G6"],
        "status": "pass" if not blocking else "fail",
        "blocking": blocking,
        "warnings": warnings,
        "fixes": list(dict.fromkeys(fixes)),
        "metrics": metrics,
        "elapsed_s": round(time.perf_counter() - t0, 3),
    }


def check_g7(profile: dict) -> dict:
    t0 = time.perf_counter()
    blocking: list[str] = []
    warnings: list[str] = []
    fixes: list[str] = []

    total_frames = profile["counts"]["total_frames"]
    jpeg_est_gb = round((total_frames * JPEG_MB_PER_FRAME) / 1024.0 + 0.5, 2)
    png_est_gb = round((total_frames * PNG_MB_PER_FRAME) / 1024.0 + 1.5, 2)

    probe_path = Path("/private/var/folders") if Path("/private/var/folders").exists() else ROOT
    free_gb = round(shutil.disk_usage(probe_path).free / (1024.0 ** 3), 2)

    if free_gb < jpeg_est_gb:
        blocking.append(
            f"low disk space: {free_gb:.2f} GB free < ~{jpeg_est_gb:.2f} GB needed for jpeg intermediate ({total_frames} frames)"
        )
        fixes.append("Free disk space before running node scripts/deliver.mjs")
    elif free_gb < png_est_gb:
        warnings.append(
            f"tight disk space for PNG intermediates: {free_gb:.2f} GB free (jpeg ~{jpeg_est_gb:.2f} GB OK; png ~{png_est_gb:.2f} GB)"
        )

    # Scan TMPDIR for orphaned Remotion render/bundle temp directories
    remotion_tmp_prefixes = ("remotion-webpack-bundle-", "remotion-v4-0-", "react-motion-render")
    tmp_remotion_bytes = 0
    tmp_remotion_dirs = 0
    try:
        tmp_root = Path(tempfile.gettempdir())
        if tmp_root.is_dir():
            for entry in tmp_root.iterdir():
                if not entry.name.startswith(remotion_tmp_prefixes):
                    continue
                try:
                    if entry.is_symlink() or not entry.is_dir():
                        continue
                except OSError:
                    continue
                tmp_remotion_dirs += 1
                for dirpath, _dirnames, filenames in os.walk(entry, followlinks=False):
                    for fn in filenames:
                        try:
                            tmp_remotion_bytes += os.lstat(os.path.join(dirpath, fn)).st_size
                        except OSError:
                            pass
    except OSError:
        pass
    tmp_remotion_mb = round(tmp_remotion_bytes / (1024.0 * 1024.0), 1)
    if tmp_remotion_mb >= 300:
        msg = (
            f"Found {tmp_remotion_mb:.0f} MB of stale Remotion temp dirs in TMPDIR — "
            "run bundle_cache cleanup or remove stale remotion-* dirs in $TMPDIR"
        )
        warnings.append(msg)
        fixes.append(msg)

    # Check mix freshness
    mr = jload("qa/mix_report.json")
    has_public_mix = (ROOT / "public/mix.wav").is_file()
    mix_fresh = False
    if not has_public_mix or not isinstance(mr, dict):
        blocking.append("public/mix.wav or qa/mix_report.json missing — G6 mix required before delivery")
        fixes.append("Run scripts/mix.py before node scripts/deliver.mjs")
    else:
        inp = mr.get("inputs") or {}
        v_sha = sha16("audio/voice.wav")
        t_sha = sha16("qa/timing.json")
        s_sha = sha16("qa/shots.json")
        stale = []
        if v_sha and inp.get("voice") != v_sha:
            stale.append("audio/voice.wav")
        if inp.get("timing"):
            if t_sha and inp.get("timing") != t_sha:
                stale.append("qa/timing.json")
        elif inp.get("shots"):
            if s_sha and inp.get("shots") != s_sha:
                stale.append("qa/shots.json")
        if stale:
            blocking.append(f"qa/mix_report.json stale vs {', '.join(stale)} — deliver.mjs will refuse")
            fixes.append("Re-run: node scripts/times.mjs && /Users/Shared/Tools/VieNeu-TTS/.venv/bin/python scripts/mix.py")
        else:
            mix_fresh = True

    final_path = ROOT / "out/final.mp4"
    has_final = final_path.is_file() and final_path.stat().st_size > 0
    dr = jload("qa/deliver_report.json")
    final_fresh = False
    if has_final:
        final_sha = sha16("out/final.mp4")
        if isinstance(dr, dict) and dr.get("final_sha") == final_sha:
            final_fresh = True
        else:
            warnings.append("out/final.mp4 exists but qa/deliver_report.json is missing or out of sync")
    else:
        warnings.append("out/final.mp4 not rendered yet — run node scripts/deliver.mjs when G5 & G6 are green")
        if not blocking:
            fixes.append("Run: node scripts/deliver.mjs")

    metrics = {
        "disk_free_gb": free_gb,
        "tmp_remotion_mb": tmp_remotion_mb,
        "tmp_remotion_dirs": tmp_remotion_dirs,
        "total_frames": total_frames,
        "est_footprint_jpeg_gb": jpeg_est_gb,
        "est_footprint_png_gb": png_est_gb,
        "mix_fresh": mix_fresh,
        "has_final_mp4": has_final,
        "final_fresh": final_fresh,
        "chunks_cached": profile["counts"]["chunks_cached"],
    }
    return {
        "name": STAGE_NAMES["G7"],
        "status": "pass" if not blocking else "fail",
        "blocking": blocking,
        "warnings": warnings,
        "fixes": list(dict.fromkeys(fixes)),
        "metrics": metrics,
        "elapsed_s": round(time.perf_counter() - t0, 3),
    }


def _estimate_remaining_min(profile: dict, stages: dict) -> dict:
    is_16x9 = profile["is_16x9"]
    c = profile["counts"]
    n_segs = c["segments"]
    n_shots = c["shots"]
    total_frames = c["total_frames"]
    design_cached = c["design_cached"]
    contact_cached = c["contact_cached"]
    chunks_cached = c["chunks_cached"]

    est: dict[str, float] = {}

    # G1
    g1 = stages.get("G1")
    g1_done = (g1["status"] == "pass") if g1 else ((ROOT / "brief.md").is_file() and "TODO" not in (ROOT / "brief.md").read_text(encoding="utf-8", errors="ignore"))
    est["G1"] = 0.0 if g1_done else (2.0 if is_16x9 else 1.0)

    # G2
    g2 = stages.get("G2")
    if g2:
        g2_done = g2["status"] == "pass"
    else:
        sl = jload("qa/script_lint.json")
        g2_done = isinstance(sl, dict) and not sl.get("errors")
    est["G2"] = 0.0 if g2_done else (4.0 if is_16x9 else 1.5)

    # G3 (TTS ~2.7s/seg when not synced)
    g3 = stages.get("G3")
    if g3:
        g3_done = g3["status"] == "pass" and bool(g3.get("metrics", {}).get("voice_synced"))
    else:
        vr = jload("qa/voice_report.json")
        g3_done = isinstance(vr, dict) and vr.get("script_sha") == sha16("script.json") and not vr.get("failed_lines") and (ROOT / "audio/voice.wav").is_file()
    est["G3"] = 0.0 if g3_done else round(max(0.3, n_segs * 0.045), 2)

    # G4 (Design sheets ~7s/sheet uncached)
    g4 = stages.get("G4")
    if g4:
        g4_done = g4["status"] == "pass" and g4.get("metrics", {}).get("plates_measured", 0) > 0 and design_cached > 0
    else:
        g4_done = design_cached > 0 and (ROOT / "qa/design/plate_stats.json").is_file()
    if g4_done:
        est["G4"] = 0.0
    else:
        target_sheets = 20 if is_16x9 else 10
        uncached = max(2, target_sheets - design_cached)
        est["G4"] = round(uncached * 0.12, 2)

    # G5 (Contact/cards/strips ~3.6s/uncached shot)
    g5 = stages.get("G5")
    uncached_shots = max(0, n_shots - contact_cached)
    g5_done = ((g5["status"] == "pass") if g5 else True) and n_shots > 0 and uncached_shots == 0
    est["G5"] = 0.0 if g5_done else round(max(0.3, max(uncached_shots, 1 if n_shots == 0 else uncached_shots) * 0.06), 2)

    # G6 (Mix + audio_qa)
    g6 = stages.get("G6")
    if g6:
        g6_done = g6["status"] == "pass" and bool(g6.get("metrics", {}).get("mix_synced"))
    else:
        mr = jload("qa/mix_report.json")
        g6_done = isinstance(mr, dict) and (mr.get("inputs") or {}).get("voice") == sha16("audio/voice.wav")
    est["G6"] = 0.0 if g6_done else (1.2 if is_16x9 else 0.5)

    # G7 (Final render scaled by chunk cache hits)
    g7 = stages.get("G7")
    if g7:
        g7_done = g7["status"] == "pass" and bool(g7.get("metrics", {}).get("final_fresh"))
    else:
        dr = jload("qa/deliver_report.json")
        g7_done = isinstance(dr, dict) and (ROOT / "out/final.mp4").is_file() and dr.get("final_sha") == sha16("out/final.mp4")
    if g7_done:
        est["G7"] = 0.0
    else:
        uncached_frac = 1.0 - min(1.0, chunks_cached / max(1, n_shots)) if n_shots > 0 else 1.0
        dur_s = total_frames / 30.0 if total_frames > 0 else (600.0 if is_16x9 else 145.0)
        rate_min_per_sec = 0.042 if is_16x9 else 0.025
        est["G7"] = round(max(0.3, dur_s * rate_min_per_sec * uncached_frac + 0.3), 2)

    est["total"] = round(sum(est[g] for g in ORDER), 2)
    return est


def print_table(budget: dict, selected: list[str]) -> None:
    c = budget["counts"]
    sla = budget["sla_budget_min"]
    est = budget["estimated_remaining_min"]
    sla_mark = "WITHIN SLA" if budget["within_sla"] else "OVER SLA"
    print(
        f"SV DOCTOR · {budget['format']} ({budget['length']}) · SLA {sla} min · "
        f"Est remaining: {est['total']:.1f} min [{sla_mark}] · doctor {budget['runtime_s']:.2f}s"
    )
    print(
        f"  counts: {c['segments']} segs · {c['shots']} shots · {c['duration_s']}s ({c['total_frames']}f) · "
        f"cache[design={c['design_cached']}, contact={c['contact_cached']}, chunks={c['chunks_cached']}] · hot={c['hot_shots']}"
    )
    print(f"  {'STAGE':<6} {'STATUS':<6} {'ERR':>3} {'WARN':>4} {'ETA':>7}  {'SUMMARY'}")
    print("  " + "-" * 78)
    for g in selected:
        st = budget["stages"][g]
        mark = "PASS" if st["status"] == "pass" else "FAIL"
        n_err = len(st["blocking"])
        n_warn = len(st["warnings"])
        eta_s = f"{est.get(g, 0.0):.1f}m"
        summary = st["blocking"][0] if st["blocking"] else (st["warnings"][0] if st["warnings"] else "ready")
        if len(summary) > 54:
            summary = summary[:51] + "..."
        print(f"  {g:<6} {mark:<6} {n_err:>3} {n_warn:>4} {eta_s:>7}  {summary}")

    any_details = False
    for g in selected:
        st = budget["stages"][g]
        if st["blocking"] or st["fixes"]:
            if not any_details:
                print("\nActionable fixes:")
                any_details = True
            for b in st["blocking"][:4]:
                print(f"  [{g} BLOCK] {b}")
            for fx in st["fixes"][:3]:
                print(f"  [{g} FIX  ] {fx}")
    print(f"\nReport written: {ROOT / 'qa/stage_budget.json'}")


def main() -> None:
    ap = argparse.ArgumentParser(description="Zero-browser deterministic preflight doctor & SLA budget profiler")
    ap.add_argument("--stage", default="all", help="G1|G2|G3|G4|G5|G6|G7|all (default: all)")
    ap.add_argument("--json", action="store_true", help="Print JSON budget report to stdout")
    args = ap.parse_args()

    stage_arg = args.stage.strip().upper()
    if stage_arg == "ALL":
        selected = list(ORDER)
    elif stage_arg in ORDER:
        selected = [stage_arg]
    else:
        raise SystemExit(f"unknown --stage {args.stage!r} (expected G1..G7 or all)")

    t_start = time.perf_counter()
    script = jload("script.json")
    profile = _episode_profile(script)

    runners = {
        "G1": check_g1,
        "G2": lambda: check_g2(script),
        "G3": lambda: check_g3(script),
        "G4": check_g4,
        "G5": check_g5,
        "G6": check_g6,
        "G7": lambda: check_g7(profile),
    }

    stages: dict[str, dict] = {}
    for g in selected:
        stages[g] = runners[g]()

    est = _estimate_remaining_min(profile, stages)
    runtime_s = round(time.perf_counter() - t_start, 3)
    ready = all(stages[g]["status"] == "pass" for g in selected)

    budget = {
        "version": "1.0",
        "generated_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "root": str(ROOT),
        "format": profile["format"],
        "length": profile["length"],
        "sla_budget_min": profile["sla_budget_min"],
        "runtime_s": runtime_s,
        "requested_stage": stage_arg.lower() if stage_arg == "ALL" else stage_arg,
        "ready": ready,
        "counts": profile["counts"],
        "estimated_remaining_min": est,
        "within_sla": est["total"] <= profile["sla_budget_min"],
        "stages": stages,
    }

    qa_dir = ROOT / "qa"
    qa_dir.mkdir(parents=True, exist_ok=True)
    (qa_dir / "stage_budget.json").write_text(json.dumps(budget, ensure_ascii=False, indent=1), encoding="utf-8")

    if args.json:
        print(json.dumps(budget, ensure_ascii=False, indent=1))
    else:
        print_table(budget, selected)

    sys.exit(0 if ready else 1)


if __name__ == "__main__":
    main()
