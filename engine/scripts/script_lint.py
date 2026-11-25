"""Script checks for gate G2. Writes qa/script_lint.json; exit 1 on any error.
Run: python3 scripts/script_lint.py
Calibrated on standards/pacing.json (v4.0 empirical corridor), standards/voice_standard.json (v4.0 Hải Đăng
native pitch 1.00, 4.57 overall wps), and standards/script_dna_db.json (v2.0 41-folder YouTube DNA corpus: SC-38..43).
"""
import json
import re
import statistics
import sys
import unicodedata
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
errors, warns = [], []
err = lambda r, m: errors.append(f"[{r}] {m}")
warn = lambda r, m: warns.append(f"[{r}] {m}")

EN_SPAN_RE = re.compile(r"<en>(.*?)</en>", re.I | re.S)
TAG_RE = re.compile(r"\[([^\]]+)\]")
SENT_SPLIT_RE = re.compile(r"(?<=[.!?…])\s+(?=[^\s])")


def strip_markup(s: str) -> str:
    s = unicodedata.normalize("NFC", s)
    s = re.sub(r"</?en>", "", s, flags=re.I)
    s = TAG_RE.sub(" ", s)
    return " ".join(s.split())


def apply_bilingual(text: str, english_terms: list[str]) -> str:
    terms = sorted({t.strip() for t in english_terms if t and t.strip()}, key=len, reverse=True)
    if not terms:
        return text
    protected = []

    def _save(m):
        protected.append(m.group(0))
        return f"\x00EN{len(protected) - 1}\x00"

    masked = EN_SPAN_RE.sub(_save, text)
    pat = re.compile(r"(?<![\w<])(?:" + "|".join(map(re.escape, terms)) + r")(?![\w>])")
    masked = pat.sub(lambda m: f"<en>{m.group(0)}</en>", masked)
    for idx, orig in enumerate(protected):
        masked = masked.replace(f"\x00EN{idx}\x00", orig)
    return masked


def syllable_units(tts_text: str) -> float:
    s = TAG_RE.sub(" ", tts_text)
    total = 0.0
    pos = 0
    for m in EN_SPAN_RE.finditer(s):
        total += len(re.findall(r"[^\W_]+", s[pos:m.start()], re.UNICODE))
        for ew in re.findall(r"[A-Za-z0-9']+", m.group(1)):
            syls = len(re.findall(r"[aeiouyAEIOUY]+", ew))
            if ew.lower().endswith("e") and not ew.lower().endswith("le") and syls > 1:
                syls -= 1
            total += max(1, syls)
        pos = m.end()
    total += len(re.findall(r"[^\W_]+", s[pos:], re.UNICODE))
    return max(1.0, total)


script = json.loads((ROOT / "script.json").read_text())
segs = script.get("segments", [])
global_english = script.get("english", [])

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

# ---- length + pacing (standards/pacing.json & standards/voice_standard.json v4.0) ----
PA = json.loads((ROOT / "standards/pacing.json").read_text())
_ep_meta = json.loads((ROOT / ".episode.json").read_text(encoding="utf-8")) if (ROOT / ".episode.json").exists() else {}
_track = _ep_meta.get("track") or PA.get("track")
# SC-27: track alignment & explicit length override
_len = script.get("length")
if _track == "long":
    if script.get("format") != "16:9" or _len != "long_16x9":
        err("SC-27", f'.episode.json declares track="long" — script.json must set "format": "16:9" and "length": "long_16x9" (got format={script.get("format")!r}, length={_len!r})')
    elif "episode_long_16x9" in PA:
        PA["episode"] = PA["episode_long_16x9"]
elif _len in ("long", "long_16x9"):
    _b = (ROOT / "brief.md").read_text() if (ROOT / "brief.md").exists() else ""
    _m = re.search(r"^## Length override\s*\n(.*?)(?=^## |\Z)", _b, re.M | re.S)
    if not _m or not re.search(r'^user_quote:\s*"(.{4,})"\s*$', _m.group(1), re.M):
        err("SC-27", f'script.json length "{_len}" needs brief.md "## Length override" with a line user_quote: "<the user\'s words>"')
    elif _len == "long_16x9" and script.get("format") != "16:9":
        err("SC-27", 'script.json length "long_16x9" requires "format": "16:9"')
    elif _len == "long_16x9" and "episode_long_16x9" in PA:
        PA["episode"] = PA["episode_long_16x9"]
    elif _len == "long" and "episode_long" in PA:
        PA["episode"] = PA["episode_long"]
VS_FULL = json.loads((ROOT / "standards/voice_standard.json").read_text())
VS = VS_FULL["text"]
RH = dict(VS_FULL["rhythm"])
_dna_path = ROOT / "standards/script_dna_db.json"
DNA_DB = json.loads(_dna_path.read_text(encoding="utf-8")) if _dna_path.exists() else {}
DNA_S = DNA_DB.get("short_9x16", {})
DNA_PROSE = DNA_S.get("prose_breathability", {})
DNA_DLG = DNA_S.get("dialogue_and_voice", {})
DNA_SCOPE = DNA_S.get("scope_economy", {})
DNA_BEAT = DNA_S.get("beat_cadence", {})
DNA_ANTI = DNA_S.get("anti_patterns", {})
allowed_tags = {x.lower() for x in VS.get("allowed_tags", [])}

def seg_spoken_string(s: dict) -> str:
    eng = list(global_english) + list(s.get("english", []))
    if s.get("sentences"):
        parts = [st if isinstance(st, str) else st.get("tts_text", st.get("text", "")) for st in s["sentences"]]
        return apply_bilingual(" ".join(parts), eng)
    return apply_bilingual(s.get("tts_text", s["text"]), eng)

words = [w for s in segs for w in strip_markup(seg_spoken_string(s)).split()]
dflt = script.get("pause_after", PA["voice"]["default_pause_after_s"])
pause = sum(float(s.get("pause_after", dflt)) for s in segs[:-1])
script_wps = script.get("wps")

# Estimate episode voice seconds using the v3.0 per-sentence rhythm budget (native 1.0x 4.70 ups Hải Đăng)
est_speak = 0.0
seg_est_wps: dict[str, float] = {}
for s in segs:
    eng = list(global_english) + list(s.get("english", []))
    seg_default_wps = s.get("wps", script_wps)
    seg_u = 0.0
    seg_t = 0.0
    if s.get("sentences"):
        raw_sents = s["sentences"]
        for j, st in enumerate(raw_sents):
            st_txt = apply_bilingual(st if isinstance(st, str) else st.get("tts_text", st.get("text", "")), eng)
            st_wps = (st.get("wps", seg_default_wps) if isinstance(st, dict) else seg_default_wps) or RH["target_ups"]
            n_emo = sum(1 for tg in TAG_RE.findall(st_txt) if tg.strip().lower() in allowed_tags)
            gap_j = (float(st.get("pause_after", RH["sentence_gap_s"])) if isinstance(st, dict) else float(RH["sentence_gap_s"])) if j + 1 < len(raw_sents) else 0.0
            su = syllable_units(st_txt)
            seg_u += su
            seg_t += su / float(st_wps) + n_emo * float(RH["emotion_cue_s"]) + gap_j
    else:
        sp_txt = seg_spoken_string(s)
        sp_wps = float(seg_default_wps if seg_default_wps is not None else RH["target_ups"])
        s_parts = [x for x in SENT_SPLIT_RE.split(re.sub(r"\.{3,}", "…", sp_txt.strip())) if x.strip()]
        n_emo = sum(1 for tg in TAG_RE.findall(sp_txt) if tg.strip().lower() in allowed_tags)
        su = syllable_units(sp_txt)
        seg_u += su
        seg_t += su / sp_wps + n_emo * float(RH["emotion_cue_s"]) + max(0, len(s_parts) - 1) * float(RH["sentence_gap_s"])
    est_speak += seg_t
    seg_pa = float(s.get("pause_after", dflt))
    seg_est_wps[s["id"]] = seg_u / max(seg_t + seg_pa * 0.5, 0.25)
