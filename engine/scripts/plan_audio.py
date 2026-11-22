#!/usr/bin/env python3
"""Deterministic Action-to-Foley Audio Planner (RSI v5.2.0).

Zero-dependency stdlib planner that reads qa/shots.json (and optionally script.json
and src/data/cues.json) in < 0.1 s and derives a synchronized Action-to-Foley Sound
Cue Plan so zero physical actions go silent in G6 (scripts/mix.py):

  - Ambience bed spans (`beds`) grouped across contiguous shots sharing `shot["bed"]`
  - Physical foley cues (`foley_cues`) derived from actors (`path`/`walks`, `arcH`,
    `pushTarget`, `fx`), `reaches`, `keys`, flying `extraEvents`/`extras`, and `over`
  - Suggested `mix.py`-compatible `accents` draft (`{at, fx, kind, why, ...}`)

CLI:
  python3 scripts/plan_audio.py [--dir .] [--out qa/audio_plan_suggested.json] [--write-audio-json]
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import time
from collections import Counter
from pathlib import Path
from typing import Any

SEG_BASE_RE = re.compile(r"^(s\d+[a-z]?)")
MIX_HAS_D = {"whoosh", "buzz", "power_down", "rumble", "paper", "cheer", "horn", "slide"}

# Mapping from derived physical foley cue kind -> (mix.py fx, default gain, default duration or None)
PHYSICAL_ACCENT_MAP: dict[str, tuple[str, float, float | None]] = {
    "jump_whoosh": ("whoosh", 0.65, 0.30),
    "land_thud": ("thump", 0.60, None),
    "effort_scrape": ("slide", 0.55, 0.60),
    "impact_hit": ("thump", 0.85, None),
    "whoosh_fast": ("whoosh", 0.70, 0.28),
    "wing_buzz": ("buzz", 0.45, 0.90),
    "footsteps": ("knock", 0.35, None),
}


def load_json_optional(path: Path) -> Any:
    if not path.is_file():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None


def extract_keyed_strings(raw: Any, default_t: float) -> list[tuple[str, float]]:
    """Normalize a static string or [['val', t], ...] timeline into [(val, t), ...]."""
    out: list[tuple[str, float]] = []
    if isinstance(raw, str) and raw:
        out.append((raw, default_t))
    elif isinstance(raw, list):
        for item in raw:
            if isinstance(item, (list, tuple)) and len(item) >= 2 and isinstance(item[0], str):
                try:
                    out.append((item[0], float(item[1])))
                except (TypeError, ValueError):
                    out.append((item[0], default_t))
            elif isinstance(item, str) and item:
                out.append((item, default_t))
    return out


def format_anchor(t: float, shot_at: str, shot_t0: float, seg_starts: dict[str, float]) -> str:
    """Format an absolute timestamp t into a mix.py tAt()-compatible anchor string."""
    if seg_starts:
        ordered = sorted(seg_starts.items(), key=lambda kv: kv[1])
        chosen_seg, chosen_start = ordered[0]
        for seg, start in ordered:
            if start <= t + 1e-4:
                chosen_seg, chosen_start = seg, start
            else:
                break
        dt = round(t - chosen_start, 2)
        if abs(dt) < 0.005:
            return chosen_seg
        return f"{chosen_seg}{dt:+.2f}"

    m = SEG_BASE_RE.match(shot_at or "")
    base_seg = m.group(1) if m else "s1"
    dt = round(max(0.0, t - shot_t0), 2)
    if abs(dt) < 0.005:
        return base_seg
    return f"{base_seg}+{dt:.2f}"


def derive_bed_spans(shots: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Group contiguous shots with identical ambience bed into time spans."""
    spans: list[dict[str, Any]] = []
    for s in shots:
        bed = str(s.get("bed") or "room")
        t0 = round(float(s.get("t0", 0.0)), 3)
        t1 = round(float(s.get("t1", t0)), 3)
        idx = int(s.get("i", len(spans)))
        if spans and spans[-1]["bed"] == bed:
            spans[-1]["t1"] = max(spans[-1]["t1"], t1)
            spans[-1]["duration"] = round(spans[-1]["t1"] - spans[-1]["t0"], 3)
            spans[-1]["shots"].append(idx)
        else:
            spans.append(
                {
                    "bed": bed,
                    "t0": t0,
                    "t1": t1,
                    "duration": round(max(0.0, t1 - t0), 3),
                    "shots": [idx],
                }
            )
    return spans


