"""Script checks for gate G2. Writes qa/script_lint.json; exit 1 on any error.
Run: python3 scripts/script_lint.py
Calibrated on standards/pacing.json (22-34 segments, 600-720 words, 140-165 s at 1.0x Hải Đăng)
and the 548-script World-Rule Shorts survey (SC-20..26). See sv-10-script/references/craft.md.
"""
import json
import re
import statistics
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
errors, warns = [], []
err = lambda r, m: errors.append(f"[{r}] {m}")
warn = lambda r, m: warns.append(f"[{r}] {m}")

script = json.loads((ROOT / "script.json").read_text())
segs = script.get("segments", [])

# ---- identity ----
if re.search(r"demo", script.get("title", ""), re.I):
    err("SC-01", "title still says DEMO")
if script.get("voice") != "Hải Đăng":
    err("SC-02", f"voice is '{script.get('voice')}', house voice is Hải Đăng")
ids = [s["id"] for s in segs]
id_to_idx = {sid: idx for idx, sid in enumerate(ids)}
nums = [int(m.group(1)) if (m := re.fullmatch(r"s(\d+)[a-z]?", i)) else -1 for i in ids]
if -1 in nums or len(set(ids)) != len(ids) or nums != sorted(nums) or (nums and nums[0] != 1):
    err("SC-03", f"segment ids must be s1, s2, ... (an inserted segment may be s3b), unique and in order (got {ids[:8]}...)")

# ---- length + pacing (standards/pacing.json: the same speed for every episode, any agent, any machine) ----
PA = json.loads((ROOT / "standards/pacing.json").read_text())
words = [w for s in segs for w in s.get("tts_text", s["text"]).split()]
dflt = script.get("pause_after", PA["voice"]["default_pause_after_s"])
pause = sum(s.get("pause_after", dflt) for s in segs[:-1])
est = len(words) / 4.49 + pause   # 4.49 = Hải Đăng in-line rate (voice_standard.json profile)
lo, hi = PA["episode"]["segments"]
if not lo <= len(segs) <= hi:
    err("SC-04", f"{len(segs)} segments; house pacing is {lo}-{hi} (pacing.json)")
wlo, whi = PA["episode"]["words"]
if not wlo <= len(words) <= whi:
    err("SC-05", f"{len(words)} spoken words; house budget {wlo}-{whi} (= 140-165 s at 1.0x Hải Đăng) — cut or add a beat, never speed the voice up")
slo, shi = PA["episode"]["voice_s"]
if not slo <= est <= shi:
    err("SC-05", f"estimated {est:.0f} s outside {slo}-{shi} s (target {PA['episode']['voice_s_target']} s)")
plo, phi = PA["voice"]["pause_after_s"]
for s in segs:
    pa = s.get("pause_after", dflt)
    if not plo <= pa <= phi:
        err("SC-18", f"{s['id']}: pause_after {pa} outside {plo}-{phi} s")

# ---- text sent to the voice (standards/voice_standard.json -> text) ----
VS = json.loads((ROOT / "standards/voice_standard.json").read_text())["text"]
for s in segs:
    t = s.get("tts_text", s["text"])
    if VS["no_digits"] and re.search(r"\d", t):
        err("SC-15", f"{s['id']}: digits in the spoken text — write numbers in words (in text, or in tts_text)")
    if VS["no_ellipsis"] and ("..." in t or "…" in t):
        err("SC-16", f"{s['id']}: '…' in the spoken text — the engine turns it into a 0.3-0.5 s hole; use a full stop or a comma")
    tags = re.findall(r"\[([^\]]+)\]", t)
    if any(x not in VS["allowed_tags"] for x in tags):
        err("SC-17", f"{s['id']}: emotion tags {tags} are not in the voice standard")
for s in segs:
    n = len(s["text"].split())
    if n > 45:
        err("SC-06", f"{s['id']}: {n} words in one segment (max 45) — split it, each segment is a picture change")
    if n < 3:
        warn("SC-06", f"{s['id']}: only {n} words")

# ---- rhythm ----
sentences = [x.strip() for s in segs for x in re.split(r"(?<=[.!?…])\s+", s["text"]) if x.strip()]
lens = [len(x.split()) for x in sentences]
if lens:
    mean, sd = statistics.mean(lens), statistics.pstdev(lens)
    if sd < 3.0:
        err("SC-07", f"sentence length SD {sd:.1f} < 3.0 — monotone rhythm; mix short punches with long build-ups (reference 4.3)")
    if not 6 <= mean <= 13:
        warn("SC-07", f"mean sentence length {mean:.1f} words (reference 9.4)")
    long = [x for x in sentences if len(x.split()) > 24]
    for x in long:
        err("SC-08", f"sentence of {len(x.split())} words (> 24): \"{x[:60]}...\"")
    shorts = [x for x in sentences if len(x.split()) <= 5]
    if len(shorts) < 6:
        err("SC-09", f"only {len(shorts)} short sentences (<= 5 words; minimum 6, target >= 10) — punch lines need room to land")
    elif len(shorts) < 10:
        warn("SC-09", f"{len(shorts)} short sentences (<= 5 words; survey target >= 10)")
