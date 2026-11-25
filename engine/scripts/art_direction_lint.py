"""Mandatory Pre-G4 Art Direction Gate (AD-01..AD-06, story-video-skills v6.2).

Validates episode `art_direction.json` before any G4 set/plate authoring begins,
and writes `qa/art_direction_lint.json`.

Usage:
  python scripts/art_direction_lint.py [--json]
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from collections import Counter
from pathlib import Path
from typing import Any

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

REQUIRED_TOP_KEYS = (
    "schema_version",
    "episode_slug",
    "project_style_lock",
    "story_world_elements",
    "layer_architecture",
    "location_matrix",
    "reviewer_rubric",
)

MANDATORY_G4_AXES = (
    "style_cohesion",
    "depth_and_lighting",
    "perspective_and_scale",
    "composition_and_integration",
    "detail_density_and_variety",
    "staging_readability",
    "spatial_continuity",
    "story_and_spoiler_fidelity",
)

VALID_SHOT_SCALES = {"establishing", "medium", "closeup", "insert"}
WIDE_SCALES = {"establishing", "medium"}
TIGHT_SCALES = {"closeup", "insert"}
VALID_CAMERA_ANGLES = {
    "front",
    "reverse",
    "high_3q",
    "macro_top",
    "macro_low",
    "side",
    "top",
    "low",
    "detail",
}
VALID_WEATHER_FX = {"none", "dust_motes", "rain", "fireflies", "petals"}

PLACEHOLDER_RE = re.compile(r"TODO|<placeholder>", re.IGNORECASE)


def _resolve_root() -> Path:
    script_parent = Path(__file__).resolve().parent.parent
    if (
        (script_parent / "art_direction.json").exists()
        or (script_parent / ".episode.json").exists()
        or (script_parent / "brief.md").exists()
    ):
        return script_parent
    return Path.cwd()


def _word_count(text: Any) -> int:
    if not isinstance(text, str):
        return 0
    return len(re.findall(r"\S+", text.strip()))


def _find_placeholders(obj: Any, path: str = "") -> list[str]:
    hits: list[str] = []
    if isinstance(obj, str):
        if PLACEHOLDER_RE.search(obj):
            hits.append(path or "<root>")
    elif isinstance(obj, list):
        for idx, item in enumerate(obj):
            hits.extend(_find_placeholders(item, f"{path}[{idx}]"))
    elif isinstance(obj, dict):
        for k, v in obj.items():
            sub = f"{path}.{k}" if path else str(k)
            if isinstance(k, str) and PLACEHOLDER_RE.search(k):
                hits.append(sub)
            hits.extend(_find_placeholders(v, sub))
    return hits


def _count_brief_locations(brief_text: str) -> int:
    hm = re.search(
        r"^##\s+(?:Locations|Sets|Bối cảnh)\b(.*?)(?=^##\s+|\Z)",
        brief_text,
        re.M | re.S | re.I,
    )
    if not hm:
        return 0
    body = hm.group(1)
    return sum(
        1
        for ln in body.splitlines()
        if re.match(r"^\s*[-*•]\s+\S", ln)
        or re.match(r"^\s*\d+[.)]\s+\S", ln)
        or re.match(
            r"^\s*\|\s*(?!---|#|tên|name|nhân vật|bối cảnh|đạo cụ|id\b)[^|]+\|",
            ln,
            re.I,
        )
    )


def _detect_track(root: Path) -> str:
    ep_path = root / ".episode.json"
    if ep_path.exists():
        try:
            meta = json.loads(ep_path.read_text(encoding="utf-8"))
            if isinstance(meta, dict) and meta.get("track") in ("short", "long"):
                return str(meta["track"])
        except Exception:
            pass
    script_path = root / "script.json"
    if script_path.exists():
        try:
            sc = json.loads(script_path.read_text(encoding="utf-8"))
            if isinstance(sc, dict) and (
                sc.get("length") == "long_16x9" or sc.get("format") == "16:9"
            ):
                return "long"
        except Exception:
            pass
    return "short"


def lint_art_direction(root: Path) -> dict[str, Any]:
    errors: list[str] = []
    warns: list[str] = []
    err = lambda rule, msg: errors.append(f"[{rule}] {msg}")
    warn = lambda rule, msg: warns.append(f"[{rule}] {msg}")

    ad_path = root / "art_direction.json"
    track = _detect_track(root)
    brief_path = root / "brief.md"
    brief_text = brief_path.read_text(encoding="utf-8") if brief_path.exists() else ""
    n_brief_locs = _count_brief_locations(brief_text) if brief_text else 0

    sha: str | None = None
    data: Any = None

    # ---- AD-01: existence, valid JSON, zero TODO/<placeholder>, required top-level keys ----
    if not ad_path.exists():
        err("AD-01", "art_direction.json is missing — author the pre-G4 Art Direction plan before creating sets or plates")
    else:
        raw_bytes = ad_path.read_bytes()
        sha = hashlib.sha256(raw_bytes).hexdigest()
        try:
            data = json.loads(raw_bytes.decode("utf-8"))
        except Exception as exc:
            err("AD-01", f"art_direction.json is not valid UTF-8 JSON: {exc}")
            data = None

    if data is not None:
        if not isinstance(data, dict):
            err("AD-01", "art_direction.json root must be a JSON object")
            data = None
        else:
            missing_top = [k for k in REQUIRED_TOP_KEYS if k not in data]
            if missing_top:
                err("AD-01", f"art_direction.json missing required top-level key(s): {', '.join(missing_top)}")
            if data.get("schema_version") != "6.2":
                err("AD-01", f"schema_version must be '6.2' (got {data.get('schema_version')!r})")
            slug = data.get("episode_slug")
            if not isinstance(slug, str) or not slug.strip():
                err("AD-01", "episode_slug must be a non-empty string")
            ph_hits = _find_placeholders(data)
            if ph_hits:
                sample = ", ".join(ph_hits[:6])
                more = f" (+{len(ph_hits) - 6} more)" if len(ph_hits) > 6 else ""
                err("AD-01", f"unfinished TODO / <placeholder> value(s) in art_direction.json at: {sample}{more}")

    lm: list[Any] = []
    distinct_locs: dict[str, int] = {}
    scale_counts: Counter[str] = Counter()

    if isinstance(data, dict):
        # ---- AD-02: project_style_lock ----
        psl = data.get("project_style_lock")
        if not isinstance(psl, dict):
            err("AD-02", "project_style_lock must be an object")
        else:
            sf = psl.get("style_family")
            if not isinstance(sf, str) or len(sf.strip()) < 3:
                err("AD-02", "project_style_lock.style_family must be a non-empty string (>= 3 chars)")
            for flag in ("flat_2d_riso_characters", "pal_tokens_only", "nhim_canonical_ch11"):
                if psl.get(flag) is not True:
                    err("AD-02", f"project_style_lock.{flag} must be strictly true (got {psl.get(flag)!r})")

        # ---- AD-03 & AD-04: location_matrix coverage and per-sub-scene contract ----
        raw_lm = data.get("location_matrix")
        if not isinstance(raw_lm, list) or len(raw_lm) == 0:
            err("AD-03", "location_matrix must be a non-empty list of sub-scene specs")
        else:
            lm = raw_lm
            seen_ids: set[str] = set()
            loc_counts: Counter[str] = Counter()

            for idx, entry in enumerate(lm):
                tag = f"location_matrix[{idx}]"
                if not isinstance(entry, dict):
                    err("AD-04", f"{tag}: entry must be an object")
                    continue

                sid = entry.get("id")
                if not isinstance(sid, str) or not sid.strip():
                    err("AD-04", f"{tag}: missing non-empty string 'id'")
                    sid_label = tag
                else:
                    sid = sid.strip()
                    sid_label = sid
                    if sid in seen_ids:
                        err("AD-04", f"{sid}: duplicate sub-scene id in location_matrix")
                    seen_ids.add(sid)

                loc = entry.get("location")
                if not isinstance(loc, str) or not loc.strip():
                    err("AD-04", f"{sid_label}: missing non-empty string 'location'")
                else:
                    loc_counts[loc.strip()] += 1

                shot_scale = entry.get("shotScale")
                if not isinstance(shot_scale, str) or shot_scale not in VALID_SHOT_SCALES:
                    err(
                        "AD-04",
                        f"{sid_label}: invalid shotScale {shot_scale!r} (expected one of {sorted(VALID_SHOT_SCALES)})",
                    )
                else:
                    scale_counts[shot_scale] += 1

                cam_angle = entry.get("camera_angle")
                if not isinstance(cam_angle, str) or cam_angle not in VALID_CAMERA_ANGLES:
                    err(
                        "AD-04",
                        f"{sid_label}: invalid camera_angle {cam_angle!r} (expected one of {sorted(VALID_CAMERA_ANGLES)})",
                    )

                hp = entry.get("horizon_and_perspective")
                if _word_count(hp) < 8:
                    err(
                        "AD-04",
                        f"{sid_label}: horizon_and_perspective has {_word_count(hp)} words (need >= 8 words locking horizon, pitch, and human-scale separation)",
                    )

                te = entry.get("terrain_and_edge_transitions")
                if _word_count(te) < 8:
                    err(
                        "AD-04",
                        f"{sid_label}: terrain_and_edge_transitions has {_word_count(te)} words (need >= 8 words locking seamless surface/edge integration)",
                    )

                mood = entry.get("lighting_mood")
                if not isinstance(mood, str) or not mood.strip():
                    err("AD-04", f"{sid_label}: missing non-empty string 'lighting_mood'")

                wfx = entry.get("weather_fx_mode")
                if not isinstance(wfx, str) or wfx not in VALID_WEATHER_FX:
                    err(
                        "AD-04",
                        f"{sid_label}: invalid weather_fx_mode {wfx!r} (must be a single mode from {sorted(VALID_WEATHER_FX)}, never stacked)",
                    )

                req_objs = 12 if shot_scale in WIDE_SCALES else 8
                objs = entry.get("mandatory_objects")
                valid_objs = (
                    [x.strip() for x in objs if isinstance(x, str) and x.strip()]
                    if isinstance(objs, list)
                    else []
                )
                if len(valid_objs) < req_objs:
                    err(
                        "AD-04",
                        f"{sid_label} ({shot_scale or 'unknown'}): mandatory_objects has {len(valid_objs)} item(s) (need >= {req_objs})",
                    )

                lms = entry.get("landmarks")
                valid_lms = (
                    [x.strip() for x in lms if isinstance(x, str) and x.strip()]
                    if isinstance(lms, list)
                    else []
                )
                if len(valid_lms) < 2:
                    err(
                        "AD-04",
                        f"{sid_label}: landmarks has {len(valid_lms)} item(s) (need >= 2 spatial anchors)",
                    )

                guards = entry.get("anti_spoiler_guards")
                valid_guards = (
                    [x.strip() for x in guards if isinstance(x, str) and x.strip()]
                    if isinstance(guards, list)
                    else []
                )
                if len(valid_guards) < 1:
                    err(
                        "AD-04",
                        f"{sid_label}: anti_spoiler_guards must be a non-empty list (explicit concealment rule or 'none: no early concealment required')",
                    )

            distinct_locs = dict(loc_counts)
            for loc_name, cnt in sorted(loc_counts.items()):
                if cnt < 3:
                    err(
                        "AD-03",
                        f"location '{loc_name}' has only {cnt} sub-scene(s) in location_matrix (every distinct location requires >= 3 sub-scenes)",
                    )

            n_dist_locs = len(loc_counts)
            if track == "long":
                if n_dist_locs < 4:
                    err(
                        "AD-03",
                        f"long track has only {n_dist_locs} distinct location(s) in location_matrix (need >= 4)",
                    )
                if len(lm) < 24:
                    err(
                        "AD-03",
                        f"long track has only {len(lm)} sub-scene(s) in location_matrix (need >= 24)",
                    )
            else:
                min_locs = min(3, n_brief_locs) if n_brief_locs > 0 else 1
                if n_dist_locs < min_locs:
                    err(
                        "AD-03",
                        f"short track has only {n_dist_locs} distinct location(s) in location_matrix (need >= {min_locs} based on brief.md ## Locations count={n_brief_locs})",
                    )
                min_sub = max(6, n_dist_locs * 3)
                if len(lm) < min_sub:
                    err(
                        "AD-03",
                        f"short track has only {len(lm)} sub-scene(s) in location_matrix (need >= {min_sub})",
                    )

            has_wide = any(scale_counts[s] > 0 for s in WIDE_SCALES)
            has_tight = any(scale_counts[s] > 0 for s in TIGHT_SCALES)
            if not has_wide or not has_tight:
                missing_s = []
                if not has_wide:
                    missing_s.append("wide (establishing/medium)")
                if not has_tight:
                    missing_s.append("tight (closeup/insert)")
                err(
                    "AD-03",
                    f"location_matrix must include both wide and tight shotScales — missing: {', '.join(missing_s)}",
                )

        # ---- AD-05: story_world_elements & layer_architecture ----
        swe = data.get("story_world_elements")
        if not isinstance(swe, dict):
            err("AD-05", "story_world_elements must be an object")
        else:
            for key in ("lighting_moods", "recurring_motifs", "material_and_organic_rules"):
                val = swe.get(key)
                valid_items = (
                    [x.strip() for x in val if isinstance(x, str) and x.strip()]
                    if isinstance(val, list)
                    else []
                )
                if not valid_items:
                    err("AD-05", f"story_world_elements.{key} must be a non-empty list of strings")

        la = data.get("layer_architecture")
        if not isinstance(la, dict):
            err("AD-05", "layer_architecture must be an object")
        else:
            for key in ("far", "mid", "light_emissive", "fg_staging"):
                val = la.get(key)
                if _word_count(val) < 6:
                    err(
                        "AD-05",
                        f"layer_architecture.{key} has {_word_count(val)} words (need >= 6 words)",
                    )
            asr = la.get("anti_shortcut_rules")
            if not isinstance(asr, list) or len(asr) == 0:
                err("AD-05", "layer_architecture.anti_shortcut_rules must be a non-empty list of rules (>= 6 words each)")
            else:
                for i, rule_txt in enumerate(asr):
                    if _word_count(rule_txt) < 6:
                        err(
                            "AD-05",
                            f"layer_architecture.anti_shortcut_rules[{i}] has {_word_count(rule_txt)} words (need >= 6 words)",
                        )

        # ---- AD-06: reviewer_rubric ----
        rubric = data.get("reviewer_rubric")
        if not isinstance(rubric, dict):
            err("AD-06", "reviewer_rubric must be an object")
        else:
            min_total = rubric.get("min_total")
            if not isinstance(min_total, (int, float)) or isinstance(min_total, bool) or min_total < 82 or min_total > 100:
                err("AD-06", f"reviewer_rubric.min_total must be a number in [82, 100] (got {min_total!r})")
            min_dim = rubric.get("min_dim")
            if not isinstance(min_dim, (int, float)) or isinstance(min_dim, bool) or min_dim < 7 or min_dim > 10:
                err("AD-06", f"reviewer_rubric.min_dim must be a number in [7, 10] (got {min_dim!r})")
            axes = rubric.get("axes")
            if not isinstance(axes, dict):
                err("AD-06", "reviewer_rubric.axes must be an object containing all 8 mandatory scoring axes")
            else:
                for axis in MANDATORY_G4_AXES:
                    if axis not in axes:
                        err("AD-06", f"reviewer_rubric.axes missing mandatory axis '{axis}'")
                    elif _word_count(axes.get(axis)) < 6:
                        err(
                            "AD-06",
                            f"reviewer_rubric.axes.{axis} has {_word_count(axes.get(axis))} words (need >= 6 words of concrete grading criteria)",
                        )

    report = {
        "ok": len(errors) == 0,
        "art_direction_sha": sha,
        "sub_scenes": len(lm),
        "locations": len(distinct_locs),
        "errors": errors,
        "warns": warns,
        "metrics": {
            "track": track,
            "brief_locations": n_brief_locs,
            "distinct_locations": len(distinct_locs),
            "sub_scenes": len(lm),
            "scales": dict(scale_counts),
            "locations_breakdown": distinct_locs,
        },
    }

    qa_dir = root / "qa"
    qa_dir.mkdir(parents=True, exist_ok=True)
    out_path = qa_dir / "art_direction_lint.json"
    out_txt = json.dumps(report, ensure_ascii=False, indent=2)
    out_path.write_text(out_txt, encoding="utf-8")
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description="Lint episode art_direction.json (AD-01..AD-06).")
    parser.add_argument("--json", action="store_true", help="Print JSON report to stdout")
    parser.add_argument("--root", type=str, default=None, help="Optional episode root directory")
    args = parser.parse_args()

    root = Path(args.root).resolve() if args.root else _resolve_root()
    report = lint_art_direction(root)

    if args.json:
        print(json.dumps(report, ensure_ascii=False, indent=2))
    else:
        print(
            f"art_direction: {report['sub_scenes']} sub-scenes across {report['locations']} location(s) "
            f"(track={report['metrics']['track']}, brief_locs={report['metrics']['brief_locations']})"
        )
        for w in report["warns"]:
            print("WARN ", w)
        for e in report["errors"]:
            print("ERROR", e)
        print(f"art_direction lint: {len(report['errors'])} errors, {len(report['warns'])} warnings")

    sys.exit(0 if report["ok"] else 1)


if __name__ == "__main__":
    main()