est = est_speak + pause

lo, hi = PA["episode"]["segments"]
if not lo <= len(segs) <= hi:
    err("SC-04", f"{len(segs)} segments; house pacing is {lo}-{hi} (pacing.json)")
wlo, whi = PA["episode"]["words"]
if not wlo <= len(words) <= whi:
    err("SC-05", f"{len(words)} spoken words; house budget {wlo}-{whi} (= {PA['episode']['voice_s'][0]}-{PA['episode']['voice_s'][1]} s at {RH['target_ups']} ups Hải Đăng) — cut or add a beat")
slo, shi = PA["episode"]["voice_s"]
if not slo <= est <= shi:
    err("SC-05", f"estimated {est:.0f} s outside {slo}-{shi} s (target {PA['episode']['voice_s_target']} s)")
plo, phi = PA["voice"]["pause_after_s"]
for s in segs:
    pa = float(s.get("pause_after", dflt))
    if not plo <= pa <= phi:
        err("SC-18", f"{s['id']}: pause_after {pa} outside {plo}-{phi} s")

# ---- text sent to the voice (standards/voice_standard.json -> text: digits, <en> balance, emotion tags) ----
for s in segs:
    texts_to_check = [s["text"]]
    if "tts_text" in s:
        texts_to_check.append(s["tts_text"])
    for st in s.get("sentences", []):
        texts_to_check.append(st if isinstance(st, str) else st.get("tts_text", st.get("text", "")))
    spoken_t = seg_spoken_string(s)
    clean_spoken = strip_markup(spoken_t)
    if VS["no_digits"] and re.search(r"\d", clean_spoken):
        err("SC-15", f"{s['id']}: digits in the spoken text — write numbers in words (in text, or in tts_text)")
    if VS.get("no_ellipsis") and ("..." in clean_spoken or "…" in clean_spoken):
        err("SC-16", f"{s['id']}: '…' in the spoken text")
    for raw_t in texts_to_check:
        stripped_en = EN_SPAN_RE.sub("", raw_t)
        if re.search(r"</?en\b", stripped_en, flags=re.I):
            err("SC-16", f"{s['id']}: unbalanced or nested <en>...</en> bilingual tag")
        tags = [x.strip() for x in TAG_RE.findall(raw_t)]
        bad_t = [x for x in tags if x.lower() not in allowed_tags]
        if bad_t:
            err("SC-17", f"{s['id']}: unsupported emotion tag(s) {bad_t} — allowed: {sorted(allowed_tags)}")

_is_short = _len not in ("long", "long_16x9")
_seg_w_err = int(DNA_PROSE.get("words_per_seg_err", 34)) if _is_short else 45
_seg_w_warn = int(DNA_PROSE.get("words_per_seg_warn", 26)) if _is_short else 45
for s in segs:
    n = len(strip_markup(s["text"]).split())
    if n > _seg_w_err:
        err("SC-06", f"{s['id']}: {n} words in one segment (max {_seg_w_err}) — split it, each segment is a picture change")
    elif _is_short and n > _seg_w_warn:
        warn("SC-06", f"{s['id']}: {n} words in one segment (> {_seg_w_warn} target for breathable Shorts) — consider splitting")
    if n < 2:
        warn("SC-06", f"{s['id']}: only {n} words")

# ---- rhythm ----
sentences = [
    x.strip()
    for s in segs
    for x in SENT_SPLIT_RE.split(re.sub(r"\.{3,}", "…", strip_markup(s["text"])))
    if x.strip()
]
lens = [len(x.split()) for x in sentences if x.split()]
_sent_max_err = int(DNA_PROSE.get("sent_max_err", 20)) if _is_short else 24
_sent_max_warn = int(DNA_PROSE.get("sent_max_warn", 18)) if _is_short else 24
if lens:
    mean, sd = statistics.mean(lens), statistics.pstdev(lens)
    if sd < 3.0:
        err("SC-07", f"sentence length SD {sd:.1f} < 3.0 — monotone rhythm; mix short punches with long build-ups (reference 4.3)")
    if not 6 <= mean <= 13:
        warn("SC-07", f"mean sentence length {mean:.1f} words (reference 7.8)")
    long = [x for x in sentences if len(x.split()) > _sent_max_err]
    for x in long:
        err("SC-08", f"sentence of {len(x.split())} words (> {_sent_max_err}): \"{x[:60]}...\"")
    if _is_short:
        for x in sentences:
            if _sent_max_warn < len(x.split()) <= _sent_max_err:
                warn("SC-08", f"sentence of {len(x.split())} words (> {_sent_max_warn} target for breathable Shorts): \"{x[:60]}...\"")
    shorts = [x for x in sentences if len(x.split()) <= 5]
    if len(shorts) < 6:
        err("SC-09", f"only {len(shorts)} short sentences (<= 5 words; minimum 6, target >= 10) — punch lines need room to land")
    elif len(shorts) < 10:
        warn("SC-09", f"{len(shorts)} short sentences (<= 5 words; survey target >= 10)")
else:
    mean = sd = 0

# ---- dialect: northern narrator (Hải Đăng), excluding <en>...</en> spans ----
SOUTH_ERR = ["hông", "nhen", "nghen", "tui", "ổng", "hổng", "dìa", "mần", "hổm", "bển", "dzô", "dzậy", "zậy", "hen", "nè", "vầy"]
SOUTH_WARN = {"heo": "lợn", "muỗng": "thìa", "xài": "dùng", "mắc": "đắt (nếu là giá)", "bả": "bà ấy", "trái": "quả (nếu là hoa quả)", "kêu": "gọi/bảo", "chén": "bát"}
vi_only_words = []
for s in segs:
    sp = seg_spoken_string(s)
    no_en = EN_SPAN_RE.sub(" ", TAG_RE.sub(" ", sp))
    vi_only_words.extend(no_en.split())
toks = [re.sub(r"[^\w]", "", w.lower()) for w in vi_only_words if re.sub(r"[^\w]", "", w.lower())]
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