else:
    mean = sd = 0

# ---- dialect: northern narrator (Hải Đăng) ----
SOUTH_ERR = ["hông", "nhen", "nghen", "tui", "ổng", "hổng", "dìa", "mần", "hổm", "bển", "dzô", "dzậy", "zậy", "hen", "nè", "vầy"]
SOUTH_WARN = {"heo": "lợn", "muỗng": "thìa", "xài": "dùng", "mắc": "đắt (nếu là giá)", "bả": "bà ấy", "trái": "quả (nếu là hoa quả)", "kêu": "gọi/bảo", "chén": "bát"}
toks = [re.sub(r"[^\w]", "", w.lower()) for w in words]
for w in SOUTH_ERR:
    if w in toks:
        err("SC-10", f"southern word '{w}' — narrator speaks northern Vietnamese")
for w, n in SOUTH_WARN.items():
    if w in toks:
        warn("SC-10", f"'{w}' reads southern; northern: {n}")
for a, nxt, hint in [("vô", ("đây", "nhà", "trong", "thang", "phòng", "đi"), "vào"), ("ly", ("nước", "cà", "trà", "bia", "rượu"), "cốc")]:
    for x, y in zip(toks, toks[1:]):
        if x == a and y in nxt:
            warn("SC-10", f"'{x} {y}' reads southern; northern: {hint} {y}")

# ---- repetition ----
bi = Counter(zip(toks, toks[1:]))
for (a, b), c in bi.most_common(8):
    if c > 6 and a not in ("ông", "bà", "anh", "chị", "cô", "chú", "cái", "là", "thì", "và", "của", "một", "không"):
        warn("SC-11", f"phrase '{a} {b}' repeats {c}×")

# ---- structural spine & anti-catalogue checks (v3.4.0: SC-20..26) ----
FIRST_PERSON_RE = re.compile(r"\b(tôi|mình|nhà tôi|bố tôi|mẹ tôi|chúng tôi)\b", re.I)
PROTAG_RE = re.compile(
    r"\b(tôi|mình|chúng tôi|nhà tôi|bố tôi|mẹ tôi|em tôi|anh tôi|chị tôi|ông tôi|bà tôi|hai anh em|hai bố con|hai mẹ con|hai chị em)\b",
    re.I,
)
URGENCY_RE = re.compile(
    r"\b(phút|giây|tiếng|nửa đêm|giao thừa|trước khi|hạn cuối|còn đúng|đếm ngược|kịp|sắp|cháy|nổ|ngạt|ngập|tràn|đóng cửa|tắt đèn|cạn|mất)\b",
    re.I,
)
MORAL_RE = re.compile(
    r"\b(bởi vì đôi khi|vì vậy đừng|bài học là|bài học rút ra|hãy trân trọng|đôi khi điều chúng ta|ý nghĩa thực sự|cuộc sống dạy ta)\b",
    re.I,
)
MAGIC_DENIAL_RE = re.compile(
    r"\b(chẳng có phép màu|không có phép màu|không có phép thuật|chỉ là giấc mơ|chỉ là một giấc mơ|hóa ra chỉ là mơ|tỉnh giấc mới biết)\b",
    re.I,
)

# SC-20: active protagonist presence in middle segments (35%-70%)
if len(segs) >= 10:
    lo_i = int(len(segs) * 0.35)
    hi_i = max(lo_i + 1, int(len(segs) * 0.70))
    mid_segs = segs[lo_i:hi_i]
    active_mid = sum(1 for s in mid_segs if PROTAG_RE.search(s["text"]))
    if active_mid / len(mid_segs) < 0.25:
        err(
            "SC-20",
            f"passive middle ({active_mid}/{len(mid_segs)} segments in 35%-70% involve narrator/household; need >= 25%) — cut neighbour catalogue and keep protagonist acting",
        )

# SC-24: button length <= 12 words + ban stated morals & magic-denial endings
if segs:
    btn_words = len(segs[-1]["text"].split())
    if btn_words > 14:
        err("SC-24", f"final Button segment ({segs[-1]['id']}) is {btn_words} words (> 14) — tighten to <= 12 words")
    elif btn_words > 12:
        warn("SC-24", f"final Button segment ({segs[-1]['id']}) is {btn_words} words (target <= 12)")
    tail_txt = " ".join(s["text"] for s in segs[-3:])
    if m := MORAL_RE.search(tail_txt):
        err("SC-24", f"stated moral cliché near ending ('{m.group(0)}') — replace with deadpan story button")
    if m := MAGIC_DENIAL_RE.search(tail_txt):
        err("SC-24", f"magic-denial/dream twist near ending ('{m.group(0)}') — climax must work inside the rule")

