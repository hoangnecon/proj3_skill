"""Phase gates G1-G7. A gate passes only when its machine checks pass AND its review file proves someone looked
at every piece of evidence after that evidence was made. Passing appends to gates/log.jsonl with input hashes;
a later change to any input makes the gate (and every gate that depends on it) STALE.

Gates depend on what they read, not on a fixed order (v3.7): design (G4) needs only the brief, so it can pass
while the voice (G3) is still being made; shots (G5) need voice timing AND design.
  G1 <- -    G2 <- G1    G3 <- G2    G4 <- G1    G5 <- G3, G4    G6 <- G3, G5    G7 <- G5, G6

  python3 scripts/sv_doctor.py [--stage G4]  # fast zero-cost preflight before checking/passing a gate
  python3 scripts/sv_gate.py status          # table of all gates (+ episodic units G5.U1..Uk): pass / stale / open
  python3 scripts/sv_gate.py status --brief  # one line per gate + the next command (also writes qa/state.json)
  python3 scripts/sv_gate.py check G4        # run G4's checks, print what is missing (no logging)
  python3 scripts/sv_gate.py pass G4         # check + log the pass (only if everything is green)
  python3 scripts/sv_gate.py check-unit U1   # run sequential episodic unit checks on U1 (no logging)
  python3 scripts/sv_gate.py pass-unit U1    # verify & lock U1 (G5.U1) before building U2 (30s cooldown)
  python3 scripts/sv_gate.py watch [--stall 10]  # STALLED if nothing in the episode moved for N minutes

Review files live in gates/G<n>.review.md (templates are there). Rules every review must satisfy:
  * `verdict: pass` and no TODO / <placeholder> left
  * every evidence file of the gate is named on its own line WITH a remark of >= 4 words after it
  * the review file is newer than every evidence file (you looked after rendering, not before)
  * gates that need the user: `approval: user` and `user_quote: "<the user's words>"`;
    if the user delegated ("cứ làm đi"), `approval: delegated` with that quote.
"""
import hashlib
import importlib.util
import json
import os
import re
import subprocess
import sys
import time
from pathlib import Path

for _st in (sys.stdout, sys.stderr):
    if hasattr(_st, "reconfigure"):
        _st.reconfigure(encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parent.parent
G = ROOT / "gates"
LOG = G / "log.jsonl"
ORDER = ["G1", "G2", "G3", "G4", "G5", "G6", "G7"]
NAMES = {"G1": "premise & brief", "G2": "script & beats", "G3": "voice & timing", "G4": "design: cast + sets",
         "G5": "shots, camera, motion", "G6": "audio mix", "G7": "render & delivery"}
USER_GATES = {"G1", "G2", "G4"}
DEPS = {"G1": [], "G2": ["G1"], "G3": ["G2"], "G4": ["G1"], "G5": ["G3", "G4"], "G6": ["G3", "G5"], "G7": ["G5", "G6"]}
COOLDOWN_S = 60   # between any two passes: gates are reviewed one at a time, not in a batch
UNIT_COOLDOWN_S = 30  # between sequential episodic unit passes (G5.U1 -> G5.U2 -> ...)


PUBLIC_PLATE_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".svg", ".mp4", ".webm"}


def sha(p):
    if p == "public:plates":
        pub = ROOT / "public"
        if not pub.is_dir():
            return "empty"
        h = hashlib.sha256()
        matched = 0
        for f in sorted(pub.rglob("*")):
            if f.is_file() and f.suffix.lower() in PUBLIC_PLATE_EXTS:
                h.update(str(f.relative_to(pub)).replace("\\", "/").encode() + f.read_bytes())
                matched += 1
        return h.hexdigest()[:16] if matched else "empty"
    p = ROOT / p
    if p.is_dir():
        h = hashlib.sha256()
        for f in sorted(p.rglob("*")):
            if f.is_file():
                h.update(f.name.encode() + f.read_bytes())
        return h.hexdigest()[:16]
    return hashlib.sha256(p.read_bytes()).hexdigest()[:16] if p.exists() else "missing"


def jload(p):
    p = ROOT / p
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else None


def run(cmd):
    r = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True, encoding="utf-8", errors="replace")
    return r.returncode, (r.stdout + r.stderr).strip()


# inputs whose change invalidates the gate
INPUTS = {
    "G1": ["brief.md"],
    "G2": ["script.json", "beats.md", "standards/pacing.json", "standards/voice_standard.json"],
    "G3": ["script.json", "audio/voice.wav", "src/data/words.json", "standards/voice_standard.json", "standards/pacing.json"],
    "G4": ["src/episode/cast.ts", "src/episode/sets.tsx", "src/episode/geo.ts", "src/props.tsx", "src/sets", "src/episode/subjects.tsx", "src/subjects.ts", "public:plates"],
    "G5": ["src/episode/shotlist.ts", "src/episode/cast.ts", "src/episode/sets.tsx", "src/data/words.json", "standards/pacing.json", "public:plates"],
    "G6": ["audio.json", "audio/voice.wav", "qa/timing.json", "standards/mix_targets.json", "scripts/theme.py"],
    "G7": ["out/final.mp4"],
}


def evidence(g):
    """files the reviewer must have looked at"""
    if g == "G1":
        return []
    if g == "G2":
        ev = ["qa/script_lint.json"]
        _sc = jload("script.json") or {}
        if _sc.get("length") == "long_16x9":
            ev.append("qa/story_doctor.json")
        return ev
    if g == "G3":
        return ["qa/voice_report.json"]
    if g == "G4":
        d = ROOT / "qa/design"
        return sorted(str(p.relative_to(ROOT)) for p in d.glob("*.png") if "_ex" not in p.name and "ex-" not in p.name and "exemplar" not in p.name) if d.exists() else []
    if g == "G5":
        ev = sorted(str(p.relative_to(ROOT)) for p in (ROOT / "qa").glob("contact_p*.jpg"))
        need = jload("qa/strips_needed.json") or []
        return ev + [f"qa/strips/{s['name']}.jpg" for s in need]
    if g == "G6":
        return ["qa/mix_report.json", "qa/mix/overview.png", "qa/mix/segments.png"]
    if g == "G7":
        return ["qa/deliver_report.json", "qa/final_check.jpg", "qa/video_audio.json"]
    return []


