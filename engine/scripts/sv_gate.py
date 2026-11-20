"""Phase gates G1-G7. A gate passes only when its machine checks pass AND its review file proves someone looked
at every piece of evidence after that evidence was made. Passing appends to gates/log.jsonl with input hashes;
a later change to any input makes the gate (and every gate that depends on it) STALE.

Gates depend on what they read, not on a fixed order (v3.7): design (G4) needs only the brief, so it can pass
while the voice (G3) is still being made; shots (G5) need voice timing AND design.
  G1 <- -    G2 <- G1    G3 <- G2    G4 <- G1    G5 <- G3, G4    G6 <- G3, G5    G7 <- G5, G6

  python3 scripts/sv_gate.py status          # table of all gates: pass / stale / open
  python3 scripts/sv_gate.py status --brief  # one line per gate + the next command (also writes qa/state.json)
  python3 scripts/sv_gate.py check G4        # run G4's checks, print what is missing (no logging)
  python3 scripts/sv_gate.py pass G4         # check + log the pass (only if everything is green)
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
import re
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
G = ROOT / "gates"
LOG = G / "log.jsonl"
ORDER = ["G1", "G2", "G3", "G4", "G5", "G6", "G7"]
NAMES = {"G1": "premise & brief", "G2": "script & beats", "G3": "voice & timing", "G4": "design: cast + sets",
         "G5": "shots, camera, motion", "G6": "audio mix", "G7": "render & delivery"}
USER_GATES = {"G1", "G2", "G4"}
DEPS = {"G1": [], "G2": ["G1"], "G3": ["G2"], "G4": ["G1"], "G5": ["G3", "G4"], "G6": ["G3", "G5"], "G7": ["G5", "G6"]}
COOLDOWN_S = 60   # between any two passes: gates are reviewed one at a time, not in a batch


def sha(p):
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
    return json.loads(p.read_text()) if p.exists() else None


def run(cmd):
    r = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True)
    return r.returncode, (r.stdout + r.stderr).strip()


# inputs whose change invalidates the gate
INPUTS = {
    "G1": ["brief.md"],
    "G2": ["script.json", "beats.md", "standards/pacing.json", "standards/voice_standard.json"],
    "G3": ["script.json", "audio/voice.wav", "src/data/words.json", "standards/voice_standard.json", "standards/pacing.json"],
    "G4": ["src/episode/cast.ts", "src/episode/sets.tsx", "src/episode/geo.ts", "src/props.tsx", "src/sets"],
    "G5": ["src/episode/shotlist.ts", "src/episode/cast.ts", "src/episode/sets.tsx", "src/data/words.json", "standards/pacing.json"],
    "G6": ["audio.json", "audio/voice.wav", "qa/timing.json", "standards/mix_targets.json", "scripts/theme.py"],
    "G7": ["out/final.mp4"],
}


def evidence(g):
    """files the reviewer must have looked at"""
    if g == "G1":
        return []
    if g == "G2":
        return ["qa/script_lint.json"]
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
        txt = b.read_text() if b.exists() else ""
        if not txt or "TODO" in txt:
            bad.append("brief.md missing or has TODO")
        for h in ["## Archetype", "## Premise", "## Spine", "## Why it is funny", "## Characters", "## Locations", "## Ending", "## Not copying"]:
            if h not in txt:
                bad.append(f"brief.md lacks '{h}'")
    elif g == "G2":
        code, out = run([sys.executable, "scripts/script_lint.py"])
        if code:
            bad.append("script lint failed:\n" + "\n".join(l for l in out.splitlines() if l.startswith("ERROR")))
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
            if e.get("clone") or e.get("mode") != "per_sentence_rhythm" or e.get("takes") != 1 or rh.get("target_ups") != 5.25 or rh.get("pitch_ratio") != 1.02:
                bad.append(f"engine/rhythm settings off-standard: {e} / {rh}")
            for sid, fails in r["failed_lines"].items():
                bad.append(f"{sid} fails {fails} after all attempts — fix its tts_text / sentences (numbers in words, <en>...</en> for English, split a long line), then voice.py --only {sid}")
            if r["stale_lines"]:
                bad.append(f"text changed after these lines were made: {r['stale_lines']} — voice.py --only {','.join(r['stale_lines'])}")
            for c in r["episode_checks"]:
                if not c["ok"]:
                    bad.append(f"{c['group']}.{c['check']} = {c['value']} outside {c['range']}")
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
        # CH-10 waivers (a character that cannot be a <Person>: animal, food-bodied citizen, printed photo) are on no
        # design sheet: the G4 review must name each and say it was compared with the cast sheet (>= 6 words)
        rv = (ROOT / "gates/G4.review.md").read_text() if (ROOT / "gates/G4.review.md").exists() else ""
        for rig in (jload("qa/lint.json") or {}).get("rigs", []):
            line = next((l for l in rv.splitlines() if rig["name"] in l and re.search(r"cast", l, re.I) and "CH-10" in l), None)
            if line is None or len(re.findall(r"\w+", line.split(rig["name"], 1)[1])) < 6:
                bad.append(f"{rig['name']} ({rig['file']}) is drawn outside <Person> (waived CH-10: {rig['reason']}) — open a frame "
                           f"that shows it next to the cast sheet and add a line to gates/G4.review.md: `<name> CH-10: compared with cast_episode_pN … <what you saw>` (>= 6 words)")
    elif g == "G5":
        code, out = run(["node", "scripts/lint.mjs", "shots"])
        if code:
            bad.append("shot lint failed:\n" + "\n".join(l for l in out.splitlines() if l.startswith("ERROR")))
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
                bad.append(f"voice peak limiter works {r['processing']['voice_peak_limit_max_gr_db']} dB: a click or pop in a take — find it, re-take the line (sv-12)")
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
            if (r["width"], r["height"]) != (1080, 1920) or abs(r["fps"] - 30) > 0.01:
                bad.append(f"format {r['width']}x{r['height']}@{r['fps']}")
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


def _load_carry():
    p = Path(__file__).resolve().parent / "carry.py"
    spec = importlib.util.spec_from_file_location("carry", p)
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


CARRY = _load_carry()
# "model" (v3.7): every character comes from the cast rig and matches its cast sheet — v3.6 dropped the
# "same look as the design sheets?" question and a hand-drawn Bình passed 66 reviews
REVIEW_CHECKS = ["acting", "contact", "overlap", "set", "text", "caption", "beat", "model"]


def shot_reviews(st):
    """Per-shot review files qa/review/NN.json (sv-22 "review cards"). Each must match the shot's CURRENT hash,
    come from a reviewer who is not the builder, answer every check, and — for a HOT shot (geometry lint,
    reach, key event) — say it opened the measurement crops, which must be current."""
    bad, miss, old, notok, thin, nocrop, nomodel, noblind = [], [], [], [], [], [], [], []
    hashes = {int(k): v for k, v in st.get("hashes", {}).items()}
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
    for i, h in sorted(hashes.items()):
        r = jload(f"qa/review/{i:02d}.json")
        if not r:
            miss.append(i)
            continue
        carried = False
        if r.get("hash") == h and r.get("carried"):
            # carried across a change that left the picture the same: re-verify from the card snapshots
            if not CARRY.chain_ok(r, h):
                old.append(i)
                continue
            carried = True
        elif r.get("hash") != h:
            old.append(i)
            continue
        if manifest and not carried:
            expected_blind = manifest_shots.get(i, {}).get("blind_sha")
            if not expected_blind or r.get("blind_sha") != expected_blind:
                noblind.append(i)
        if not r.get("reviewer") or r.get("reviewer") == r.get("builder", "builder"):
            bad.append(f"qa/review/{i:02d}.json: reviewer must be named and must not be the builder")
        checks = r.get("checks") or {}
        if "model" not in checks and r.get("verdict") == "ok":
            nomodel.append(i)
        elif r.get("verdict") != "ok" or any(not str(checks.get(c, "")).startswith("ok") for c in REVIEW_CHECKS):
            notok.append(i)
        if len(re.findall(r"\w+", str(r.get("note", "")))) < 6:
            thin.append(i)
        if i in hot and ("crops" not in (r.get("looked") or []) or (not crops_ok.get(i) and not carried)):
            nocrop.append(i)
    fmt = lambda xs: f"{xs[:15]}{'...' if len(xs) > 15 else ''}"  # noqa: E731
    if miss:
        bad.append(f"no review for shots {fmt(miss)} — node scripts/qa.mjs cards changed, then a reviewer writes qa/review/NN.json")
    if old:
        bad.append(f"review is for an older version of shots {fmt(old)} (hash changed) — node scripts/qa.mjs cards changed, "
                   f"python3 scripts/carry.py (keeps reviews whose picture did not change), then re-review the rest")
    if nomodel:
        bad.append(f"shots {fmt(nomodel)} were reviewed without the model check (added v3.7) — a reviewer opens each card next "
                   f"to qa/design/cast_episode_p*_v.jpg and adds checks.model to qa/review/NN.json: every character drawn by the "
                   f"cast rig, same face / hair / outfit / proportions as its sheet (a character drawn as a prop is a fix)")
    if notok:
        bad.append(f"shots {fmt(notok)} are not ok in review (verdict/checks) — fix them (sv-22 fix loop), re-review")
    if thin:
        bad.append(f"review note too thin for shots {fmt(thin)} (say what you saw, >= 6 words)")
    if nocrop:
        bad.append(f"HOT shots {fmt(nocrop)} need current crops opened — node scripts/qa.mjs crops <i>, add \"crops\" to looked")
    if noblind:
        bad.append(f"shots {fmt(noblind)} missing or mismatched blind_sha from qa/blind_review/manifest.json — re-review using qa/blind_review/slice_*.json")
    return bad


def review_problems(g):
    p = G / f"{g}.review.md"
    if not p.exists():
        return [f"gates/{g}.review.md missing (copy the template)"]
    txt = p.read_text()
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
    return [json.loads(l) for l in LOG.read_text().splitlines() if l.strip()]


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
    rows = []
    for g in ORDER:
        st, info = memo[g]
        mark = {"pass": "PASS ", "stale": "STALE", "open": "open "}[st]
        if brief and isinstance(info, list):
            info = ", ".join(info)[:70]
        rows.append(f"{g} {mark} {NAMES[g]:<24} {info if info else ''}")
    nxt = next_gates(memo)
    print("\n".join(rows))
    if brief:
        print("next:", " | ".join(f"{g} ({NAMES[g]}): python3 scripts/sv_gate.py check {g}" for g in nxt) or "all gates pass")
    (ROOT / "qa").mkdir(exist_ok=True)
    (ROOT / "qa/state.json").write_text(json.dumps({
        "at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "gates": {g: {"state": memo[g][0], "info": memo[g][1]} for g in ORDER},
        "next": nxt, "activity": activity()}, ensure_ascii=False, indent=1))


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
    if (ROOT / "scripts/times.mjs").exists() and (ROOT / "src/episode/shotlist.ts").exists():
        run(["node", "scripts/times.mjs", "--quiet"])
    if len(sys.argv) < 2 or sys.argv[1] == "status":
        return status(brief="--brief" in sys.argv)
    if sys.argv[1] == "watch":
        stall = float(sys.argv[sys.argv.index("--stall") + 1]) if "--stall" in sys.argv else 10.0
        return watch(stall)
    cmd, g = sys.argv[1], sys.argv[2].upper()
    if g not in ORDER:
        sys.exit(f"unknown gate {g}")
    memo = {}
    for d in DEPS[g]:
        st, info = state(d, memo)
        if st != "pass":
            sys.exit(f"{d} ({NAMES[d]}) is {st} {info or ''} — {g} depends on it")
    probs = checks(g) + review_problems(g)
    print(f"{g} {NAMES[g]}")
    print("evidence:", *(evidence(g) or ["(none)"]), sep="\n  ")
    if probs:
        print("NOT PASSING:")
        for x in probs:
            print("  -", x)
        sys.exit(1)
    print("all checks green")
    if cmd == "pass":
        last = max(log_entries(), key=lambda e: e["t"], default=None)
        if last and time.time() - last["t"] < COOLDOWN_S:
            wait = COOLDOWN_S - (time.time() - last["t"])
            sys.exit(f"{last['gate']} passed {time.time() - last['t']:.0f} s ago — gates are reviewed one at a time, "
                     f"not in a batch: pass {g} after {time.strftime('%H:%M:%S', time.localtime(time.time() + wait))}")
        G.mkdir(exist_ok=True)
        e = {"gate": g, "at": time.strftime("%Y-%m-%d %H:%M:%S"), "t": time.time(), "inputs": {p: sha(p) for p in INPUTS[g]},
             "evidence": {f: sha(f) for f in evidence(g)}, "review": sha(f"gates/{g}.review.md")}
        with LOG.open("a") as f:
            f.write(json.dumps(e, ensure_ascii=False) + "\n")
        print(f"{g} PASSED and logged")
        status(brief=True)


if __name__ == "__main__":
    main()