# ---- structural spine & anti-catalogue checks (v3.4.0+: SC-20..26) ----
FIRST_PERSON_RE = re.compile(r"\b(tôi|mình|nhà tôi|bố tôi|mẹ tôi|chúng tôi)\b", re.I)
PROTAG_RE = re.compile(
    r"\b(tôi|mình|chúng tôi|nhà tôi|bố tôi|mẹ tôi|em tôi|anh tôi|chị tôi|ông tôi|bà tôi|hai anh em|hai bố con|hai mẹ con|hai chị em)\b",
    re.I,
)
URGENCY_RE = re.compile(
    r"\b(phút|giây|tiếng|nửa đêm|giao thừa|trước khi|hạn cuối|còn đúng|đếm ngược|kịp|sắp|cháy|nổ|ngạt|ngập|tràn|đóng cửa|tắt đèn|cạn|mất|thứ bảy|sinh nhật)\b",
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
    active_mid = sum(1 for s in mid_segs if PROTAG_RE.search(strip_markup(s["text"])))
    if active_mid / len(mid_segs) < 0.25:
        err(
            "SC-20",
            f"passive middle ({active_mid}/{len(mid_segs)} segments in 35%-70% involve narrator/household; need >= 25%) — cut neighbour catalogue and keep protagonist acting",
        )

# SC-24: button length <= 12 words + ban stated morals & magic-denial endings
if segs:
    btn_words = len(strip_markup(segs[-1]["text"]).split())
    if btn_words > 14:
        err("SC-24", f"final Button segment ({segs[-1]['id']}) is {btn_words} words (> 14) — tighten to <= 12 words")
    elif btn_words > 12:
        warn("SC-24", f"final Button segment ({segs[-1]['id']}) is {btn_words} words (target <= 12)")
    tail_txt = " ".join(strip_markup(s["text"]) for s in segs[-3:])
    if m := MORAL_RE.search(tail_txt):
        err("SC-24", f"stated moral cliché near ending ('{m.group(0)}') — replace with deadpan story button")
    if m := MAGIC_DENIAL_RE.search(tail_txt):
        err("SC-24", f"magic-denial/dream twist near ending ('{m.group(0)}') — climax must work inside the rule")

# SC-25 (script half): narrator enters by s7
has_early_protag = bool(segs) and any(FIRST_PERSON_RE.search(strip_markup(s["text"])) for s in segs[:7])
if segs and not has_early_protag:
    err("SC-25", "first-person narrator ('tôi'/'mình') does not appear in s1..s7 — enter early with a personal stake")

# SC-23: brief.md Archetype declaration + urgency cues in 35%-85% for trap archetypes
brief_path = ROOT / "brief.md"
brief = brief_path.read_text() if brief_path.exists() else ""
if brief_path.exists():
    arch_m = re.search(r"^##\s+Archetype\b(.*?)(?=^##\s+|\Z)", brief, re.M | re.S)
    arch_sec = arch_m.group(1) if arch_m else ""
    valid_archs = ("Personal Rule-Trap", "Systemic Satire", "Hybrid VN Trap")
    chosen_arch = next((a for a in valid_archs if a.lower() in arch_sec.lower()), None)
    if not arch_m or "TODO" in arch_sec or not chosen_arch:
        err("SC-23", "brief.md ## Archetype missing, has TODO, or does not choose one of: Personal Rule-Trap | Systemic Satire | Hybrid VN Trap")
    elif chosen_arch in ("Personal Rule-Trap", "Hybrid VN Trap") and len(segs) >= 10:
        u_lo = int(len(segs) * 0.35)
        u_hi = max(u_lo + 1, int(len(segs) * 0.85))
        u_txt = " ".join(strip_markup(s["text"]) for s in segs[u_lo:u_hi])
        if not URGENCY_RE.search(u_txt):
            warn("SC-23", f"archetype '{chosen_arch}' has no visible ticking-clock/urgency cue in 35%-85% of segments")

# ---- 10-year-old kid-storytelling, linear worldbuilding, emotional triad & anti-drone guards (v5.5.0: SC-32..35) ----
REWIND_RE = re.compile(
    r"\b(mọi chuyện bắt đầu|quay lại lúc|quay ngược lại|trước đó ba phút|trước đó năm phút|trước đó mười phút|ba phút trước|năm phút trước đó|mười phút trước đó)\b",
    re.I,
)
for s in segs[:15]:
    if m := REWIND_RE.search(strip_markup(s["text"])):
        _rw_msg = (
            f"{s['id']}: disorienting flashback-rewind in opening ('{m.group(0)}') — "
            "establish the everyday school/home world & character clearly first, then trigger the inciting incident linearly so a 10-year-old follows every beat"
        )
        if _len == "long_16x9":
            err("SC-32", _rw_msg)
        else:
            warn("SC-32", _rw_msg)
if _len == "long_16x9" and brief_path.exists():
    if not re.search(r"^##\s+(?:World|Thiết lập thế giới)\b", brief, re.M | re.I):
        warn(
            "SC-32",
            "long_16x9 brief.md should include '## World & Tone' / '## Thiết lập thế giới' defining normal state, 1-sentence 10yo rule, and Cute/Spooky/Curious tone",
        )

STIFF_PROSE_RE = re.compile(
    r"\b(bất khả xâm phạm|gạt bỏ hết hiềm khích|nặng nề áp bức|thế kẹt hai chiều|bản năng săn mồi lập tức|hệ quả tất yếu|cục diện thay đổi|vô hình trung|tối hậu thư|triết lý nhân sinh)\b",
    re.I,
)
stiff_hits = []
for s in segs:
    for m in STIFF_PROSE_RE.finditer(strip_markup(s["text"])):
        stiff_hits.append((s["id"], m.group(0)))
if _len == "long_16x9" and len(stiff_hits) >= 2:
    sample_stiff = ", ".join(f"{sid}: '{ph}'" for sid, ph in stiff_hits[:5])
    err("SC-33", f"{len(stiff_hits)} stiff adult/textbook clichés ({sample_stiff}) — rewrite in crisp, concrete 10-year-old wording")
elif len(stiff_hits) == 1 or (_len != "long_16x9" and len(stiff_hits) >= 1):
    sample_stiff = ", ".join(f"{sid}: '{ph}'" for sid, ph in stiff_hits[:5])
    warn("SC-33", f"stiff adult/textbook phrase ({sample_stiff}) — prefer concrete kid-friendly wording")

if _len == "long_16x9":
    for s in segs:
        n = len(strip_markup(s["text"]).split())
        if n > 30:
            err("SC-33", f"{s['id']}: {n} words (> 30 max for brisk 10yo long_16x9) — split into shorter 1-2 sentence beats")
        elif n > 26:
            warn("SC-33", f"{s['id']}: {n} words (> 26 target for brisk 10yo long_16x9) — tighten or split beat")
    for x in sentences:
        if len(x.split()) > 21:
            err("SC-33", f"sentence of {len(x.split())} words (> 21 max for 10yo clarity): \"{x[:60]}...\"")
    if lens and mean > 11.2:
        warn("SC-33", f"mean sentence length {mean:.1f} words (> 11.2) — keep sentences crisp and concrete for 10-year-olds")

LIVE_EXCL_RE = re.compile(r"[!?]|\b(?:ê|này|suỵt|á|ơ|khoan)\b", re.I)
INDIRECT_RE = re.compile(
    r"\b(?:(?:cậu ta|cô ấy|nó)\s+(?:cười khẩy\s+)?(?:bảo|phán)(?:\s+rằng)?\b|"
    r"giải thích nhanh\s*:|"
    r"(?:phán|thừa nhận)\s+rằng\b|"
    r"thừa nhận\s+đi\b|"
    r"(?:lẩm bẩm|thì thầm)\s+(?:bảo|xin lỗi)\b)",
    re.I,
)
CUTE_RE = re.compile(
    r"\b(cười|tủm tỉm|dễ thương|đáng yêu|tròn xoe|ấm áp|bánh quy|kẹo|nhột|bụng sôi|gãi đầu|ngơ ngác|vẫy đuôi|cụng râu|má phúng phính)\b",
    re.I,
)
SPOOKY_RE = re.compile(
    r"\b(rợn|lạnh toát|lạnh gáy|bóng đen|thình thịch|im phắc|nín thở|rùng mình|tối om|phát sáng|kẽo kẹt|suỵt|thì thầm|gai ốc)\b",
    re.I,
)
CURIOUS_RE = re.compile(
    r"\b(tò mò|kỳ lạ|bí mật|hóa ra|phát hiện|lấp lánh|óng ánh|khổng lồ|tí hon|tại sao|làm sao|chuyện gì)\b",
    re.I,
)
if _len == "long_16x9" and segs:
    quoted_n = sum(1 for s in segs if any(q in s["text"] for q in ("“", "”", '"')))
    conversational_n = sum(
        1 for s in segs if any(q in s["text"] for q in ("“", "”", '"')) or LIVE_EXCL_RE.search(strip_markup(s["text"]))
    )
    if quoted_n < max(8, int(len(segs) * 0.16)):
        err(
            "SC-34",
            f"only {quoted_n}/{len(segs)} segments contain direct quoted dialogue (“...”) — write vivid kid dialogue instead of dry third-person summary (need >= 16%, conversational={conversational_n}/{len(segs)})",
        )
    full_txt = " ".join(strip_markup(s["text"]) for s in segs)
    indirect_hits = len(INDIRECT_RE.findall(full_txt))
    if indirect_hits >= 4:
        warn("SC-34", f"{indirect_hits} indirect reporting phrases ('cậu ta bảo...', 'giải thích nhanh:...') — turn summary into live spoken lines")
    triad_counts = {
        "Cute/Funny": len(CUTE_RE.findall(full_txt)),
        "Spooky-Fun": len(SPOOKY_RE.findall(full_txt)),
        "Curious": len(CURIOUS_RE.findall(full_txt)),
    }
    thin_regs = [f"{reg}={cnt} (<3)" for reg, cnt in triad_counts.items() if cnt < 3]
    if thin_regs:
        warn(
            "SC-34",
            f"Emotional Triad thin/missing register(s): {', '.join(thin_regs)} — weave >= 3 beats in each of Cute/Funny, Spooky-Fun, and Curious",
        )

# SC-35: Native 1.0x Voice Integrity (v3.0 target_ups 4.70) — Ban Artificial Speed Warping!
_base_ups = float(RH.get("target_ups", 5.05))
_top_lo, _top_hi = round(_base_ups - 0.30, 2), round(_base_ups + 0.25, 2)
_seg_lo, _seg_hi = round(_base_ups - 0.70, 2), round(_base_ups + 0.35, 2)
if script_wps is not None:
    try:
        top_wps_val = float(script_wps)
        if not (_top_lo <= top_wps_val <= _top_hi):
            err(
                "SC-35",
                f"top-level script 'wps' is {script_wps} (outside [{_top_lo}, {_top_hi}]) — keep the native 1.0x {_base_ups} ups Hải Đăng voice standard",
            )
    except (TypeError, ValueError):
        err("SC-35", f"top-level script 'wps' ({script_wps!r}) must be numeric in [{_top_lo}, {_top_hi}]")

if segs:
    custom_wps_segs = 0
    for s in segs:
        seg_has_custom_wps = False
        if s.get("wps") is not None:
            seg_has_custom_wps = True
            try:
                v = float(s["wps"])
                if not (_seg_lo <= v <= _seg_hi):
                    err(
                        "SC-35",
                        f"{s['id']}: custom 'wps' {v} outside [{_seg_lo}, {_seg_hi}] — never warp VieNeu-TTS faster than {_seg_hi} or slower than {_seg_lo} ups",
                    )
            except (TypeError, ValueError):
                err("SC-35", f"{s['id']}: custom 'wps' ({s['wps']!r}) must be numeric in [{_seg_lo}, {_seg_hi}]")
        for j, st in enumerate(s.get("sentences", []), 1):
            if isinstance(st, dict) and st.get("wps") is not None:
                seg_has_custom_wps = True
                try:
                    v = float(st["wps"])
                    if not (_seg_lo <= v <= _seg_hi):
                        err(
                            "SC-35",
                            f"{s['id']}.{j}: custom sentence 'wps' {v} outside [{_seg_lo}, {_seg_hi}] — never warp VieNeu-TTS faster than {_seg_hi} or slower than {_seg_lo} ups",
                        )
                except (TypeError, ValueError):
                    err("SC-35", f"{s['id']}.{j}: custom sentence 'wps' ({st['wps']!r}) must be numeric in [{_seg_lo}, {_seg_hi}]")
        if seg_has_custom_wps:
            custom_wps_segs += 1

    if custom_wps_segs / len(segs) > 0.10:
        warn(
            "SC-35",
            f"{custom_wps_segs}/{len(segs)} segments ({custom_wps_segs / len(segs):.0%} > 10%) set custom 'wps' overrides — keep 90-100% of segments at the native {_base_ups} ups default; pacing comes from crisp short sentences and pauses, not warping audio",
        )

    pa_list = [float(s.get("pause_after", dflt)) for s in segs]
    mean_pa = sum(pa_list) / len(pa_list)
    if mean_pa > 0.50 or mean_pa < 0.14:
        err(
            "SC-35",
            f"mean pause_after is {mean_pa:.2f}s (outside [0.14, 0.50]s; house default is {PA['voice']['default_pause_after_s']}s)",
        )

# SC-36: Crystal-Clear Spoken Hook & Plain Kid-Friendly Sentences (long_16x9)
HOOK_CUE_RE = re.compile(
    r"\?|\b(?:tưởng tượng|chuyện gì|điều gì|bỗng dưng|bất ngờ|bí mật|kỳ lạ|tí hon|thu nhỏ|khổng lồ)\b",
    re.I,
)
MECHANICAL_JARGON_RE = re.compile(
    r"\b(đòn bẩy loại\s+(?:một|hai|ba|1|2|3)|cấu trúc đòn bẩy|tâm điểm tựa|khóa chốt tự động|cơ chế thu phóng|hệ thống quang học)\b",
    re.I,
)


def _spoken_sentences_of(s: dict) -> list[tuple[str, list[str]]]:
    raw_chunks = (
        [st if isinstance(st, str) else st.get("tts_text", st.get("text", "")) for st in s["sentences"]]
        if s.get("sentences")
        else [seg_spoken_string(s)]
    )
    out_sents = []
    for chunk in raw_chunks:
        clean_chunk = strip_markup(chunk)
        for part in re.split(r"[.!?…]+", clean_chunk):
            wlist = re.findall(r"[^\W_]+", part, re.UNICODE)
            if wlist:
                out_sents.append((part.strip(" \t\n\"'“”‘’«»"), wlist))
    return out_sents


if _len == "long_16x9" and segs:
    for s in segs[:5]:
        for sent_txt, wlist in _spoken_sentences_of(s):
            if len(wlist) > 18:
                err(
                    "SC-36",
                    f"{s['id']}: opening hook sentence has {len(wlist)} words (> 18 max for 10yo hook clarity): \"{sent_txt[:60]}...\"",
                )
    hook3_spoken = " ".join(strip_markup(seg_spoken_string(s)) + " " + strip_markup(s["text"]) for s in segs[:3])
    if not HOOK_CUE_RE.search(hook3_spoken):
        err(
            "SC-36",
            "opening hook (s1..s3) lacks an immediate wonder/curiosity cue ('?' or tưởng tượng/chuyện gì/điều gì/bỗng dưng/bất ngờ/bí mật/kỳ lạ/tí hon/thu nhỏ/khổng lồ)",
        )

    all_spoken_sents = [
        (s["id"], sent_txt, len(wlist))
        for s in segs
        for sent_txt, wlist in _spoken_sentences_of(s)
    ]
    if all_spoken_sents:
        spoken_mean = statistics.mean(wc for _, _, wc in all_spoken_sents)
        if spoken_mean > 15.5:
            err(
                "SC-36",
                f"mean spoken sentence length is {spoken_mean:.1f} words (> 15.5 max; target 9-14 words/sentence for 10-year-old clarity)",
            )
        for sid, sent_txt, wc in all_spoken_sents:
            if wc > 24:
                err(
                    "SC-36",
                    f"{sid}: spoken sentence has {wc} words (> 24 max): \"{sent_txt[:60]}...\"",
                )

    jargon_hits = []
    for s in segs:
        seen_in_seg = set()
        for candidate_txt in (strip_markup(s["text"]), strip_markup(seg_spoken_string(s))):
            for m in MECHANICAL_JARGON_RE.finditer(candidate_txt):
                key = m.group(0).lower()
                if key not in seen_in_seg:
                    seen_in_seg.add(key)
                    jargon_hits.append((s["id"], m.group(0)))
    if jargon_hits:
        sample_jg = ", ".join(f"{sid}: '{ph}'" for sid, ph in jargon_hits[:5])
        err(
            "SC-36",
            f"stiff textbook/mechanical jargon ({sample_jg}) — explain mechanics like a 10-year-old ('bập bênh bút chì', 'nút bấm màu xanh')!",
        )

# SC-37: Mandatory Episodic 'units' Chapter Plan (long_16x9)
if _len == "long_16x9":
    units = script.get("units")
    if not isinstance(units, list) or not (4 <= len(units) <= 9) or not all(isinstance(u, dict) for u in units):
        err(
            "SC-37",
            "long_16x9 script.json must declare 'units' (4-9 standalone episodic chapters of ~2-2.5 min / 15-42 segments each, validated one unit at a time before advancing)",
        )
    else:
        valid_scale_modes = {"normal", "tiny", "mixed"}
        expected_start_idx = 0
        bounds_valid = True
        for u_idx, u in enumerate(units, 1):
            exp_uid = f"U{u_idx}"
            uid = u.get("id")
            if uid != exp_uid:
                err("SC-37", f"units[{u_idx - 1}].id is {uid!r} (expected {exp_uid!r} in exact order U1..U{len(units)})")
            utitle = u.get("title")
            if not isinstance(utitle, str) or not utitle.strip():
                err("SC-37", f"{exp_uid}: 'title' must be a non-empty string")
            smode = u.get("scale_mode")
            if smode not in valid_scale_modes:
                err("SC-37", f"{exp_uid}: 'scale_mode' is {smode!r} (must be one of 'normal', 'tiny', 'mixed')")
            s_start = u.get("seg_start")
            s_end = u.get("seg_end")
            if not isinstance(s_start, str) or s_start not in id_to_idx:
                err("SC-37", f"{exp_uid}: seg_start {s_start!r} not found in script.json segments")
                bounds_valid = False
                continue
            if not isinstance(s_end, str) or s_end not in id_to_idx:
                err("SC-37", f"{exp_uid}: seg_end {s_end!r} not found in script.json segments")
                bounds_valid = False
                continue
            a_i = id_to_idx[s_start]
            b_i = id_to_idx[s_end]
            if b_i < a_i:
                err("SC-37", f"{exp_uid}: seg_end {s_end!r} comes before seg_start {s_start!r}")
                bounds_valid = False
                continue
            unit_seg_count = b_i - a_i + 1
            if not (12 <= unit_seg_count <= 45):
                err(
                    "SC-37",
                    f"{exp_uid} ({s_start}..{s_end}): has {unit_seg_count} segments (must be 12-45 segments per unit)",
                )
            if segs and a_i != expected_start_idx:
                exp_sid = ids[expected_start_idx] if expected_start_idx < len(ids) else "END"
                err(
                    "SC-37",
                    f"{exp_uid}: seg_start is {s_start!r} but expected {exp_sid!r} (units must partition {ids[0]}..{ids[-1]} contiguously in exact order with 0 gaps and 0 overlaps)",
                )
            expected_start_idx = b_i + 1
        if segs and bounds_valid and expected_start_idx != len(segs):
            err(
                "SC-37",
                f"units end at {units[-1].get('seg_end')!r} instead of final segment {ids[-1]!r} (units must cover {ids[0]}..{ids[-1]} with 0 trailing segments)",
            )

# ---- beats map ----
beats = (ROOT / "beats.md").read_text() if (ROOT / "beats.md").exists() else ""
if not beats or "TODO" in beats:
    err("SC-12", "beats.md missing or still has TODO")
else:
    for h in ["## Spine", "## Plant & Payoff", "## Hook", "## Setup", "## Escalation", "## Turn", "## Payoff", "## Button", "## Segment map"]:
        if h not in beats:
            err("SC-12", f"beats.md lacks section '{h}'")
    spine = beats.split("## Spine", 1)[1].split("\n## ", 1)[0] if "## Spine" in beats else ""
    causal_lines = [ln.strip() for ln in spine.splitlines() if re.match(r"^\s*-\s*(vì thế|nhưng)\b", ln, re.I)]
    if len(causal_lines) < 4:
        err("SC-19", f"beats.md ## Spine has {len(causal_lines)} causal links; write the chain as >= 4 '- vì thế …' / '- nhưng …' lines")

    prev_idx = -1
    spine_spans = []
    for ln in causal_lines:
        tags = re.findall(r"\[(s\d+[a-z]?)(?:\s*[-–>→]+\s*(s\d+[a-z]?))?\]", ln, re.I)
        if not tags:
            err("SC-26", f"Spine line missing [sN] or [sN-sM] segment citation: '{ln[:60]}'")
            continue
        first_sid = tags[0][0].lower()
        line_idxs = []
        for a_sid, b_sid in tags:
            for sid in (a_sid.lower(), b_sid.lower()) if b_sid else (a_sid.lower(),):
                if sid not in id_to_idx:
                    err("SC-26", f"Spine cites unknown segment '{sid}' not in script.json")
                else:
                    line_idxs.append(id_to_idx[sid])
            if b_sid and a_sid.lower() in id_to_idx and b_sid.lower() in id_to_idx:
                if id_to_idx[b_sid.lower()] < id_to_idx[a_sid.lower()]:
                    err("SC-26", f"Spine range [{a_sid}-{b_sid}] is out of order")
        if first_sid in id_to_idx:
            if id_to_idx[first_sid] < prev_idx:
                err("SC-26", f"Spine causal line '{ln[:50]}' goes backwards in segment order")
            prev_idx = id_to_idx[first_sid]
        if line_idxs:
            spine_spans.append((min(line_idxs), max(line_idxs)))

    # SC-31: long_16x9 anti-padding / causal event-density guard
    if _len == "long_16x9":
        if len(causal_lines) < 12:
            err(
                "SC-31",
                f"long_16x9 beats.md ## Spine has {len(causal_lines)} causal links (< 12) — require >= 12 '- vì thế' / '- nhưng' [sA-sB] lines (~1 causal turn per 50 s)",
            )
        elif len(spine_spans) < 12:
            err(
                "SC-31",
                f"long_16x9 beats.md ## Spine has only {len(spine_spans)} causal lines with valid [sA-sB] citations (< 12)",
            )
        for (_, prev_e), (next_s, _) in zip(spine_spans, spine_spans[1:]):
            gap = next_s - prev_e - 1
            if gap > 15:
                warn(
                    "SC-31",
                    f"narrative drift: {gap} segments ({ids[prev_e + 1]}..{ids[next_s - 1]}) between consecutive Spine citations [{ids[prev_e]}] and [{ids[next_s]}] (> 15 segments without a causal turn)",
                )

    # SC-29: long_16x9 5-chapter structural spine integrity
    if _len == "long_16x9":
        ch_matches = list(re.finditer(r"^###\s+(?:Chapter|Chương|Hồi)\s+([1-5])\b", beats, re.M | re.I))
        chapters = {}
        for m in ch_matches:
            ch_num = int(m.group(1))
            if ch_num not in chapters:
                head_end = beats.find("\n", m.start())
                if head_end == -1:
                    head_end = len(beats)
                ch_head = beats[m.start():head_end]
                nxt_h = re.search(r"^#{2,3}\s+", beats[head_end:], re.M)
                block_end = head_end + nxt_h.start() if nxt_h else len(beats)
                ch_body = beats[head_end:block_end]
                chapters[ch_num] = (ch_head, ch_body)
        missing_chs = [c for c in range(1, 6) if c not in chapters]
        if missing_chs:
            err("SC-29", f"long_16x9 beats.md missing required 5-chapter heading(s): Chapters {missing_chs} (expected '### Chapter/Chương/Hồi 1..5')")

        def _has_ch_beat(clean_txt: str, label_pat: str) -> bool:
            return bool(
                re.search(
                    rf"^\s*(?:[-+•]\s*)?(?:{label_pat})\b(?:\s*(?:\([^)\n]*\)|\[[^\]\n]*\]|/\s*[^:\n—–-]{{1,30}}))*\s*[:—–-]\s*\S",
                    clean_txt,
                    re.M | re.I,
                )
            )

        ch_span_re = re.compile(r"\[(s\d+[a-z]?)\s*[-–—>→]+\s*(s\d+[a-z]?)\]", re.I)
        for ch_num in sorted(chapters):
            ch_head, ch_body = chapters[ch_num]
            clean_body = re.sub(r"[*_`]", "", ch_body)
            if not _has_ch_beat(clean_body, r"Goal|Mục\s+tiêu"):
                err("SC-29", f"Chapter {ch_num} missing structured 'Goal' / 'Mục tiêu' beat line")
            if not _has_ch_beat(clean_body, r"Obstacle|Chướng\s+ngại"):
                err("SC-29", f"Chapter {ch_num} missing structured 'Obstacle' / 'Chướng ngại' beat line")
            if not _has_ch_beat(clean_body, r"Turn|Bước\s+ngoặt"):
                err("SC-29", f"Chapter {ch_num} missing structured 'Turn' / 'Bước ngoặt' beat line")
            if ch_num <= 4:
                if not _has_ch_beat(clean_body, r"Mini[- ]?Cliffhanger|Cliffhanger"):
                    err("SC-29", f"Chapter {ch_num} missing structured 'Mini-Cliffhanger' / 'Cliffhanger' beat line")
            else:
                if not _has_ch_beat(clean_body, r"Ending|Kết\s+mở|Payoff"):
                    err("SC-29", "Chapter 5 missing structured 'Ending' / 'Kết mở' / 'Payoff' beat line")

            head_spans = ch_span_re.findall(ch_head)
            body_spans = ch_span_re.findall(ch_body)
            chosen_span = None
            if head_spans:
                chosen_span = head_spans[0]
            elif body_spans:
                valid_body = [
                    (a, b) for a, b in body_spans
                    if a.lower() in id_to_idx and b.lower() in id_to_idx and id_to_idx[b.lower()] >= id_to_idx[a.lower()]
                ]
                chosen_span = max(valid_body, key=lambda ab: id_to_idx[ab[1].lower()] - id_to_idx[ab[0].lower()]) if valid_body else body_spans[0]

            if not chosen_span:
                err("SC-29", f"Chapter {ch_num} missing [sA-sB] segment span citing script.json segments")
            elif ids:
                a_sid, b_sid = chosen_span[0].lower(), chosen_span[1].lower()
                if a_sid not in id_to_idx or b_sid not in id_to_idx:
                    err("SC-29", f"Chapter {ch_num} span [{a_sid}-{b_sid}] cites unknown segment not in script.json")
                elif id_to_idx[b_sid] < id_to_idx[a_sid]:
                    err("SC-29", f"Chapter {ch_num} span [{a_sid}-{b_sid}] is out of order")
                else:
                    ch_len = id_to_idx[b_sid] - id_to_idx[a_sid] + 1
                    ch_pct = ch_len / len(ids)
                    if not 0.10 <= ch_pct <= 0.34:
                        err(
                            "SC-29",
                            f"Chapter {ch_num} span [{a_sid}-{b_sid}] is {ch_len}/{len(ids)} segments ({ch_pct:.0%}; must be 10%-34%)",
                        )

    if "## Plant & Payoff" in beats and ids:
        pp_sec = beats.split("## Plant & Payoff", 1)[1].split("\n## ", 1)[0]
        if _len == "long_16x9":
            # SC-30: multi-knot 3+ Plant-to-Payoff verification
            clean_pp = re.sub(r"[*_`]", "", pp_sec)
            p_matches = [(m.group(1), m.group(2).lower()) for m in re.finditer(r"Plant(?:\s*#?\s*(\d+))?\s*:\s*(s\d+[a-z]?)\b", clean_pp, re.I)]
            y_matches = [(m.group(1), m.group(2).lower()) for m in re.finditer(r"Payoff(?:\s*#?\s*(\d+))?\s*:\s*(s\d+[a-z]?)\b", clean_pp, re.I)]
            for _, p_sid in p_matches:
                if p_sid not in id_to_idx:
                    err("SC-30", f"Plant segment '{p_sid}' does not exist in script.json")
            for _, y_sid in y_matches:
                if y_sid not in id_to_idx:
                    err("SC-30", f"Payoff segment '{y_sid}' does not exist in script.json")
            pairs = []
            used_p, used_y = set(), set()
            y_num_idx = {}
            for yi, (yn, _) in enumerate(y_matches):
                if yn is not None and yn not in y_num_idx:
                    y_num_idx[yn] = yi
            for pi, (pn, p_sid) in enumerate(p_matches):
                if pn is not None and pn in y_num_idx and y_num_idx[pn] not in used_y:
                    yi = y_num_idx[pn]
                    pairs.append((p_sid, y_matches[yi][1]))
                    used_p.add(pi)
                    used_y.add(yi)
            rem_p = [p_sid for pi, (_, p_sid) in enumerate(p_matches) if pi not in used_p]
            rem_y = [y_sid for yi, (_, y_sid) in enumerate(y_matches) if yi not in used_y]
            for p_sid, y_sid in zip(rem_p, rem_y):
                pairs.append((p_sid, y_sid))
            valid_pairs = []
            for p_sid, y_sid in pairs:
                if p_sid not in id_to_idx or y_sid not in id_to_idx:
                    continue
                p_pct = (id_to_idx[p_sid] + 1) / len(ids)
                y_pct = (id_to_idx[y_sid] + 1) / len(ids)
                pair_ok = True
                if p_pct > 0.55:
                    err("SC-30", f"Plant {p_sid} is at {p_pct:.0%} (> 55%) — plant within first 55% of segments")
                    pair_ok = False
                if y_pct < 0.60:
                    err("SC-30", f"Payoff {y_sid} is at {y_pct:.0%} (< 60%) — pay off at >= 60% of segments")
                    pair_ok = False
                if id_to_idx[p_sid] >= id_to_idx[y_sid]:
                    err("SC-30", f"Plant ({p_sid}) must come before Payoff ({y_sid})")
                    pair_ok = False
                if pair_ok:
                    valid_pairs.append((p_sid, y_sid))
            distinct_plants = {p for p, _ in valid_pairs}
            distinct_payoffs = {y for _, y in valid_pairs}
            if len(distinct_plants) < 3 or len(distinct_payoffs) < 3:
                err(
                    "SC-30",
                    f"long_16x9 ## Plant & Payoff requires >= 3 distinct Plants (<= 55%) paired with >= 3 distinct Payoffs (>= 60%) with Plant < Payoff (got {len(distinct_plants)} distinct plants, {len(distinct_payoffs)} distinct payoffs)",
                )
        else:
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

first = strip_markup(segs[0]["text"]) if segs else ""
# SC-28 (warn): sentences the TTS often mangles (flat f0, swallowed or doubled syllables) — the take then fails
# G3 and the segment is re-made several times. A short tts_text spelling avoids the retries before the voice is made.
ONO_RE = re.compile(r"^(\w+)([ ,\-]+\1)*$", re.I)   # "cộp cộp", "bùm", "tách, tách"
# NOTE only, never a warning: re-measured 2026-11-19 on 6 episodes / 452 sentences, flagged sentences were re-taken
# 8/34 vs 36/418 — but all 8 come from one episode (di-bo: 8/22 vs 13/68); the other 5 episodes 0/12. Not a reliable
# predictor, so it must not cost a re-write; it is printed as a tip and kept out of qa/script_lint.json warns.
notes = []
for s in segs:
    raw_sents = s.get("sentences") or [x for x in SENT_SPLIT_RE.split(s["text"]) if x.strip()]
    if "tts_text" in s:
        continue
    hits = []
    for st in raw_sents:
        if isinstance(st, dict) and "tts_text" in st:
            continue
        txt = st if isinstance(st, str) else st.get("text", "")
        bare = strip_markup(TAG_RE.sub(" ", txt)).strip()
        words_ = re.findall(r"\w+", bare)
        if 0 < len(words_) <= 3 or (words_ and ONO_RE.match(" ".join(w.lower() for w in words_))) \
                or re.match(r"^[\"“'‘«]\s*(…|\.\.\.)", txt.strip()):
            hits.append(bare[:24])
    if len(hits) >= 2 or (hits and len(raw_sents) == 1):
        notes.append(f"SC-28 {s['id']}: {len(hits)} very short / sound-only sentence(s) {hits[:4]} — if a take fails on them, "
                      f"a tts_text that joins them with commas keeps the on-screen text and saves the retries")
_hook_max_w = int(DNA_BEAT.get("hook_s1_max_words", 18)) if _is_short else 20
if len(first.split()) > _hook_max_w:
    err("SC-14", f"s1 is {len(first.split())} words — the hook must land cleanly (<= {_hook_max_w} words)")

# ---- Corpus DNA Breathability, Anti-Ramble & Pacing Guards (v5.9.0: SC-38..43, standards/script_dna_db.json) ----
if segs and lens:
    # SC-38: Prose Breathability & Clause Density
    short_le6_pct = 100.0 * sum(1 for n in lens if n <= 6) / len(lens)
    clauses = [
        c.strip()
        for x in sentences
        for c in re.split(r"[,;:…—–]+", x)
        if c.strip()
    ]
    clause_lens = [len(c.split()) for c in clauses if c.split()]
    clause_mean = statistics.mean(clause_lens) if clause_lens else 0.0
    max_consec_long = 0
    cur_long = 0
    for n in lens:
        if n >= 15:
            cur_long += 1
            max_consec_long = max(max_consec_long, cur_long)
        else:
            cur_long = 0

    if _is_short:
        sm_err = float(DNA_PROSE.get("sent_mean_max_err", 9.5))
        sm_warn = float(DNA_PROSE.get("sent_mean_max_warn", 8.8))
        le6_err = float(DNA_PROSE.get("short_le6_pct_min_err", 28.0))
        le6_warn = float(DNA_PROSE.get("short_le6_pct_min_warn", 35.0))
        cm_err = float(DNA_PROSE.get("clause_mean_max_err", 6.5))
        cm_warn = float(DNA_PROSE.get("clause_mean_max_warn", 6.0))
        consec_max = int(DNA_PROSE.get("consecutive_long_ge15_max", 2))
        if mean > sm_err:
            err("SC-38", f"mean sentence length {mean:.2f}w > {sm_err} (ref median 7.83w) — break dense sentences into staccato beats")
        elif mean > sm_warn:
            warn("SC-38", f"mean sentence length {mean:.2f}w > {sm_warn} target (ref median 7.83w)")
        if short_le6_pct < le6_err:
            err("SC-38", f"only {short_le6_pct:.1f}% sentences <= 6w (< {le6_err}% min; ref median 43.5%) — add punchy 2-6w drops for breathability")
        elif short_le6_pct < le6_warn:
            warn("SC-38", f"{short_le6_pct:.1f}% sentences <= 6w (< {le6_warn}% target; ref median 43.5%)")
        if clause_mean > cm_err:
            err("SC-38", f"mean clause length {clause_mean:.2f}w > {cm_err} (ref median 5.61w) — trim packed clauses")
        elif clause_mean > cm_warn:
            warn("SC-38", f"mean clause length {clause_mean:.2f}w > {cm_warn} target (ref median 5.61w)")
        if max_consec_long > consec_max:
            warn("SC-38", f"{max_consec_long} consecutive long sentences (>= 15w; max {consec_max}) — drop in a short punch sentence")
    else:
        lf_prose = DNA_DB.get("long_16x9", {}).get("prose_breathability", {})
        if mean > float(lf_prose.get("sent_mean_max_warn", 8.5)):
            warn("SC-38", f"long-form mean sentence length {mean:.2f}w > {lf_prose.get('sent_mean_max_warn', 8.5)} (ref long-form 7.75w)")
        if short_le6_pct < float(lf_prose.get("short_le6_pct_min_warn", 35.0)):
            warn("SC-38", f"long-form short sentences <= 6w is {short_le6_pct:.1f}% (< {lf_prose.get('short_le6_pct_min_warn', 35.0)}%; ref 44.7%)")

    # SC-39: Short Live Dialogue, Anti-Indirect-Summary & Anti-AI-Melodrama
    full_clean_txt = " ".join(strip_markup(s["text"]) for s in segs)
    full_lower = full_clean_txt.lower()
    if _is_short:
        quote_matches = re.findall(r"“[^”]+”|\"[^\"]+\"", full_clean_txt)
        min_quotes = int(DNA_DLG.get("min_direct_quotes_warn", 3))
        is_deadpan = bool(re.search(r"deadpan\s+satire|systemic\s+satire", brief, re.I))
        if len(quote_matches) < min_quotes and not is_deadpan:
            warn("SC-39", f"only {len(quote_matches)} direct dialogue quote(s) on Short (ref median 6.5, target >= {min_quotes}) — turn indirect summaries into crisp spoken lines (<= 12w)")
        ind_hits = [p for p in DNA_ANTI.get("indirect_emotion_summary_patterns", []) if re.search(p, full_lower, re.I)]
        melo_hits = [p for p in DNA_ANTI.get("ai_melodrama_phrases", []) if re.search(p, full_lower, re.I)]
        if len(melo_hits) >= 4:
            err("SC-39", f"{len(melo_hits)} AI melodrama clichés ({', '.join(melo_hits[:4])}) — rewrite with plain concrete verbs")
        elif melo_hits:
            warn("SC-39", f"AI melodrama phrase(s) ({', '.join(melo_hits[:4])}) — prefer crisp deadpan concrete wording")
        if ind_hits:
            warn("SC-39", f"indirect emotional summary ({', '.join(ind_hits[:3])}) — replace with direct spoken dialogue")

    # SC-40: Short Scope Economy (Core Named Characters, Core Locations & Plot Props Ceiling)
    if _is_short and brief_path.exists():
        def _count_brief_bullets(heading_re: str) -> int:
            hm = re.search(rf"^##\s+(?:{heading_re})\b(.*?)(?=^##\s+|\Z)", brief, re.M | re.S | re.I)
            if not hm:
                return 0
            body = hm.group(1)
            return sum(
                1 for ln in body.splitlines()
                if re.match(r"^\s*[-*•]\s+\S", ln)
                or re.match(r"^\s*\d+[.)]\s+\S", ln)
                or re.match(r"^\s*\|\s*(?!---|#|tên|name|nhân vật|bối cảnh|đạo cụ|id\b)[^|]+\|", ln, re.I)
            )

        n_chars = _count_brief_bullets(r"Characters|Cast|Nhân vật")
        n_locs = _count_brief_bullets(r"Locations|Sets|Bối cảnh")
        n_props = _count_brief_bullets(r"Props|Đạo cụ")
        c_err, c_warn = int(DNA_SCOPE.get("max_named_active_chars_err", 5)), int(DNA_SCOPE.get("max_named_active_chars_warn", 4))
        l_err, l_warn = int(DNA_SCOPE.get("max_core_locations_err", 5)), int(DNA_SCOPE.get("max_core_locations_warn", 4))
        p_err, p_warn = int(DNA_SCOPE.get("max_plot_props_err", 5)), int(DNA_SCOPE.get("max_plot_props_warn", 4))
        if n_chars >= c_err:
            err("SC-40", f"brief.md lists {n_chars} characters (>= {c_err} ceiling for 9:16 Short; ref 2-3 active chars) — cut 1-line cameos to stop rambling")
        elif n_chars >= c_warn:
            warn("SC-40", f"brief.md lists {n_chars} characters (target 2-3 core active chars for tight Short focus)")
        if n_locs >= l_err:
            err("SC-40", f"brief.md lists {n_locs} core locations (>= {l_err} ceiling for 9:16 Short; keep <= 3-4 core locations in script, then expand each into 3-4 connected sub-scenes in G4)")
        elif n_locs >= l_warn:
            warn("SC-40", f"brief.md lists {n_locs} core locations (target <= 3 core locations in script)")
        if n_props >= p_err:
            err("SC-40", f"brief.md lists {n_props} plot props (>= {p_err} ceiling for 9:16 Short; ref 1-3 core props)")
        elif n_props >= p_warn:
            warn("SC-40", f"brief.md lists {n_props} plot props (target 1-3 core props)")

    # SC-41: Peak Segment WPS Cap & Dramatic Breath Pause Budget
    eff_cfg = DNA_S.get("effective_wps", {})
    peak_max = float(eff_cfg.get("seg_peak_max", 5.15))
    clim_max = float(eff_cfg.get("climactic_beat_max", 4.65))
    dram_thr = float(DNA_DLG.get("dramatic_pause_threshold_s", 0.38))
    min_dram = int(DNA_DLG.get("min_dramatic_pauses_ge_038s", DNA_DLG.get("min_dramatic_pauses_ge_045s", 3)))
    beat_by_sid = {sid: bt for sid, bt in (map_rows if beats else [])}
    if _is_short:
        for sid, swps in seg_est_wps.items():
            bt = beat_by_sid.get(sid.lower(), "")
            is_clim = sid == ids[0] or bool(re.search(r"\b(hook|payoff|hack|turn|button)\b", bt, re.I))
            if swps > peak_max:
                err("SC-41", f"{sid}: estimated {swps:.2f} eff. wps (> {peak_max} ceiling) — shorten words or add pause_after")
            elif is_clim and swps > clim_max:
                warn("SC-41", f"{sid} ({bt or 'hook'}): estimated {swps:.2f} eff. wps (> {clim_max} target on Hook/Payoff/Turn) — slow down with short sentences & pause_after >= 0.45s")
        n_dram_pauses = sum(1 for s in segs if float(s.get("pause_after", dflt)) >= dram_thr)
        if n_dram_pauses < min_dram:
            warn("SC-41", f"only {n_dram_pauses} dramatic pause(s) >= {dram_thr:.2f}s (target >= {min_dram}: after Hook, before suspense failure, after Twist/Payoff, before Button)")

    # SC-42: One-Spine / Anti-Elder-Lecture / Anti-Late-Backstory-Dump
    if _is_short and len(segs) >= 10:
        act1_end = max(1, int(len(segs) * 0.45))
        act1_txt = " ".join(strip_markup(s["text"]) for s in segs[:act1_end]).lower()
        for pat in DNA_ANTI.get("elder_lecture_patterns", []):
            if re.search(pat, act1_txt, re.I):
                warn("SC-42", f"Act-1 authority/elder lecture detected ('{pat}') — disguise the loophole as a casual everyday habit/quote (Stealth Plant)")
                break
        late_start = max(1, int(len(segs) * 0.75))
        late_txt = " ".join(strip_markup(s["text"]) for s in segs[late_start:-1]).lower()
        for pat in DNA_ANTI.get("late_backstory_dump_markers", []):
            if re.search(pat, late_txt, re.I):
                err("SC-42", f"late backstory dump marker ('{pat}') in final 25% — trust Show & Withhold instead of explaining clues via biography dump")
                break

    # SC-43: Tighter Opening Hook (s1+s2) & Early Personal-Stakes Offset
    if _is_short and len(segs) >= 2:
        s1_s2_w = len(strip_markup(segs[0]["text"]).split()) + len(strip_markup(segs[1]["text"]).split())
        s12_max = int(DNA_BEAT.get("hook_s1_s2_max_words", 32))
        if s1_s2_w > s12_max:
            warn("SC-43", f"s1+s2 is {s1_s2_w} words (> {s12_max} target; ref median S1+S2 = 22w) — tighten opening hook")
        cum_w = 0
        first_p_pct = 1.0
        tot_w = max(1, len(words))
        for s in segs:
            t_s = strip_markup(s["text"])
            if FIRST_PERSON_RE.search(t_s):
                first_p_pct = cum_w / tot_w
                break
            cum_w += len(t_s.split())
        stakes_warn = float(DNA_BEAT.get("personal_stakes_offset_warn_pct", 0.28))
        if first_p_pct > stakes_warn:
            warn("SC-43", f"first-person personal stakes enter at {first_p_pct:.0%} of words (> {stakes_warn:.0%}; ref median 16.5%) — pivot to 'Còn tôi...' earlier")
        if beats and map_rows:
            act1_w_pct = float(DNA_BEAT.get("act1_ceiling_warn_pct", 0.35))
            if first_act2 / len(map_rows) > act1_w_pct:
                warn("SC-43", f"Act 1 spans {first_act2}/{len(map_rows)} segments ({first_act2/len(map_rows):.0%} > {act1_w_pct:.0%} DNA target) — compress world setup")

report = {"segments": len(segs), "words": len(words), "est_seconds": round(est, 1), "sentences": len(lens),
          "sent_mean": round(mean, 2), "sent_sd": round(sd, 2), "sent_min": min(lens or [0]), "sent_max": max(lens or [0]),
          "errors": errors, "warns": warns}
(ROOT / "qa").mkdir(exist_ok=True)
out = ROOT / "qa/script_lint.json"
txt = json.dumps(report, ensure_ascii=False, indent=1)
if not out.exists() or out.read_text() != txt:
    out.write_text(txt)
print(f"script: {len(segs)} segments, {len(words)} words, ~{est:.0f} s, sentences {len(lens)} (mean {mean:.1f}, SD {sd:.1f}, {report['sent_min']}-{report['sent_max']})")
for w in warns:
    print("WARN ", w)
for n in notes:
    print("NOTE ", n)
for e in errors:
    print("ERROR", e)
print(f"script lint: {len(errors)} errors, {len(warns)} warnings")
sys.exit(1 if errors else 0)