def checks(g):
    """machine checks -> list of problems"""
    bad = []
    if g == "G1":
        b = ROOT / "brief.md"
        txt = b.read_text(encoding="utf-8") if b.exists() else ""
        if not txt or "TODO" in txt:
            bad.append("brief.md missing or has TODO")
        for h in ["## Archetype", "## Premise", "## Spine", "## Why it is funny", "## Characters", "## Locations", "## Ending", "## Not copying"]:
            if h not in txt:
                bad.append(f"brief.md lacks '{h}'")
    elif g == "G2":
        code, out = run([sys.executable, "scripts/script_lint.py"])
        if code:
            bad.append("script lint failed:\n" + "\n".join(l for l in out.splitlines() if l.startswith("ERROR")))
        _sc = jload("script.json") or {}
        if _sc.get("length") == "long_16x9":
            r = jload("qa/story_doctor.json")
            if not isinstance(r, dict):
                bad.append("qa/story_doctor.json missing — run independent Adversarial Story Doctor audit before passing G2 (sv-long-script)")
            else:
                if r.get("script_sha") != sha("script.json"):
                    bad.append("qa/story_doctor.json script_sha does not match current script.json — re-run Adversarial Story Doctor audit")
                if r.get("verdict") != "pass":
                    bad.append(f"qa/story_doctor.json verdict is {r.get('verdict')!r} (must be 'pass')")
                try:
                    score = float(r.get("score", 0))
                except (TypeError, ValueError):
                    score = 0.0
                if score < 80:
                    bad.append(f"qa/story_doctor.json score {score:g} < 80 (100-point script rubric)")
                reviewer = str(r.get("reviewer") or "").strip()
                if not reviewer or reviewer.lower() in ("author", "builder"):
                    bad.append("qa/story_doctor.json reviewer must be present and must not be 'author' or 'builder'")
                meandering = r.get("meandering_stretches", [])
                if not isinstance(meandering, list) or len(meandering) != 0:
                    n_m = len(meandering) if isinstance(meandering, list) else "invalid"
                    bad.append(f"qa/story_doctor.json has {n_m} unresolved meandering_stretches — tighten circular/filler stretches and re-audit")
    elif g == "G3":
        r = jload("qa/voice_report.json")
        if not r:
            bad.append("qa/voice_report.json missing — run scripts/voice.py")
        else:
            if r["voice"] != "Hải Đăng":
                bad.append(f"voice {r['voice']} is not Hải Đăng")
            if r["script_sha"] != sha("script.json"):
                bad.append("script.json changed after the voice was made — re-run voice.py")
            if "failed_lines" not in r:
                bad.append("voice report is from the old best-of-N voice.py — re-run scripts/voice.py (voice standard 1.0)")
                return bad
            for k, f in [("standard_sha", "standards/voice_standard.json"), ("pacing_sha", "standards/pacing.json")]:
                if r[k] != sha(f):
                    bad.append(f"{f} changed after the voice was made — re-run voice.py")
            e = r["engine"]
            rh = r.get("rhythm", {})
            exp_rh = (jload("standards/voice_standard.json") or {}).get("rhythm", {})
            exp_ups = exp_rh.get("target_ups", 5.05)
            exp_pitch = exp_rh.get("pitch_ratio", 1.00)
            if e.get("clone") or e.get("mode") != "per_sentence_rhythm" or e.get("takes") != 1 or rh.get("target_ups") != exp_ups or rh.get("pitch_ratio") != exp_pitch:
                bad.append(f"engine/rhythm settings off-standard: {e} / {rh} (expected target_ups={exp_ups}, pitch_ratio={exp_pitch})")
            for sid, fails in r["failed_lines"].items():
                bad.append(f"{sid} fails {fails} after all attempts — fix its tts_text / sentences (numbers in words, <en>...</en> for English, split a long line), then voice.py --only {sid}")
            if r["stale_lines"]:
                bad.append(f"text changed after these lines were made: {r['stale_lines']} — voice.py --only {','.join(r['stale_lines'])}")
            for c in r["episode_checks"]:
                if not c["ok"]:
                    bad.append(f"{c['group']}.{c['check']} = {c['value']} outside {c['range']}")
            _sc3 = jload("script.json") or {}
            if _sc3.get("length") == "long_16x9":
                _pa3 = jload("standards/pacing.json") or {}
                if "episode_long_16x9" not in _pa3:
                    bad.append("standards/pacing.json missing episode_long_16x9")
    elif g == "G4":
        code, out = run(["node", "scripts/lint.mjs", "design"])
        if code:
            bad.append("design lint failed:\n" + "\n".join(l for l in out.splitlines() if l.startswith("ERROR")))
        if not any((ROOT / "qa/design").glob("cast_episode_p*.png")):
            bad.append("qa/design/cast_episode_p1.png missing — node scripts/design.mjs")
        # by content hash, not file time: only sheets whose inputs changed need a re-render
        code, out = run(["node", "scripts/design.mjs", "--status"])
        try:
            stale = json.loads(out.strip().splitlines()[-1])["stale"]
        except Exception:
            stale = ["(design.mjs --status failed: " + out[-200:] + ")"]
        if stale:
            bad.append(f"design sheets out of date: {stale[:6]}{'...' if len(stale) > 6 else ''} — node scripts/design.mjs --changed")
        if not any("set_" in f and "_grid" in f for f in evidence("G4")):
            bad.append("no episode set plates rendered")
        vs = jload("qa/design/visual_spec.json") or {}
        subjects_spec = vs.get("subjects")
        if isinstance(subjects_spec, dict) and subjects_spec:
            for sid in sorted(subjects_spec.keys()):
                if not (ROOT / f"qa/design/subject_{sid}.png").exists():
                    bad.append(f"qa/design/subject_{sid}.png missing — node scripts/design.mjs")
        # CH-10 waivers (a character that cannot be a <Person>: animal, food-bodied citizen, printed photo) are on no
        # design sheet: the G4 review must name each and say it was compared with the cast sheet (>= 6 words)
        rv = (ROOT / "gates/G4.review.md").read_text(encoding="utf-8") if (ROOT / "gates/G4.review.md").exists() else ""
        for rig in (jload("qa/lint.json") or {}).get("rigs", []):
            line = next((l for l in rv.splitlines() if rig["name"] in l and re.search(r"cast", l, re.I) and "CH-10" in l), None)
            if line is None or len(re.findall(r"\w+", line.split(rig["name"], 1)[1])) < 6:
                bad.append(f"{rig['name']} ({rig['file']}) is drawn outside <Person> (waived CH-10: {rig['reason']}) — open a frame "
                           f"that shows it next to the cast sheet and add a line to gates/G4.review.md: `<name> CH-10: compared with cast_episode_pN … <what you saw>` (>= 6 words)")
    elif g == "G5":
        code, out = run(["node", "scripts/lint.mjs", "shots"])
        if code:
            bad.append("shot lint failed:\n" + "\n".join(l for l in out.splitlines() if l.startswith("ERROR")))
        lr = jload("qa/layout_report.json")
        if isinstance(lr, list):
            overcrowded = [
                e.get("i") for e in lr
                if isinstance(e, dict) and not e.get("la02Waived")
                and ((e.get("gridLayout") or {}).get("overcrowdedCells") or float((e.get("gridLayout") or {}).get("occupancyFrac") or 0) > 0.78)
            ]
            scale_errors = [
                e.get("i") for e in lr
                if isinstance(e, dict) and not e.get("la01Waived") and (e.get("scaleIssues") or [])
            ]
            if overcrowded:
                bad.append(f"qa/layout_report.json has {len(overcrowded)} overcrowded shot(s) {overcrowded[:10]} — declutter or split (LA-02)")
            if scale_errors:
                bad.append(f"qa/layout_report.json has {len(scale_errors)} scale error shot(s) {scale_errors[:10]} — fix actorScale/relToActor (LA-01)")
        elif isinstance(lr, dict):
            if int(lr.get("overcrowded", 0) or 0) > 0:
                bad.append(f"qa/layout_report.json reports overcrowded={lr.get('overcrowded')} — declutter or split (LA-02)")
            if int(lr.get("scale_errors", 0) or 0) > 0:
                bad.append(f"qa/layout_report.json reports scale_errors={lr.get('scale_errors')} — fix actorScale/relToActor (LA-01)")
        ev = evidence("G5")
        if not any("contact_p" in e for e in ev):
            bad.append("no contact sheet — node scripts/qa.mjs contact")
        # by per-shot content hash (qa/cache.json), not file time
        code, out = run(["node", "scripts/qa.mjs", "status"])
        st = jload("qa/qa_status.json") if code == 0 else None
        if not st:
            st = {"contact_stale": ["?"], "strips_stale": [], "hashes": {}}
            bad.append("qa.mjs status failed: " + out[-200:])
        if st["contact_stale"]:
            bad.append(f"contact frames out of date for shots {st['contact_stale'][:15]} — node scripts/qa.mjs contact (re-renders only those)")
        if st["strips_stale"]:
            bad.append(f"strips out of date: {st['strips_stale'][:8]} — node scripts/qa.mjs strips")
        _sc5_units = jload("script.json") or {}
        _decl_units = _sc5_units.get("units")
        if _sc5_units.get("length") == "long_16x9" and isinstance(_decl_units, list) and len(_decl_units) >= 4:
            passed_unit_gates = {
                e.get("gate")
                for e in log_entries()
                if isinstance(e, dict) and str(e.get("gate", "")).startswith("G5.") and e.get("status", "pass") == "pass"
            }
            missing_units = [
                str(u.get("id"))
                for u in _decl_units
                if isinstance(u, dict) and u.get("id") and f"G5.{u['id']}" not in passed_unit_gates
            ]
            if missing_units:
                bad.append(
                    f"episodic unit gate(s) not yet passed: {missing_units} — every unit in script.json must pass "
                    f"sequentially before G5 (next: python scripts/sv_cli.py gate pass G5.{missing_units[0]} --actor <coord_id>)"
                )
        bad += shot_reviews(st)
    elif g == "G6":
        r = jload("qa/mix_report.json")
        if not r:
            bad.append("qa/mix_report.json missing — run scripts/mix.py")
        elif "qa" not in r:
            bad.append("mix report has no measurements — scripts/mix.py runs scripts/audio_qa.py; run it")
        else:
            for c in r["qa"]["checks"]:
                if not c["ok"]:
                    bad.append(f"mix standard: {c['group']}.{c['check']} = {c['value']} outside {c['range']}")
            if r.get("music") != "series-theme":
                bad.append("music is not the series theme (audio.json music.theme = \"series\")")
            if r["processing"].get("voice_peak_limit_max_gr_db") is None:
                bad.append("mix_report.json has no voice peak limit — made by an older mix.py: re-run scripts/mix.py")
            elif r["processing"]["voice_peak_limit_max_gr_db"] > 10:
                bad.append(f"voice peak limiter works {r['processing']['voice_peak_limit_max_gr_db']} dB: a click or pop in a take — find it, re-take the line (sv-core-voice)")
            if r["processing"]["limiter_max_gr_db"] > 6:
                bad.append(f"limiter works too hard ({r['processing']['limiter_max_gr_db']} dB): something in the mix spikes — check sfx/voice peaks")
            if r["warnings"]:
                bad.append(f"mix warnings: {r['warnings'][:3]}")
            for k, f in [("voice", "audio/voice.wav"), ("plan", "audio.json"), ("targets", "standards/mix_targets.json")]:
                if r["inputs"].get(k) != sha(f)[:16]:
                    bad.append(f"{f} changed after the mix — re-run scripts/mix.py")
    elif g == "G7":
        r = jload("qa/deliver_report.json")
        if not r:
            bad.append("qa/deliver_report.json missing — node scripts/deliver.mjs")
        else:
            if abs(r["duration"] - r["expected"]) > 0.15:
                bad.append(f"duration {r['duration']} vs expected {r['expected']}")
            _sc7 = jload("script.json") or {}
            _exp_wh = (1920, 1080) if _sc7.get("format") == "16:9" else (1080, 1920)
            if (r["width"], r["height"]) != _exp_wh or abs(r["fps"] - 30) > 0.01:
                bad.append(f"format {r['width']}x{r['height']}@{r['fps']} (expected {_exp_wh[0]}x{_exp_wh[1]}@30)")
            if not r["audio"]:
                bad.append("no audio stream")
            if r["final_sha"] != sha("out/final.mp4"):
                bad.append("out/final.mp4 changed after the report")
        va = jload("qa/video_audio.json") or {}
        for name in ["final.mp4"]:
            if name not in va:
                bad.append(f"no audio measurement for {name} — deliver.mjs runs audio_qa.py --video")
                continue
            for c in va[name]["checks"]:
                if not c["ok"]:
                    bad.append(f"{name} audio: {c['check']} = {c['value']} outside {c['range']}")
    return bad


