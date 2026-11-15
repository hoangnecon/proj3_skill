"""Script checks for gate G2. Writes qa/script_lint.json; exit 1 on any error.
Run: python3 scripts/script_lint.py
Numbers are calibrated on the reference episode (Thang máy: 30 segments, 632 words, 145.8 s, 4.34 words/s,
sentence length mean 9.4 / SD 4.3 / range 3-22). See sv-10-script/references/craft.md.
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
WPS = 4.3

# ---- identity ----
if re.search(r"demo", script.get("title", ""), re.I):
    err("SC-01", "title still says DEMO")
if script.get("voice") != "Hải Đăng":
    err("SC-02", f"voice is '{script.get('voice')}', house voice is Hải Đăng")
ids = [s["id"] for s in segs]
nums = [int(m.group(1)) if (m := re.fullmatch(r"s(\d+)[a-z]?", i)) else -1 for i in ids]
if -1 in nums or len(set(ids)) != len(ids) or nums != sorted(nums) or (nums and nums[0] != 1):
    err("SC-03", f"segment ids must be s1, s2, ... (an inserted segment may be s3b), unique and in order (got {ids[:8]}...)")

# ---- length ----
words = [w for s in segs for w in s["text"].split()]
pause = sum(s.get("pause_after", script.get("pause_after", 0.32)) for s in segs)
est = len(words) / WPS + pause
if not 18 <= len(segs) <= 40:
    err("SC-04", f"{len(segs)} segments; a 2-3 min episode has 18-40 (reference 30)")
if est < 100 or est > 200:
    err("SC-05", f"estimated {est:.0f} s ({len(words)} words) is outside 100-200 s")
elif not 120 <= est <= 180:
    warn("SC-05", f"estimated {est:.0f} s — target 120-180 s")
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
    if len(shorts) < 3:
        err("SC-09", f"only {len(shorts)} short sentences (<= 5 words); punch lines need room to land")
else:
    mean = sd = 0

# ---- dialect: northern narrator (Hải Đăng) ----
SOUTH_ERR = ["hông", "nhen", "nghen", "tui", "ổng", "hổng", "dìa", "mần", "hổm", "bển", "dzô", "dzậy", "zậy", "hen", "nè", "vầy"]
SOUTH_WARN = {"heo": "lợn", "muỗng": "thìa", "xài": "dùng", "mắc": "đắt (nếu là giá)", "bả": "bà ấy", "trái": "quả (nếu là hoa quả)", "kêu": "gọi/bảo", "chén": "bát"}
# 'vô' (vô lý, vô tình) and 'ly' (ly hôn) are normal northern words — only flag them as verbs/nouns of the south:
# 'vô' (vô lý) and 'ly' (ly hôn) are fine in the north; only 'vô nhà', 'ly nước'... are flagged (below)
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
names = {t for s in segs for t in re.findall(r"\b[A-ZÀ-Ỹ][\wà-ỹ]+", s["text"])}
for (a, b), c in bi.most_common(8):
    if c > 6 and a not in ("ông", "bà", "anh", "chị", "cô", "chú", "cái", "là", "thì", "và", "của", "một", "không"):
        warn("SC-11", f"phrase '{a} {b}' repeats {c}×")

# ---- beats map ----
beats = (ROOT / "beats.md").read_text() if (ROOT / "beats.md").exists() else ""
if not beats or "TODO" in beats:
    err("SC-12", "beats.md missing or still has TODO")
else:
    for h in ["## Hook", "## Setup", "## Escalation", "## Turn", "## Payoff", "## Button", "## Segment map"]:
        if h not in beats:
            err("SC-12", f"beats.md lacks section '{h}'")
    for i in ids:
        if not re.search(rf"\|\s*{i}\s*\|", beats):
            err("SC-13", f"beats.md segment map has no row for {i}")
first = segs[0]["text"] if segs else ""
if len(first.split()) > 20:
    err("SC-14", f"s1 is {len(first.split())} words — the hook must land in the first ~4 s (<= 20 words)")

report = {"segments": len(segs), "words": len(words), "est_seconds": round(est, 1), "sentences": len(lens),
          "sent_mean": round(mean, 2), "sent_sd": round(sd, 2), "sent_min": min(lens or [0]), "sent_max": max(lens or [0]),
          "errors": errors, "warns": warns}
(ROOT / "qa").mkdir(exist_ok=True)
(ROOT / "qa/script_lint.json").write_text(json.dumps(report, ensure_ascii=False, indent=1))
print(f"script: {len(segs)} segments, {len(words)} words, ~{est:.0f} s, sentences {len(lens)} (mean {mean:.1f}, SD {sd:.1f}, {report['sent_min']}-{report['sent_max']})")
for w in warns:
    print("WARN ", w)
for e in errors:
    print("ERROR", e)
print(f"script lint: {len(errors)} errors, {len(warns)} warnings")
sys.exit(1 if errors else 0)