# SC-25 (script half): narrator enters by s7
has_early_protag = bool(segs) and any(FIRST_PERSON_RE.search(s["text"]) for s in segs[:7])
if segs and not has_early_protag:
    err("SC-25", "first-person narrator ('tôi'/'mình') does not appear in s1..s7 — enter early with a personal stake")

# SC-23: brief.md Archetype declaration + urgency cues in 35%-85% for trap archetypes
brief_path = ROOT / "brief.md"
if brief_path.exists():
    brief = brief_path.read_text()
    arch_m = re.search(r"^##\s+Archetype\b(.*?)(?=^##\s+|\Z)", brief, re.M | re.S)
    arch_sec = arch_m.group(1) if arch_m else ""
    valid_archs = ("Personal Rule-Trap", "Systemic Satire", "Hybrid VN Trap")
    chosen_arch = next((a for a in valid_archs if a.lower() in arch_sec.lower()), None)
    if not arch_m or "TODO" in arch_sec or not chosen_arch:
        err("SC-23", "brief.md ## Archetype missing, has TODO, or does not choose one of: Personal Rule-Trap | Systemic Satire | Hybrid VN Trap")
    elif chosen_arch in ("Personal Rule-Trap", "Hybrid VN Trap") and len(segs) >= 10:
        u_lo = int(len(segs) * 0.35)
        u_hi = max(u_lo + 1, int(len(segs) * 0.85))
        u_txt = " ".join(s["text"] for s in segs[u_lo:u_hi])
        if not URGENCY_RE.search(u_txt):
            warn("SC-23", f"archetype '{chosen_arch}' has no visible ticking-clock/urgency cue in 35%-85% of segments")

# ---- beats map ----
beats = (ROOT / "beats.md").read_text() if (ROOT / "beats.md").exists() else ""
if not beats or "TODO" in beats:
    err("SC-12", "beats.md missing or still has TODO")