_CARRY_MOD = None


def _get_carry():
    global _CARRY_MOD
    if _CARRY_MOD is None:
        p = Path(__file__).resolve().parent / "carry.py"
        spec = importlib.util.spec_from_file_location("carry", p)
        m = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(m)
        _CARRY_MOD = m
    return _CARRY_MOD
# "model" (v3.7): every character comes from the cast rig and matches its cast sheet — v3.6 dropped the
# "same look as the design sheets?" question and a hand-drawn Bình passed 66 reviews
# "continuity" (v6.0): 3-shot spatial distance, event timing vs narration, persistent operator/floor contact
REVIEW_CHECKS = ["acting", "contact", "overlap", "set", "text", "caption", "beat", "model", "continuity"]
REVIEW_CHECKS_16X9 = REVIEW_CHECKS + ["framing", "variety"]


def _audit_v6_logs(stage: str, unit_id: str | None = None) -> list[str]:
    """Enforce v6.0 Log-CI (LG-01..LG-12) when episode uses .episode.json."""
    if not (ROOT / ".episode.json").exists():
        return []
    lint_path = Path(__file__).resolve().parent / "sv_log_lint.py"
    if not lint_path.exists():
        return []
    spec = importlib.util.spec_from_file_location("_sv_log_lint_gate", lint_path)
    mod = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(mod)
    res = mod.audit_logs(ROOT, stage=stage, role="all", unit=unit_id)
    if res.get("ok"):
        return []
    return [
        f"log-ci {e}" if isinstance(e, str) else f"log-ci {e.get('id', e.get('code', ''))}: {e.get('message', e)}"
        for e in res.get("errors", [])
    ]