def _jump_window(
    path: list[list[float]] | None,
    legs: list[tuple[str, float]],
    t0: float,
    t1: float,
) -> tuple[float, float]:
    jump_times = [tt for lv, tt in legs if lv == "jump"]
    t_jump = jump_times[0] if jump_times else None

    if path and len(path) >= 2:
        if t_jump is not None:
            best_idx = min(range(len(path)), key=lambda k: abs(float(path[k][2]) - t_jump))
            if best_idx + 1 < len(path):
                a, b = float(path[best_idx][2]), float(path[best_idx + 1][2])
            else:
                a, b = float(path[max(0, best_idx - 1)][2]), float(path[best_idx][2])
        else:
            a, b = float(path[0][2]), float(path[-1][2])
        if b < a:
            a, b = b, a
        return a, b

    if t_jump is not None:
        later = [tt for _, tt in legs if tt > t_jump + 0.05]
        end_t = min(t1, later[0]) if later else min(t1, t_jump + 0.85)
        return t_jump, max(t_jump, end_t)

    return t0, t1


def derive_foley_cues(shots: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Derive synchronized physical foley cues from qa/shots.json."""
    cues: list[dict[str, Any]] = []

    for s in shots:
        si = int(s.get("i", 0))
        t0 = float(s.get("t0", 0.0))
        t1 = float(s.get("t1", t0))

        # 1. Actor physical motions & FX
        for a in s.get("actors") or []:
            if not isinstance(a, dict):
                continue
            aid = str(a.get("id") or a.get("look") or "actor")
            legs = extract_keyed_strings(a.get("legs"), t0)
            leg_names = {lv for lv, _ in legs}

            raw_path = a.get("path")
            path: list[list[float]] | None = None
            if (
                isinstance(raw_path, list)
                and len(raw_path) >= 2
                and all(isinstance(wp, (list, tuple)) and len(wp) >= 3 for wp in raw_path)
            ):
                path = [[float(wp[0]), float(wp[1]), float(wp[2])] for wp in raw_path]

            # 1a. Actor walks / runs
            if path is not None:
                p0 = path[0][2]
                p1 = path[-1][2]
                if p1 < p0:
                    p0, p1 = p1, p0
                variant = "run" if "run" in leg_names else "walk"
                cues.append(
                    {
                        "kind": "footsteps",
                        "variant": variant,
                        "t": round(p0, 3),
                        "t0": round(p0, 3),
                        "t1": round(p1, 3),
                        "shot": si,
                        "actor": aid,
                        "source": "actor.path",
                        "why": f"shot #{si} {aid} {variant} ({len(path)} waypoints)",
                    }
                )

            # 1b. Actor parabolic jump (arcH > 0, or legacy legs:'jump' when arcH absent)
            arc_h = a.get("arcH")
            has_arc = isinstance(arc_h, (int, float)) and not isinstance(arc_h, bool) and arc_h > 0
            has_jump_leg = arc_h is None and "jump" in leg_names
            if has_arc or has_jump_leg:
                jt0, jt1 = _jump_window(path, legs, t0, t1)
                t_mid = round((jt0 + jt1) / 2.0, 3)
                t_land = round(jt1, 3)
                arc_note = f"arcH={arc_h}" if has_arc else "legs=jump"
                cues.append(
                    {
                        "kind": "jump_whoosh",
                        "t": t_mid,
                        "t0": round(jt0, 3),
                        "t1": t_land,
                        "shot": si,
                        "actor": aid,
                        "source": "actor.arcH" if has_arc else "actor.legs",
                        "why": f"shot #{si} {aid} jump apex ({arc_note})",
                    }
                )
                cues.append(
                    {
                        "kind": "land_thud",
                        "t": t_land,
                        "shot": si,
                        "actor": aid,
                        "source": "actor.arcH" if has_arc else "actor.legs",
                        "why": f"shot #{si} {aid} jump landing ({arc_note})",
                    }
                )

            # 1c. Actor pushTarget (or legacy legs:'push' when pushTarget absent)
            push_target = a.get("pushTarget")
            has_push_target = isinstance(push_target, (list, tuple)) and len(push_target) >= 2
            has_push_leg = push_target is None and "push" in leg_names
            if has_push_target or has_push_leg:
                push_times = [tt for lv, tt in legs if lv == "push"]
                pt0 = push_times[0] if push_times else t0
                later = [tt for _, tt in legs if tt > pt0 + 0.05]
                pt1 = min(t1, later[0]) if later else t1
                cues.append(
                    {
                        "kind": "effort_scrape",
                        "t": round(pt0, 3),
                        "t0": round(pt0, 3),
                        "t1": round(max(pt0, pt1), 3),
                        "shot": si,
                        "actor": aid,
                        "source": "actor.pushTarget" if has_push_target else "actor.legs",
                        "why": f"shot #{si} {aid} effort push",
                    }
                )

            # 1d. Actor FX ('impact' | 'stars' -> impact_hit; 'speed' -> whoosh_fast)
            fx_raw = a.get("fx")
            fx_list: list[str] = []
            if isinstance(fx_raw, str) and fx_raw:
                fx_list = [fx_raw]
            elif isinstance(fx_raw, list):
                fx_list = [str(x) for x in fx_raw if isinstance(x, str)]
            fx_set = set(fx_list)

            if fx_set & {"impact", "stars"}:
                t_imp = round(min(t1, t0 + 0.15), 3)
                matched = "/".join(sorted(fx_set & {"impact", "stars"}))
                cues.append(
                    {
                        "kind": "impact_hit",
                        "t": t_imp,
                        "shot": si,
                        "actor": aid,
                        "source": "actor.fx",
                        "why": f"shot #{si} {aid} fx={matched}",
                    }
                )
            if "speed" in fx_set:
                t_sp = round(path[0][2], 3) if path else round(min(t1, t0 + 0.10), 3)
                cues.append(
                    {
                        "kind": "whoosh_fast",
                        "t": t_sp,
                        "shot": si,
                        "actor": aid,
                        "source": "actor.fx",
                        "why": f"shot #{si} {aid} fx=speed",
                    }
                )

        # 2. Reaches -> tap_press
        for r in s.get("reaches") or []:
            try:
                tr = float(r["t"]) if isinstance(r, dict) else float(r)
            except (TypeError, ValueError, KeyError):
                continue
            cues.append(
                {
                    "kind": "tap_press",
                    "t": round(tr, 3),
                    "shot": si,
                    "source": "reaches",
                    "why": f"shot #{si} actor reach/tap",
                }
            )

        # 3. Animated set keys -> mech_trigger
        for ke in s.get("keys") or []:
            if not isinstance(ke, dict) or "t" not in ke:
                continue
            try:
                tk = float(ke["t"])
            except (TypeError, ValueError):
                continue
            kname = str(ke.get("key") or "key")
            cues.append(
                {
                    "kind": "mech_trigger",
                    "key": kname,
                    "value": ke.get("value"),
                    "t": round(tk, 3),
                    "shot": si,
                    "source": "keys",
                    "why": f"shot #{si} set key '{kname}'",
                }
            )

        # 4. Flying creatures / extras -> wing_buzz
        rich_extras: list[dict[str, Any]] = []
        seen_ex: set[tuple[str, str]] = set()
        for bucket in (s.get("extraEvents"), s.get("extras")):
            if not isinstance(bucket, list):
                continue
            for item in bucket:
                if not isinstance(item, dict):
                    continue
                sig = (str(item.get("id") or ""), str(item.get("k") or ""))
                if sig != ("", "") and sig in seen_ex:
                    continue
                seen_ex.add(sig)
                rich_extras.append(item)

        for ex in rich_extras:
            alt = ex.get("altitude", 0)
            has_alt = isinstance(alt, (int, float)) and not isinstance(alt, bool) and alt > 0
            poses = extract_keyed_strings(ex.get("pose"), t0)
            pose_names = {p for p, _ in poses}
            is_flying = has_alt or bool(pose_names & {"fly", "hover"})
            if not is_flying:
                continue

            ex_path = ex.get("path")
            if (
                isinstance(ex_path, list)
                and len(ex_path) >= 2
                and all(isinstance(wp, (list, tuple)) and len(wp) >= 3 for wp in ex_path)
            ):
                et0, et1 = float(ex_path[0][2]), float(ex_path[-1][2])
                if et1 < et0:
                    et0, et1 = et1, et0
            else:
                et0 = float(ex.get("t0", t0))
                et1 = float(ex.get("t1", t1))
            ex_label = str(ex.get("id") or ex.get("k") or "creature")
            cues.append(
                {
                    "kind": "wing_buzz",
                    "t": round(et0, 3),
                    "t0": round(et0, 3),
                    "t1": round(max(et0, et1), 3),
                    "shot": si,
                    "extra": ex_label,
                    "source": "extraEvents",
                    "why": f"shot #{si} flying extra '{ex_label}' (alt={alt})",
                }
            )

        # 5. Overlays ('stamp' | 'tag' | 'bubble') -> ui_pop
        for ov in s.get("over") or []:
            if not isinstance(ov, dict):
                continue
            okind = str(ov.get("k") or "")
            if okind not in {"stamp", "tag", "bubble"}:
                continue
            try:
                to = float(ov.get("t", t0))
            except (TypeError, ValueError):
                to = t0
            cues.append(
                {
                    "kind": "ui_pop",
                    "overlay_kind": okind,
                    "text": str(ov.get("text") or ""),
                    "t": round(to, 3),
                    "shot": si,
                    "source": "over",
                    "why": f"shot #{si} overlay {okind}",
                }
            )

    cues.sort(key=lambda c: (float(c["t"]), int(c["shot"]), str(c["kind"])))
    return cues


def build_suggested_accents(
    foley_cues: list[dict[str, Any]],
    shots_by_i: dict[int, dict[str, Any]],
    seg_starts: dict[str, float],
) -> list[dict[str, Any]]:
    """Map top physical foley cues (not already auto-placed by mix.py) into mix.py accents."""
    accents: list[dict[str, Any]] = []
    footstep_shots_used: set[int] = set()
    recent_fx: list[tuple[str, float]] = []

    for cue in foley_cues:
        kind = str(cue["kind"])
        if kind not in PHYSICAL_ACCENT_MAP:
            continue

        si = int(cue["shot"])
        t = float(cue["t"])
        if kind == "footsteps":
            if si in footstep_shots_used:
                continue
            footstep_shots_used.add(si)

        fx_name, gain, default_d = PHYSICAL_ACCENT_MAP[kind]

        # Skip near-duplicate same-fx hits within 0.15 s to keep the mix uncluttered
        if any(prev_fx == fx_name and abs(t - prev_t) < 0.15 for prev_fx, prev_t in recent_fx):
            continue
        recent_fx.append((fx_name, t))

        shot = shots_by_i.get(si, {})
        anchor = format_anchor(t, str(shot.get("at") or ""), float(shot.get("t0", 0.0)), seg_starts)

        entry: dict[str, Any] = {
            "at": anchor,
            "fx": fx_name,
            "kind": kind,
            "g": gain,
            "t": round(t, 3),
            "why": str(cue["why"]),
        }
        if fx_name in MIX_HAS_D:
            if kind in ("wing_buzz", "effort_scrape") and "t0" in cue and "t1" in cue:
                span = max(0.35, min(1.4, float(cue["t1"]) - float(cue["t0"])))
                entry["d"] = round(span, 2)
            elif default_d is not None:
                entry["d"] = default_d
        accents.append(entry)

    return accents


def maybe_write_audio_json(ep_dir: Path, suggested_accents: list[dict[str, Any]]) -> str:
    """Safely populate audio.json accents only if it has no existing custom accents."""
    audio_path = ep_dir / "audio.json"
    if audio_path.is_file():
        try:
            data = json.loads(audio_path.read_text(encoding="utf-8"))
        except Exception as exc:
            return f"skipped (could not parse audio.json: {exc})"
        existing = data.get("accents")
        if isinstance(existing, list) and len(existing) > 0:
            return f"preserved (audio.json already has {len(existing)} custom accents)"
        data["accents"] = suggested_accents
        audio_path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        return f"updated ({len(suggested_accents)} accents written to audio.json)"

    fresh = {
        "_doc": "Episode audio plan (sv-40-audio). Auto-seeded by scripts/plan_audio.py.",
        "music": {"theme": "series", "under_voice_db": 16, "sections": []},
        "keys": {},
        "accents": suggested_accents,
    }
    audio_path.write_text(json.dumps(fresh, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return f"created ({len(suggested_accents)} accents written to audio.json)"


def main() -> int:
    t_start = time.perf_counter()
    ap = argparse.ArgumentParser(
        description="Deterministic Action-to-Foley Audio Planner (RSI v5.2.0)"
    )
    ap.add_argument("--dir", default=".", help="Episode directory (default: .)")
    ap.add_argument(
        "--out",
        default="qa/audio_plan_suggested.json",
        help="Output JSON path (relative to --dir unless absolute; default: qa/audio_plan_suggested.json)",
    )
    ap.add_argument(
        "--write-audio-json",
        action="store_true",
        help="Write suggested accents into audio.json ONLY if audio.json does not already have custom accents",
    )
    args = ap.parse_args()

    ep_dir = Path(args.dir).expanduser().resolve()
    shots_path = ep_dir / "qa" / "shots.json"
    if not shots_path.is_file():
        print(
            f"plan_audio: missing {shots_path} (run `node scripts/times.mjs` first)",
            file=sys.stderr,
        )
        return 1

    try:
        shots = json.loads(shots_path.read_text(encoding="utf-8"))
    except Exception as exc:
        print(f"plan_audio: failed to parse {shots_path}: {exc}", file=sys.stderr)
        return 1

    if not isinstance(shots, list):
        print(f"plan_audio: expected list in {shots_path}", file=sys.stderr)
        return 1

    cues_data = load_json_optional(ep_dir / "src" / "data" / "cues.json")
    script_data = load_json_optional(ep_dir / "script.json")

    seg_starts: dict[str, float] = {}
    if isinstance(cues_data, dict) and isinstance(cues_data.get("seg_starts"), dict):
        for k, v in cues_data["seg_starts"].items():
            try:
                seg_starts[str(k)] = float(v)
            except (TypeError, ValueError):
                pass

    shots_by_i = {int(s.get("i", idx)): s for idx, s in enumerate(shots) if isinstance(s, dict)}
    bed_spans = derive_bed_spans(shots)
    foley_cues = derive_foley_cues(shots)
    suggested_accents = build_suggested_accents(foley_cues, shots_by_i, seg_starts)

    counts = Counter(c["kind"] for c in foley_cues)
    keys_detected = sorted({str(c["key"]) for c in foley_cues if c["kind"] == "mech_trigger" and c.get("key")})

    duration_s = 0.0
    if shots:
        duration_s = round(max(float(s.get("t1", 0.0)) for s in shots if isinstance(s, dict)), 3)
    elif isinstance(cues_data, dict) and isinstance(cues_data.get("total"), (int, float)):
        duration_s = round(float(cues_data["total"]), 3)

    elapsed_ms = round((time.perf_counter() - t_start) * 1000.0, 2)

    plan = {
        "version": "5.2.0",
        "episode": {
            "dir": str(ep_dir),
            "title": script_data.get("title", "") if isinstance(script_data, dict) else "",
            "format": script_data.get("format", "9:16") if isinstance(script_data, dict) else "9:16",
            "length": script_data.get("length", "short") if isinstance(script_data, dict) else "short",
            "shots": len(shots),
            "duration_s": duration_s,
        },
        "summary": {
            "shots": len(shots),
            "bed_spans": len(bed_spans),
            "foley_cues": len(foley_cues),
            "suggested_accents": len(suggested_accents),
            "breakdown": dict(sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))),
            "keys_detected": keys_detected,
            "elapsed_ms": elapsed_ms,
        },
        "beds": bed_spans,
        "foley_cues": foley_cues,
        "suggested_accents": suggested_accents,
    }

    out_path = Path(args.out)
    if not out_path.is_absolute():
        out_path = ep_dir / out_path
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(plan, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    audio_status = "audio.json untouched"
    if args.write_audio_json:
        audio_status = maybe_write_audio_json(ep_dir, suggested_accents)

    elapsed_ms = round((time.perf_counter() - t_start) * 1000.0, 2)
    breakdown_str = ", ".join(
        f"{k}={v}" for k, v in sorted(counts.items(), key=lambda kv: (-kv[1], kv[0]))
    ) or "none"

    print(
        f"plan_audio: {len(shots)} shots · {len(bed_spans)} bed spans · "
        f"{len(foley_cues)} physical foley cues ({breakdown_str}) · {elapsed_ms:.1f} ms"
    )
    print(f"  -> {out_path} ({len(suggested_accents)} suggested accents; {audio_status})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