else:
    for h in ["## Spine", "## Plant & Payoff", "## Hook", "## Setup", "## Escalation", "## Turn", "## Payoff", "## Button", "## Segment map"]:
        if h not in beats:
            err("SC-12", f"beats.md lacks section '{h}'")
    # a spine, not a gag list (sv-10 craft.md §2b): the middle is a causal chain
    spine = beats.split("## Spine", 1)[1].split("\n## ", 1)[0] if "## Spine" in beats else ""
    causal_lines = [ln.strip() for ln in spine.splitlines() if re.match(r"^\s*-\s*(vì thế|nhưng)\b", ln, re.I)]
    if len(causal_lines) < 4:
        err("SC-19", f"beats.md ## Spine has {len(causal_lines)} causal links; write the chain as >= 4 '- vì thế …' / '- nhưng …' lines")

    # SC-26: every causal line in ## Spine cites valid [sN] / [sN-sM] in non-decreasing order
    prev_idx = -1
    for ln in causal_lines:
        tags = re.findall(r"\[(s\d+[a-z]?)(?:\s*[-–>→]+\s*(s\d+[a-z]?))?\]", ln, re.I)
        if not tags:
            err("SC-26", f"Spine line missing [sN] or [sN-sM] segment citation: '{ln[:60]}'")
            continue
        first_sid = tags[0][0].lower()
        for a_sid, b_sid in tags:
            for sid in (a_sid.lower(), b_sid.lower()) if b_sid else (a_sid.lower(),):
                if sid not in id_to_idx:
                    err("SC-26", f"Spine cites unknown segment '{sid}' not in script.json")
            if b_sid and a_sid.lower() in id_to_idx and b_sid.lower() in id_to_idx:
                if id_to_idx[b_sid.lower()] < id_to_idx[a_sid.lower()]:
                    err("SC-26", f"Spine range [{a_sid}-{b_sid}] is out of order")
        if first_sid in id_to_idx:
            if id_to_idx[first_sid] < prev_idx:
                err("SC-26", f"Spine causal line '{ln[:50]}' goes backwards in segment order")
            prev_idx = id_to_idx[first_sid]

    # SC-22: ## Plant & Payoff maps early Plant (<= 45%) to late Payoff (>= 65%)
    if "## Plant & Payoff" in beats and ids:
        pp_sec = beats.split("## Plant & Payoff", 1)[1].split("\n## ", 1)[0]
        pm = re.search(r"Plant\s*:\s*(s\d+[a-z]?)\b", pp_sec, re.I)
        ym = re.search(r"Payoff\s*:\s*(s\d+[a-z]?)\b", pp_sec, re.I)
        if not pm or not ym:
            err("SC-22", "beats.md ## Plant & Payoff must cite 'Plant: s<N>' and 'Payoff: s<M>'")
        else:
            p_sid, y_sid = pm.group(1).lower(), ym.group(1).lower()
            if p_sid not in id_to_idx:
                err("SC-22", f"Plant segment '{p_sid}' does not exist in script.json")
            if y_sid not in id_to_idx:
                err("SC-22", f"Payoff segment '{y_sid}' does not exist in script.json")
            if p_sid in id_to_idx and y_sid in id_to_idx:
                p_pct = (id_to_idx[p_sid] + 1) / len(ids)
                y_pct = (id_to_idx[y_sid] + 1) / len(ids)
                if p_pct > 0.45:
                    err("SC-22", f"Plant {p_sid} is at {p_pct:.0%} (> 45%) — plant it in Act 1")
                if y_pct < 0.65:
                    err("SC-22", f"Payoff {y_sid} is at {y_pct:.0%} (< 65%) — pay it off in Act 3")
                if id_to_idx[p_sid] >= id_to_idx[y_sid]:
                    err("SC-22", f"Plant ({p_sid}) must come before Payoff ({y_sid})")

    # SC-13, SC-21, SC-25: Segment map completeness + Act-1 ceiling + Pivot timing
    for i in ids:
        if not re.search(rf"\|\s*{i}\s*\|", beats):
            err("SC-13", f"beats.md segment map has no row for {i}")

    map_sec = beats.split("## Segment map", 1)[1].split("\n## ", 1)[0] if "## Segment map" in beats else ""
    map_rows = []
    for ln in map_sec.splitlines():
        rm = re.match(r"^\|\s*(s\d+[a-z]?)\s*\|\s*([^|]+?)\s*\|", ln.strip(), re.I)
        if rm:
            map_rows.append((rm.group(1).lower(), rm.group(2).strip()))
    if map_rows:
        first_act2 = next(
            (idx for idx, (_, bt) in enumerate(map_rows) if re.search(r"\b(crisis|escalation|bind|hack|turn|payoff)\b", bt, re.I)),
            len(map_rows),
        )
        setup_rows = sum(
            1 for _, bt in map_rows if re.search(r"\b(hook|setup|world|innocence|rule)\b", bt, re.I)
        )
        if first_act2 / len(map_rows) > 0.42:
            err(
                "SC-21",
                f"Act 1 spans {first_act2}/{len(map_rows)} segments ({first_act2/len(map_rows):.0%} > 42%) before Crisis/Escalation — compress world setup",
            )
        elif setup_rows / len(map_rows) > 0.42:
            err(
                "SC-21",
                f"Hook/Setup/World rows occupy {setup_rows}/{len(map_rows)} segments ({setup_rows/len(map_rows):.0%} > 42%)",
            )
        if segs and not has_early_protag:
            err("SC-21", "narrator must enter by s7 (Act 1 ceiling)")

        pivot_idx = next(
            (idx for idx, (_, bt) in enumerate(map_rows) if re.search(r"\b(pivot|handicap|want)\b", bt, re.I)),
            None,
        )
        if pivot_idx is None or pivot_idx / len(map_rows) >= 0.40:
            pos = f"{pivot_idx/len(map_rows):.0%}" if pivot_idx is not None else "missing"
            err("SC-25", f"## Segment map needs a Pivot/Handicap beat before 40% (got: {pos})")

first = segs[0]["text"] if segs else ""
if len(first.split()) > 20:
    err("SC-14", f"s1 is {len(first.split())} words — the hook must land in the first ~4 s (<= 20 words)")

report = {"segments": len(segs), "words": len(words), "est_seconds": round(est, 1), "sentences": len(lens),
          "sent_mean": round(mean, 2), "sent_sd": round(sd, 2), "sent_min": min(lens or [0]), "sent_max": max(lens or [0]),
          "errors": errors, "warns": warns}
(ROOT / "qa").mkdir(exist_ok=True)
out = ROOT / "qa/script_lint.json"
txt = json.dumps(report, ensure_ascii=False, indent=1)
if not out.exists() or out.read_text() != txt:   # unchanged result keeps its mtime, so a G2 review stays valid
    out.write_text(txt)
print(f"script: {len(segs)} segments, {len(words)} words, ~{est:.0f} s, sentences {len(lens)} (mean {mean:.1f}, SD {sd:.1f}, {report['sent_min']}-{report['sent_max']})")
for w in warns:
    print("WARN ", w)
for e in errors:
    print("ERROR", e)
print(f"script lint: {len(errors)} errors, {len(warns)} warnings")
sys.exit(1 if errors else 0)