def shot_reviews(st, only_shots=None, unit_id=None):
    """Per-shot review files qa/review/NN.json (sv-short-production "review cards"). Each must match the shot's CURRENT hash,
    come from a reviewer who is not the builder, answer every check, and — for a HOT shot (geometry lint,
    reach, key event) — say it opened the measurement crops, which must be current."""
    bad, miss, old, notok, thin, nocrop, nomodel, noblind, missing_shot_strip, nostrip_looked, nolooked = (
        [], [], [], [], [], [], [], [], [], [], []
    )
    _sc5 = jload("script.json") or {}
    is_16x9 = _sc5.get("format") == "16:9" or _sc5.get("length") == "long_16x9"
    req_checks = REVIEW_CHECKS_16X9 if is_16x9 else REVIEW_CHECKS
    all_hashes = {int(k): v for k, v in st.get("hashes", {}).items()}
    if only_shots is not None:
        hashes = {i: h for i, h in all_hashes.items() if i in only_shots}
        missing_hash_shots = sorted(i for i in only_shots if i not in hashes)
        if missing_hash_shots:
            bad.append(f"qa/qa_status.json missing hashes for shot(s) {missing_hash_shots[:15]} — run node scripts/qa.mjs pass --unit {unit_id or ''}".strip())
    else:
        hashes = all_hashes
    crops_ok = {int(k): v for k, v in st.get("crops_ok", {}).items()}
    hot = {int(k): v for k, v in (jload("qa/hot.json") or {}).items()}
    manifest = jload("qa/blind_review/manifest.json")
    manifest_shots = {}
    if isinstance(manifest, dict):
        raw_shots = manifest.get("shots")
        if isinstance(raw_shots, list):
            manifest_shots = {int(s["shot"]): s for s in raw_shots if isinstance(s, dict) and "shot" in s}
        elif isinstance(raw_shots, dict):
            manifest_shots = {int(k): v for k, v in raw_shots.items() if isinstance(v, dict)}
    if unit_id:
        unit_pack = jload(f"qa/blind_review/unit_{unit_id}.json")
        if isinstance(unit_pack, dict) and isinstance(unit_pack.get("shots"), list):
            for s in unit_pack["shots"]:
                if isinstance(s, dict) and "shot" in s and int(s["shot"]) not in manifest_shots:
                    manifest_shots[int(s["shot"])] = s
    require_blind = bool(manifest) or (only_shots is not None)
    if only_shots is not None and not manifest_shots:
        bad.append(f"qa/blind_review/manifest.json missing — run node scripts/blind_pack.mjs --unit {unit_id}")
    for i, h in sorted(hashes.items()):
        m_images = (manifest_shots.get(i, {}).get("images") or {}) if require_blind else {}
        shot_strip_path = m_images.get("shot_strip") if isinstance(m_images, dict) else None
        has_motion_strip = bool(shot_strip_path) or bool(isinstance(m_images, dict) and m_images.get("strips"))
        if shot_strip_path and not (ROOT / shot_strip_path).exists():
            missing_shot_strip.append(i)
        r = jload(f"qa/review/{i:02d}.json")
        if not r:
            miss.append(i)
            continue
        carried = False
        if r.get("hash") == h and r.get("carried"):
            # carried across a change that left the picture the same: re-verify from the card snapshots
            if not _get_carry().chain_ok(r, h):
                old.append(i)
                continue
            carried = True
        elif r.get("hash") != h:
            old.append(i)
            continue
        looked = r.get("looked") if isinstance(r.get("looked"), list) else []
        if only_shots is not None and not any(k in looked for k in ("contact", "contact_page", "unit_contact", "card")):
            nolooked.append(i)
        if require_blind and not carried:
            expected_blind = manifest_shots.get(i, {}).get("blind_sha")
            if not expected_blind or r.get("blind_sha") != expected_blind:
                noblind.append(i)
            if has_motion_strip:
                if "shot_strip" not in looked and "strips" not in looked:
                    nostrip_looked.append(i)
        if not r.get("reviewer") or r.get("reviewer") == r.get("builder", "builder") or r.get("reviewer") == "builder":
            bad.append(f"qa/review/{i:02d}.json: reviewer must be named and must not be the builder")
        checks = r.get("checks") or {}
        if "model" not in checks and r.get("verdict") == "ok":
            nomodel.append(i)
        elif r.get("verdict") != "ok" or any(not str(checks.get(c, "")).startswith("ok") for c in req_checks):
            notok.append(i)
        if len(re.findall(r"\w+", str(r.get("note", "")))) < 6:
            thin.append(i)
        if i in hot and ("crops" not in looked or (not crops_ok.get(i) and not carried)):
            nocrop.append(i)
    fmt = lambda xs: f"{xs[:15]}{'...' if len(xs) > 15 else ''}"  # noqa: E731
    unit_flag = f" --unit {unit_id}" if unit_id else ""
    pack_hint = f"qa/blind_review/unit_{unit_id}.json" if unit_id else "qa/blind_review/slice_*.json"
    if miss:
        bad.append(f"no review for shots {fmt(miss)} — node scripts/qa.mjs cards changed{unit_flag}, then a reviewer writes qa/review/NN.json")
    if old:
        bad.append(f"review is for an older version of shots {fmt(old)} (hash changed) — node scripts/qa.mjs cards changed{unit_flag}, "
                   f"python3 scripts/carry.py (keeps reviews whose picture did not change), then re-review the rest")
    if nomodel:
        bad.append(f"shots {fmt(nomodel)} were reviewed without the model check (added v3.7) — a reviewer opens each card next "
                   f"to qa/design/cast_episode_p*_v.jpg and adds checks.model to qa/review/NN.json: every character drawn by the "
                   f"cast rig, same face / hair / outfit / proportions as its sheet (a character drawn as a prop is a fix)")
    if notok:
        extra_hint = " (16:9 requires all 11 checks incl. continuity, framing & variety)" if is_16x9 else " (requires all 9 checks incl. continuity)"
        bad.append(f"shots {fmt(notok)} are not ok in review (verdict/checks{extra_hint}) — fix them (production fix loop), re-review")
    if thin:
        bad.append(f"review note too thin for shots {fmt(thin)} (say what you saw, >= 6 words)")
    if nolooked:
        bad.append(f"shots {fmt(nolooked)} review looked must include 'contact', 'unit_contact', or 'card'")
    if nocrop:
        bad.append(f"HOT shots {fmt(nocrop)} need current crops opened — node scripts/qa.mjs crops <i>, add \"crops\" to looked")
    if noblind:
        bad.append(f"shots {fmt(noblind)} missing or mismatched blind_sha from qa/blind_review/manifest.json — re-review using {pack_hint}")
    if missing_shot_strip:
        bad.append(f"shots {fmt(missing_shot_strip)} declare images.shot_strip in qa/blind_review/manifest.json but qa/shots/NN.jpg is missing — node scripts/qa.mjs shotstrips{unit_flag}")
    if nostrip_looked:
        bad.append(f"shots {fmt(nostrip_looked)} have 8-frame Tiểu đoạn motion strip in qa/blind_review/manifest.json but review looked lacks 'shot_strip' or 'strips' — open qa/shots/NN.jpg and re-review")
    return bad


def review_problems(g):
    p = G / f"{g}.review.md"
    if not p.exists():
        return [f"gates/{g}.review.md missing (copy the template)"]
    txt = p.read_text(encoding="utf-8")
    bad = []
    # a placeholder is <words like this> from a template; inline code and known tags (<en>, <br>) are not
    bare = re.sub(r"`[^`\n]*`", "", txt)
    bare = re.sub(r"</?(en|br|b|i|em|strong|sub|sup)>", "", bare)
    # "<what you saw>" is a placeholder; "x < 5 and y > 3" is not (a placeholder hugs its brackets)
    if re.search(r"TODO|<[^\s<>=][^<>\n]{0,38}[^\s<>=]>", bare):
        bad.append(f"{g}.review.md still has TODO or <placeholder>")
    if not re.search(r"^verdict:\s*pass\s*$", txt, re.M):
        bad.append(f"{g}.review.md: no line 'verdict: pass'")
    if g in USER_GATES:
        ap = re.search(r"^approval:\s*(user|delegated)\s*$", txt, re.M)
        q = re.search(r'^user_quote:\s*"(.{4,})"\s*$', txt, re.M)
        if not ap or not q:
            bad.append(f"{g} needs the user's OK: 'approval: user|delegated' and 'user_quote: \"...\"' (their actual words)")
    rt = p.stat().st_mtime
    for f in evidence(g):
        line = next((l for l in txt.splitlines() if Path(f).name in l), None)
        if line is None:
            bad.append(f"{g}.review.md does not mention {Path(f).name}")
            continue
        remark = line.split(Path(f).name, 1)[1]
        if len(re.findall(r"\w+", remark)) < 4:
            bad.append(f"{g}.review.md: remark on {Path(f).name} is too thin (say what you saw, >= 4 words)")
        fp = ROOT / f
        if fp.exists() and fp.stat().st_mtime > rt:
            bad.append(f"{Path(f).name} is newer than {g}.review.md — look at the new evidence and update the review")
    return bad


def log_entries():
    if not LOG.exists():
        return []
    return [json.loads(l) for l in LOG.read_text(encoding="utf-8").splitlines() if l.strip()]


def _norm_seg_id(val):
    if isinstance(val, int) and not isinstance(val, bool):
        return f"s{val}"
    if isinstance(val, str):
        s = val.strip().lower()
        if re.fullmatch(r"\d+[a-z]?", s):
            return f"s{s}"
        m = re.match(r"^(s\d+[a-z]?)", s)
        if m:
            return m.group(1)
    return None


def _seg_num(sid):
    m = re.match(r"^s(\d+)", str(sid or ""))
    return int(m.group(1)) if m else None


def _shot_seg(r):
    if not isinstance(r, dict):
        return None
    return _norm_seg_id(r.get("seg")) or _norm_seg_id(r.get("at"))


def _resolve_unit(unit_id_raw):
    sc = jload("script.json") or {}
    units = sc.get("units")
    if not isinstance(units, list) or not units:
        return None, None, [], [], ["script.json has no 'units' array"]
    target = str(unit_id_raw or "").strip()
    hit_idx = next((idx for idx, u in enumerate(units) if isinstance(u, dict) and str(u.get("id")) == target), None)
    if hit_idx is None:
        hit_idx = next(
            (idx for idx, u in enumerate(units) if isinstance(u, dict) and str(u.get("id") or "").lower() == target.lower()),
            None,
        )
    if hit_idx is None:
        avail = [str(u.get("id")) for u in units if isinstance(u, dict) and u.get("id")]
        return None, None, units, [], [f"unknown unit {target!r} in script.json (available: {avail})"]
    unit = units[hit_idx]
    start_sid = _norm_seg_id(unit.get("seg_start"))
    end_sid = _norm_seg_id(unit.get("seg_end"))
    if not start_sid or not end_sid:
        return hit_idx, unit, units, [], [f"unit {unit.get('id')} has invalid seg_start/seg_end ({unit.get('seg_start')!r}..{unit.get('seg_end')!r})"]
    raw_segs = sc.get("segments") or []
    seg_ids = [_norm_seg_id(s.get("id")) for s in raw_segs if isinstance(s, dict) and _norm_seg_id(s.get("id"))]
    if start_sid in seg_ids and end_sid in seg_ids:
        i0, i1 = seg_ids.index(start_sid), seg_ids.index(end_sid)
        if i1 < i0:
            return hit_idx, unit, units, [], [f"unit {unit.get('id')} seg_end {end_sid!r} comes before seg_start {start_sid!r}"]
        unit_seg_ids = seg_ids[i0 : i1 + 1]
    else:
        n0, n1 = _seg_num(start_sid), _seg_num(end_sid)
        if n0 is None or n1 is None or n1 < n0:
            return hit_idx, unit, units, [], [f"unit {unit.get('id')} seg range {start_sid!r}..{end_sid!r} not found in script.json"]
        unit_seg_ids = [f"s{k}" for k in range(n0, n1 + 1)]
    return hit_idx, unit, units, unit_seg_ids, []


def _unit_lint_errors(lint_data, unit_shot_set, all_shots, all_units_authored):
    if not isinstance(lint_data, dict):
        return ["qa/lint.json missing — run node scripts/lint.mjs shots"]
    raw_errs = lint_data.get("errors")
    if not isinstance(raw_errs, list):
        return ["qa/lint.json invalid (missing 'errors' array)"]
    unit_names = {
        str(r.get("name"))
        for r in all_shots
        if isinstance(r, dict) and r.get("i") in unit_shot_set and r.get("name")
    }
    other_names = {
        str(r.get("name"))
        for r in all_shots
        if isinstance(r, dict) and r.get("i") not in unit_shot_set and r.get("name")
    } - unit_names
    scoped = []
    for e in raw_errs:
        s = str(e)
        ref_nums = set()
        for a, b in re.findall(r"#(\d+)\.\.#(\d+)", s):
            lo, hi = int(a), int(b)
            if lo <= hi:
                ref_nums.update(range(lo, hi + 1))
        for m in re.findall(r"#(\d+)\b", s):
            ref_nums.add(int(m))
        for m in re.findall(r"\bshot\s+#?(\d+)\b", s, re.I):
            ref_nums.add(int(m))
        if ref_nums:
            if ref_nums & unit_shot_set:
                scoped.append(s)
            continue
        if any(f"'{nm}'" in s for nm in unit_names):
            scoped.append(s)
            continue
        if any(f"'{nm}'" in s for nm in other_names):
            continue
        if not all_units_authored and s.startswith("[SH-16]") and "of episode" in s:
            continue
        scoped.append(s)
    return scoped


def unit_review_problems(unit_id):
    rev_name = f"G5.{unit_id}.review.md"
    p = G / rev_name
    if not p.exists():
        return [f"gates/{rev_name} missing — write review after inspecting qa/units/{unit_id}_contact.jpg"]
    txt = p.read_text(encoding="utf-8")
    bad = []
    bare = re.sub(r"`[^`\n]*`", "", txt)
    bare = re.sub(r"</?(en|br|b|i|em|strong|sub|sup)>", "", bare)
    if re.search(r"TODO|<[^\s<>=][^<>\n]{0,38}[^\s<>=]>", bare):
        bad.append(f"{rev_name} still has TODO or <placeholder>")
    if not re.search(r"^verdict:\s*pass\s*$", txt, re.M):
        bad.append(f"{rev_name}: no line 'verdict: pass'")
    cname = f"{unit_id}_contact.jpg"
    line = next((l for l in txt.splitlines() if cname in l), None)
    if line is None:
        bad.append(f"{rev_name} does not mention {cname}")
    else:
        remark = line.split(cname, 1)[1]
        if len(re.findall(r"\w+", remark)) < 4:
            bad.append(f"{rev_name}: remark on {cname} is too thin (say what you saw, >= 4 words)")
    cp = ROOT / f"qa/units/{cname}"
    rt = p.stat().st_mtime
    if cp.exists() and cp.stat().st_mtime > rt + 1e-6:
        bad.append(f"{cname} is newer than {rev_name} — look at the new evidence and update the review")
    return bad


def check_unit(unit_id_raw):
    idx, unit, units, unit_seg_ids, errs = _resolve_unit(unit_id_raw)
    if errs:
        return str(unit_id_raw), None, set(), errs
    unit_id = str(unit["id"])
    bad = []

    # 2) Strict Sequential Order Lock: preceding unit G5.<prev_id> MUST already have passed in gates/log.jsonl
    entries = log_entries()
    passed_gates = {
        e.get("gate")
        for e in entries
        if isinstance(e, dict) and e.get("status", "pass") == "pass"
    }
    if idx > 0:
        prev_id = str(units[idx - 1].get("id"))
        if f"G5.{prev_id}" not in passed_gates:
            bad.append(
                f"Sequential Unit Lock: cannot check or pass {unit_id} before preceding unit {prev_id} is locked "
                f"(missing G5.{prev_id} pass in gates/log.jsonl — complete and run sv_gate.py pass-unit {prev_id} first)"
            )
        earlier_missing = [
            str(units[k].get("id"))
            for k in range(idx - 1)
            if f"G5.{units[k].get('id')}" not in passed_gates
        ]
        if earlier_missing:
            bad.append(f"Sequential Unit Lock: earlier unit(s) {earlier_missing} also lack pass records in gates/log.jsonl")

    # Refresh lint.json, shots.json, and qa_status.json when full node runtime is present
    has_node_project = (
        (ROOT / "scripts/lint.mjs").exists()
        and (ROOT / "scripts/qa.mjs").exists()
        and (ROOT / "src/episode/shotlist.ts").exists()
        and (ROOT / "node_modules").exists()
    )
    if has_node_project:
        run(["node", "scripts/lint.mjs", "shots"])
        code_st, out_st = run(["node", "scripts/qa.mjs", "status"])
        if code_st != 0:
            bad.append("qa.mjs status failed: " + out_st[-200:])

    # 3) Verify shots exist covering every segment in [unit.seg_start .. unit.seg_end]
    all_shots = jload("qa/shots.json")
    if not isinstance(all_shots, list) or not all_shots:
        bad.append(f"qa/shots.json missing or empty — author shots for {unit_id} ({unit.get('seg_start')}..{unit.get('seg_end')}) first")
        all_shots = []
    unit_seg_set = set(unit_seg_ids)
    unit_shots = [r for r in all_shots if isinstance(r, dict) and _shot_seg(r) in unit_seg_set]
    unit_shot_set = {int(r["i"]) for r in unit_shots if "i" in r}
    covered_segs = {_shot_seg(r) for r in unit_shots if _shot_seg(r)}
    missing_segs = [sid for sid in unit_seg_ids if sid not in covered_segs]
    if missing_segs:
        bad.append(
            f"{unit_id} ({unit.get('seg_start')}..{unit.get('seg_end')}) missing shots covering segment(s) "
            f"{missing_segs[:15]}{'...' if len(missing_segs) > 15 else ''}"
        )
    if not unit_shot_set and not missing_segs:
        bad.append(f"{unit_id} has 0 shots in qa/shots.json")

    # 4) Verify qa/units/<unitId>_contact.jpg exists and is non-empty (and current if cache tracks unit_contact)
    unit_contact_rel = f"qa/units/{unit_id}_contact.jpg"
    unit_contact_p = ROOT / unit_contact_rel
    if not unit_contact_p.is_file() or unit_contact_p.stat().st_size == 0:
        bad.append(f"{unit_contact_rel} missing or empty — run node scripts/qa.mjs pass --unit {unit_id}")

    # 5) Verify qa/lint.json has 0 errors on shots in <unitId>
    sc_all_segs = {
        _norm_seg_id(s.get("id"))
        for s in ((jload("script.json") or {}).get("segments") or [])
        if isinstance(s, dict) and _norm_seg_id(s.get("id"))
    }
    all_authored_segs = {_shot_seg(r) for r in all_shots if isinstance(r, dict) and _shot_seg(r)}
    all_units_authored = bool(sc_all_segs) and sc_all_segs.issubset(all_authored_segs)
    lint_errs = _unit_lint_errors(jload("qa/lint.json"), unit_shot_set, all_shots, all_units_authored)
    if lint_errs:
        bad.append(f"qa/lint.json has {len(lint_errs)} error(s) on {unit_id}:\n    " + "\n    ".join(lint_errs[:12]))

    lr = jload("qa/layout_report.json")
    if isinstance(lr, list) and unit_shot_set:
        overcrowded = [
            e.get("i") for e in lr
            if isinstance(e, dict) and e.get("i") in unit_shot_set and not e.get("la02Waived")
            and ((e.get("gridLayout") or {}).get("overcrowdedCells") or float((e.get("gridLayout") or {}).get("occupancyFrac") or 0) > 0.78)
        ]
        scale_errors = [
            e.get("i") for e in lr
            if isinstance(e, dict) and e.get("i") in unit_shot_set and not e.get("la01Waived") and (e.get("scaleIssues") or [])
        ]
        if overcrowded:
            bad.append(f"qa/layout_report.json has {len(overcrowded)} overcrowded shot(s) in {unit_id}: {overcrowded[:10]} (LA-02)")
        if scale_errors:
            bad.append(f"qa/layout_report.json has {len(scale_errors)} scale error shot(s) in {unit_id}: {scale_errors[:10]} (LA-01)")

    # 6) Verify EVERY shot i in <unitId> has valid qa/review/NN.json (ok, current hash & blind_sha, reviewer != builder, looked)
    st = jload("qa/qa_status.json")
    if not isinstance(st, dict):
        if unit_shot_set:
            bad.append(f"qa/qa_status.json missing — run node scripts/qa.mjs pass --unit {unit_id}")
    elif unit_shot_set:
        cache_data = jload("qa/cache.json") or {}
        uc_cache = cache_data.get("unit_contact") if isinstance(cache_data, dict) else None
        if isinstance(uc_cache, dict):
            st_hashes = {int(k): v for k, v in (st.get("hashes") or {}).items()}
            stale_uc = [
                i for i in sorted(unit_shot_set)
                if str(i) in uc_cache and uc_cache.get(str(i)) != st_hashes.get(i)
            ]
            if stale_uc:
                bad.append(f"{unit_contact_rel} is out of date for shot(s) {stale_uc[:15]} — run node scripts/qa.mjs pass --unit {unit_id}")
        bad += shot_reviews(st, only_shots=unit_shot_set, unit_id=unit_id)

    # 7) Verify gates/G5.<unitId>.review.md
    bad += unit_review_problems(unit_id)
    return unit_id, unit, unit_shot_set, bad


def unit_statuses():
    sc = jload("script.json") or {}
    units = sc.get("units")
    if not isinstance(units, list) or not units:
        return []
    entries = log_entries()
    out = []
    for u in units:
        if not isinstance(u, dict) or not u.get("id"):
            continue
        uid = str(u["id"])
        gname = f"G5.{uid}"
        last = next(
            (e for e in reversed(entries) if isinstance(e, dict) and e.get("gate") == gname and e.get("status", "pass") == "pass"),
            None,
        )
        span = f"{u.get('seg_start', '?')}..{u.get('seg_end', '?')}"
        title = str(u.get("title") or "").strip()
        if not last:
            out.append({"id": uid, "gate": gname, "span": span, "title": title, "state": "open", "info": None})
            continue
        ev_map = last.get("evidence") or {}
        changed = [p for p, h in ev_map.items() if sha(p) != h]
        if changed:
            out.append({"id": uid, "gate": gname, "span": span, "title": title, "state": "stale", "info": changed})
        else:
            out.append({"id": uid, "gate": gname, "span": span, "title": title, "state": "pass", "info": last.get("at")})
    return out


def raw_state(g):
    last = next((e for e in reversed(log_entries()) if e["gate"] == g), None)
    if not last:
        return "open", None
    now = {p: sha(p) for p in INPUTS[g]}
    changed = [p for p in INPUTS[g] if now[p] != last["inputs"].get(p)]
    return ("stale", changed) if changed else ("pass", last["at"])


def state(g, _memo=None):
    """pass only if its own inputs are unchanged AND every gate it depends on passes (transitively)"""
    memo = {} if _memo is None else _memo
    if g in memo:
        return memo[g]
    st, info = raw_state(g)
    if st == "pass":
        bad = [d for d in DEPS[g] if state(d, memo)[0] != "pass"]
        if bad:
            st, info = "stale", [f"{d} is not passing" for d in bad]
    memo[g] = (st, info)
    return memo[g]


def next_gates(memo):
    """gates whose dependencies all pass but which are not passing themselves: the work that can start now"""
    return [g for g in ORDER if memo[g][0] != "pass" and all(memo[d][0] == "pass" for d in DEPS[g])]


def status(brief=False):
    memo = {}
    for g in ORDER:
        state(g, memo)
    u_rows = unit_statuses()
    rows = []
    for g in ORDER:
        st, info = memo[g]
        mark = {"pass": "PASS ", "stale": "STALE", "open": "open "}[st]
        if brief and isinstance(info, list):
            info = ", ".join(info)[:70]
        rows.append(f"{g} {mark} {NAMES[g]:<24} {info if info else ''}")
        if g == "G5" and u_rows:
            for ur in u_rows:
                umark = {"pass": "PASS ", "stale": "STALE", "open": "open "}[ur["state"]]
                uinfo = ur["info"]
                if brief and isinstance(uinfo, list):
                    uinfo = ", ".join(uinfo)[:60]
                label = f"unit {ur['id']} ({ur['span']})"
                rows.append(f"  {ur['gate']:<6} {umark} {label:<20} {uinfo if uinfo else ''}")
    nxt = next_gates(memo)
    print("\n".join(rows))
    if brief:
        next_u = next((ur["id"] for ur in u_rows if ur["state"] != "pass"), None)
        hints = []
        for g in nxt:
            if g == "G5" and next_u:
                hints.append(
                    f"G5.{next_u} (next episodic unit): node scripts/qa.mjs pass --unit {next_u} && python scripts/sv_cli.py gate check G5.{next_u}"
                )
            else:
                hints.append(f"{g} ({NAMES[g]}): python scripts/sv_cli.py doctor --stage {g} && python scripts/sv_cli.py gate check {g}")
        print("next:", " | ".join(hints) or "all gates pass")
    (ROOT / "qa").mkdir(exist_ok=True)
    state_payload = {
        "at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "gates": {g: {"state": memo[g][0], "info": memo[g][1]} for g in ORDER},
        **({"units": {ur["id"]: {"gate": ur["gate"], "span": ur["span"], "state": ur["state"], "info": ur["info"]} for ur in u_rows}} if u_rows else {}),
        "next": nxt,
        "activity": activity(),
    }
    (ROOT / "qa/state.json").write_text(json.dumps(state_payload, ensure_ascii=False, indent=1), encoding="utf-8")


# files whose modification time shows the episode is moving (renders write frames, voice writes takes)
ACTIVITY_DIRS = ["src", "qa", "gates", "audio", "public", "out"]
# written by sv_gate itself (times.mjs, status): not a sign that a helper is working
SELF_WRITTEN = {"state.json", "shots.json", "timing.json", "qa_status.json"}


def activity():
    newest, newest_f = 0.0, None
    for d in ACTIVITY_DIRS:
        base = ROOT / d
        if not base.exists():
            continue
        for f in base.rglob("*"):
            try:
                if f.is_file() and f.name not in SELF_WRITTEN:
                    m = f.stat().st_mtime
                    if m > newest:
                        newest, newest_f = m, f
            except OSError:
                pass
    for f in ["script.json", "brief.md", "beats.md", "audio.json"]:
        p = ROOT / f
        if p.exists() and p.stat().st_mtime > newest:
            newest, newest_f = p.stat().st_mtime, p
    lock = ROOT / "qa/.render.lock"
    running = None
    if lock.exists():
        try:
            pid = int(lock.read_text().split()[0])
            import os
            os.kill(pid, 0)
            running = pid
        except Exception:
            running = None
    return {"last_change_s": round(time.time() - newest, 1) if newest else None,
            "last_file": str(newest_f.relative_to(ROOT)) if newest_f else None, "render_pid": running}


def watch(stall_min):
    """For the conductor: run on every wake-up. A helper that died (server reload, crash) leaves the episode
    silent; this says so after `stall_min` minutes instead of letting the episode sit for hours."""
    memo = {}
    for g in ORDER:
        state(g, memo)
    a = activity()
    nxt = next_gates(memo)
    if not nxt:
        print("DONE all gates pass")
        return
    quiet = (a["last_change_s"] or 0) / 60
    if a["render_pid"]:
        print(f"RUNNING render pid {a['render_pid']} · next {nxt}")
    elif quiet >= stall_min:
        print(f"STALLED {quiet:.0f} min without a file change (last: {a['last_file']}) · open gates {nxt} — "
              f"check the helper that owns them; if it is gone, start a new one with the same brief")
        sys.exit(2)
    else:
        print(f"OK last change {quiet:.1f} min ago ({a['last_file']}) · next {nxt}")


def main():
    # refresh qa/shots.json + qa/timing.json so G6 goes STALE only when shot TIMING changed (not on a visual fix)
    if (ROOT / "scripts/times.mjs").exists() and (ROOT / "src/episode/shotlist.ts").exists() and (ROOT / "node_modules").exists():
        run(["node", "scripts/times.mjs", "--quiet"])
    if len(sys.argv) < 2 or sys.argv[1] == "status":
        return status(brief="--brief" in sys.argv)
    if sys.argv[1] == "watch":
        stall = float(sys.argv[sys.argv.index("--stall") + 1]) if "--stall" in sys.argv else 10.0
        return watch(stall)
    if sys.argv[1] in ("check-unit", "pass-unit"):
        if len(sys.argv) < 3:
            sys.exit("usage: python3 scripts/sv_gate.py check-unit|pass-unit <unitId>")
        cmd_u, raw_uid = sys.argv[1], sys.argv[2]
        if cmd_u == "pass-unit":
            actor_role = os.environ.get("SV_ACTOR_ROLE", "orchestrator").strip().lower()
            if actor_role != "orchestrator":
                sys.exit(f"ROLE_VIOLATION: SV_ACTOR_ROLE={actor_role!r} cannot pass unit gates (only orchestrator may run pass-unit)")
            if (ROOT / ".episode.json").exists() and os.environ.get("SV_CLI_VERIFIED") != "1":
                sys.exit(f"BYPASS_BLOCKED: Direct 'sv_gate.py pass-unit' is disabled in v6 episodes — run 'python scripts/sv_cli.py gate pass G5.{raw_uid} --actor <orchestrator_id>'")
        unit_id, unit, unit_shot_set, probs = check_unit(raw_uid)
        gname = f"G5.{unit_id}"
        probs = probs + _audit_v6_logs(gname, unit_id=unit_id)
        unit_ev = f"qa/units/{unit_id}_contact.jpg"
        span = f" ({unit.get('seg_start')}..{unit.get('seg_end')})" if isinstance(unit, dict) else ""
        print(f"{gname} episodic unit {unit_id}{span}")
        print("evidence:", unit_ev if (ROOT / unit_ev).exists() else "(missing)", sep="\n  ")
        if probs:
            print("NOT PASSING:")
            for x in probs:
                print("  -", x)
            sys.exit(1)
        print("all unit checks green")
        if cmd_u == "pass-unit":
            last_u = max(
                (e for e in log_entries() if isinstance(e, dict) and str(e.get("gate", "")).startswith("G5.") and e.get("status", "pass") == "pass"),
                key=lambda e: e.get("t", 0),
                default=None,
            )
            if last_u and time.time() - last_u["t"] < UNIT_COOLDOWN_S:
                wait = UNIT_COOLDOWN_S - (time.time() - last_u["t"])
                sys.exit(
                    f"{last_u['gate']} passed {time.time() - last_u['t']:.0f} s ago — episodic units are built and reviewed one at a time, "
                    f"not in a batch: pass-unit {unit_id} after {time.strftime('%H:%M:%S', time.localtime(time.time() + wait))}"
                )
            G.mkdir(exist_ok=True)
            rec = {
                "gate": gname,
                "unit": unit_id,
                "status": "pass",
                "at": time.strftime("%Y-%m-%d %H:%M:%S"),
                "t": time.time(),
                "seg_start": unit.get("seg_start") if isinstance(unit, dict) else None,
                "seg_end": unit.get("seg_end") if isinstance(unit, dict) else None,
                "shots": sorted(unit_shot_set),
                "inputs": {"script.json": sha("script.json")},
                "evidence": {unit_ev: sha(unit_ev)},
                "review": sha(f"gates/{gname}.review.md"),
            }
            with LOG.open("a", encoding="utf-8") as f:
                f.write(json.dumps(rec, ensure_ascii=False) + "\n")
            print(f"{gname} PASSED and logged")
            status(brief=True)
        return
    if len(sys.argv) < 3 or sys.argv[1] not in ("check", "pass"):
        sys.exit("usage: python3 scripts/sv_gate.py status [--brief] | check <G#> | pass <G#> | check-unit <U#> | pass-unit <U#> | watch [--stall N]")
    cmd, g = sys.argv[1], sys.argv[2].upper()
    if g not in ORDER:
        sys.exit(f"unknown gate {g}")
    if cmd == "pass":
        actor_role = os.environ.get("SV_ACTOR_ROLE", "orchestrator").strip().lower()
        if actor_role != "orchestrator":
            sys.exit(f"ROLE_VIOLATION: SV_ACTOR_ROLE={actor_role!r} cannot pass gates (only orchestrator may pass {g})")
        if (ROOT / ".episode.json").exists() and os.environ.get("SV_CLI_VERIFIED") != "1":
            sys.exit(f"BYPASS_BLOCKED: Direct 'sv_gate.py pass' is disabled in v6 episodes — run 'python scripts/sv_cli.py gate pass {g} --actor <orchestrator_id>'")
    memo = {}
    for d in DEPS[g]:
        st, info = state(d, memo)
        if st != "pass":
            sys.exit(f"{d} ({NAMES[d]}) is {st} {info or ''} — {g} depends on it")
    probs = checks(g) + review_problems(g) + _audit_v6_logs(g)
    print(f"{g} {NAMES[g]}")
    print("evidence:", *(evidence(g) or ["(none)"]), sep="\n  ")
    if probs:
        print("NOT PASSING:")
        for x in probs:
            print("  -", x)
        sys.exit(1)
    print("all checks green")
    if cmd == "pass":
        last_main = max(
            (e for e in log_entries() if isinstance(e, dict) and e.get("gate") in ORDER),
            key=lambda e: e.get("t", 0),
            default=None,
        )
        if last_main and time.time() - last_main["t"] < COOLDOWN_S:
            wait = COOLDOWN_S - (time.time() - last_main["t"])
            sys.exit(f"{last_main['gate']} passed {time.time() - last_main['t']:.0f} s ago — gates are reviewed one at a time, "
                     f"not in a batch: pass {g} after {time.strftime('%H:%M:%S', time.localtime(time.time() + wait))}")
        G.mkdir(exist_ok=True)
        e = {"gate": g, "at": time.strftime("%Y-%m-%d %H:%M:%S"), "t": time.time(), "inputs": {p: sha(p) for p in INPUTS[g]},
             "evidence": {f: sha(f) for f in evidence(g)}, "review": sha(f"gates/{g}.review.md")}
        with LOG.open("a", encoding="utf-8") as f:
            f.write(json.dumps(e, ensure_ascii=False) + "\n")
        print(f"{g} PASSED and logged")
        status(brief=True)


if __name__ == "__main__":
    main()
